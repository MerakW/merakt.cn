#!/usr/bin/env python3
"""Persistent local Docker preview. Never connects to the deployment server."""
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import secrets
import subprocess
import tarfile
import tempfile
import time
import urllib.request
from urllib.parse import urlsplit

WEB = Path(__file__).resolve().parent.parent
ROOT = WEB / '.data/local-preview'
NAME = 'merak-preview-' + hashlib.sha256(str(WEB).encode()).hexdigest()[:10]


def run(*args, **kwargs):
    return subprocess.run([str(arg) for arg in args], check=True, text=True, **kwargs)


def ensure_local_docker():
    endpoint = run('docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', capture_output=True).stdout.strip()
    if not endpoint.startswith('unix://') or not os.environ.get('DOCKER_HOST', 'unix://').startswith('unix://'):
        raise RuntimeError('预览只允许本机 Docker，不能使用远程 Docker endpoint。')
    run('docker', 'info', stdout=subprocess.DEVNULL)


def stop_container():
    result = subprocess.run(['docker', 'container', 'ls', '-a', '--filter', f'name=^/{NAME}$', '--format', '{{.Names}}'], check=True, capture_output=True, text=True)
    if NAME not in result.stdout.splitlines():
        return
    label = run('docker', 'inspect', '--format', '{{index .Config.Labels "merak.preview.root"}}', NAME, capture_output=True).stdout.strip()
    if label != str(ROOT):
        raise RuntimeError('同名容器不是当前项目的预览容器，未修改它。')
    run('docker', 'rm', '-f', NAME)


def extract(archive, app):
    with tarfile.open(archive) as stream:
        members = stream.getmembers()
        for item in members:
            if Path(item.name).is_absolute() or '..' in Path(item.name).parts or not (item.isfile() or item.isdir()):
                raise ValueError('运行包包含不安全路径')
        stream.extractall(app, members=members)


def validate_address(host, port):
    address = ipaddress.ip_address(host)
    if address.version != 4 or address.is_unspecified or address.is_multicast or not (address.is_loopback or address.is_private):
        raise ValueError('--host 请填写本机 IPv4 内网地址或 127.0.0.1。')
    if not 1024 <= port <= 65535:
        raise ValueError('--port 必须在 1024–65535 之间。')
    return f'http://{address}:{port}'


def public_address(listen_url, public_url):
    if not public_url:
        return listen_url
    parts = urlsplit(public_url)
    if (parts.scheme != 'https' or not parts.hostname or parts.username or parts.password
            or parts.path not in ('', '/') or parts.query or parts.fragment
            or any(c.isspace() for c in public_url)):
        raise ValueError('--url 必须是 HTTPS 源地址，例如 https://preview.example.com:3443')
    # Validate the port as well, without resolving or contacting the host.
    if parts.port is not None and not 1 <= parts.port <= 65535:
        raise ValueError('--url 端口无效')
    return public_url.rstrip('/')


def start(config_path, assets, host, port, public_url=None):
    listen_url = validate_address(host, port)
    url = public_address(listen_url, public_url)
    if not assets and config_path.exists():
        assets = json.loads(config_path.read_text()).get('assets_dir')
    if not assets or not str(assets).strip():
        raise ValueError('请使用 --assets 指定已审核公开素材目录，或在 .env.deploy.json 填写 assets_dir。无需云端配置。')
    assets = Path(os.path.expandvars(str(assets))).expanduser().resolve()
    if not assets.is_dir() or not any(assets.iterdir()):
        raise ValueError('公开素材目录不存在或为空。')
    # Build the checkout being reviewed; no Git fetch and no SSH/upload.
    with tempfile.TemporaryDirectory(prefix='merak-preview-build-') as temp:
        output = Path(temp)
        run('bash', WEB / 'scripts/package-linux.sh', '--assets', assets, '--output', output)
        archives = list(output.glob('*.tar.gz'))
        if len(archives) != 1:
            raise RuntimeError('没有唯一的运行包')
        app = ROOT / 'releases' / str(time.time_ns())
        app.mkdir(parents=True)
        extract(archives[0], app)
    data = ROOT / 'data'
    data.mkdir(exist_ok=True)
    secret = ROOT / 'secret'
    if not secret.exists():
        fd = os.open(secret, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(secrets.token_hex(32))
    env_file = ROOT / 'runtime.env'
    env_file.touch(mode=0o600, exist_ok=True)
    env_file.chmod(0o600)
    env_file.write_text(f'PAYLOAD_SECRET={secret.read_text().strip()}\nMERAK_DATA_DIR=/data\nSERVER_URL={url}\nHOSTNAME=0.0.0.0\nPORT=3000\nNEXT_TELEMETRY_DISABLED=1\n')
    stop_container()
    run('docker', 'run', '-d', '--name', NAME, '--label', f'merak.preview.root={ROOT}',
        '--platform', 'linux/amd64', '--user', f'{os.getuid()}:{os.getgid()}', '--init', '--restart', 'unless-stopped',
        '-p', f'{host}:{port}:3000', '--env-file', env_file,
        '--mount', f'type=bind,source={app},target=/app', '--mount', f'type=bind,source={data},target=/data',
        '-w', '/app', 'node:22-bookworm-slim', 'node', 'start-production.mjs')
    for _ in range(60):
        try:
            with urllib.request.urlopen(listen_url + '/api/flights?limit=1', timeout=3) as response:
                if response.status == 200 and isinstance(json.load(response).get('docs'), list):
                    print(f'后端预览已启动（HTTPS 代理请单独确认）：{url}\n后台：{url}/admin\n独立数据：{data}\n停止：./deploy.sh preview-stop（保留数据）\n本次未连接或上传云端。')
                    return
        except (OSError, ValueError):
            pass
        time.sleep(1)
    run('docker', 'logs', '--tail', '60', NAME)
    raise RuntimeError('预览健康检查未通过；容器和独立数据已保留，可检查日志或 preview-stop。')


def preview(action, config_path, assets, host, port, public_url=None):
    ensure_local_docker()
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / 'preview.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if action == 'preview-stop':
            stop_container()
            print('预览已停止，数据库与上传文件保留。')
        else:
            start(config_path, assets, host, port, public_url)
