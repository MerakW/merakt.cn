#!/usr/bin/env python3
"""One-command build and deploy from the home Ubuntu server."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import time
from urllib.parse import urlparse
import urllib.request

WEB = Path(__file__).resolve().parent.parent
CONFIG = WEB / '.env.deploy.json'


def run(*args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, text=True, **kwargs)


def capture(*args):
    return run(*args, stdout=subprocess.PIPE).stdout.strip()


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def load_config(path):
    config = json.loads(path.read_text())
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.@-]*', config.get('ssh_host', '')):
        raise ValueError('ssh_host 必须为 SSH 别名或 user@host，不要填写命令参数。')
    url = urlparse(config.get('site_url', ''))
    if url.scheme != 'https' or not url.hostname or url.hostname == 'example.com' or url.username or url.password or url.query or url.fragment or url.path not in ('', '/') or any(c.isspace() for c in config['site_url']):
        raise ValueError('请填写真实 HTTPS site_url，例如 https://你的域名。')
    config['site_url'] = config['site_url'].rstrip('/')
    if not re.fullmatch(r'[A-Za-z0-9_./-]+', config.get('ref', '')) or config['ref'].startswith('-'):
        raise ValueError('请填写要发布的 Git ref，例如 origin/main。')
    if not isinstance(config.get('assets_dir'), str) or not config['assets_dir'].strip():
        raise ValueError('请明确填写已审核公开素材的 assets_dir。')
    config['assets_dir'] = Path(os.path.expandvars(config.get('assets_dir', ''))).expanduser().resolve()
    if not config['assets_dir'].is_dir() or not any(config['assets_dir'].iterdir()):
        raise ValueError('assets_dir 必须指向已审核且非空的公开素材目录。')
    return config


def ssh(config, *command):
    return run('ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', config['ssh_host'], shlex.join([str(x) for x in command]))


def upload(config, *files, remote):
    run('scp', '-q', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', *files, f"{config['ssh_host']}:{remote}/")


def smoke(archive, root):
    app, data = root / 'app', root / 'data'
    app.mkdir(); data.mkdir()
    # Only local build output is extracted here, as the current unprivileged user.
    with tarfile.open(archive) as stream:
        for member in stream.getmembers():
            if Path(member.name).is_absolute() or '..' in Path(member.name).parts or not (member.isfile() or member.isdir()):
                raise ValueError('构建包含不安全的归档路径')
        stream.extractall(app)
    name = 'merak-smoke-' + secrets.token_hex(5)
    try:
        run('docker', 'run', '-d', '--name', name, '--platform', 'linux/amd64', '--user', f'{os.getuid()}:{os.getgid()}',
            '-p', '127.0.0.1::3000', '--mount', f'type=bind,source={app},target=/app', '--mount', f'type=bind,source={data},target=/data',
            '-w', '/app', '-e', 'MERAK_DATA_DIR=/data', '-e', 'PAYLOAD_SECRET=isolated-release-smoke-only',
            '-e', 'SERVER_URL=http://127.0.0.1:3000', '-e', 'HOSTNAME=0.0.0.0', '-e', 'PORT=3000',
            'node:22-bookworm-slim', 'node', 'start-production.mjs')
        port = capture('docker', 'port', name, '3000/tcp').rsplit(':', 1)[1]
        # Health checks target a local container, never the system HTTP proxy.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        last_error = '尚未收到响应'
        for attempt in range(60):
            try:
                with opener.open(f'http://127.0.0.1:{port}/api/flights?limit=1', timeout=3) as response:
                    body = json.load(response)
                    if response.status == 200 and isinstance(body, dict) and isinstance(body.get('docs'), list):
                        print('运行包预检通过：空库自动初始化、API 可访问。')
                        return
                    last_error = f'HTTP {response.status}，响应不含有效 docs 列表'
            except (OSError, ValueError) as error:
                last_error = f'{type(error).__name__}: {error}'
            time.sleep(1)
        print('运行包预检最后错误（直连本机，未使用代理）：', last_error, flush=True)
        run('docker', 'logs', '--tail', '60', name)
        raise RuntimeError('运行包预检失败，未上传云端。')
    finally:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description='家庭 Ubuntu 一条命令发布；默认操作为 deploy。')
    parser.add_argument('action', nargs='?', default='deploy', choices=['deploy', 'check', 'init', 'rollback', 'preview', 'preview-stop'])
    parser.add_argument('--config', type=Path, default=CONFIG)
    parser.add_argument('--ref', help='覆盖配置中的 Git ref')
    parser.add_argument('--restore-data', action='store_true', help='回退时确认恢复部署前数据；之后的写入另存保留')
    parser.add_argument('--assets', help='预览用的已审核公开素材目录')
    parser.add_argument('--host', default='127.0.0.1', help='预览监听的本机 IPv4 地址，内网访问填家庭服务器 IP')
    parser.add_argument('--port', type=int, default=3001, help='预览端口，默认 3001')
    parser.add_argument('--url', help='预览反向代理的 HTTPS 访问源地址，写入 SERVER_URL')
    args = parser.parse_args()
    if args.action in ('preview', 'preview-stop'):
        from preview import preview
        preview(args.action, args.config, args.assets, args.host, args.port, args.url)
        return
    if args.action == 'init':
        with args.config.open('x') as stream:
            json.dump({'ssh_host': 'merak-cloud', 'site_url': 'https://example.com', 'ref': 'origin/main', 'assets_dir': '~/merak-assets/public'}, stream, indent=2)
            stream.write('\n')
        args.config.chmod(0o600)
        print('请填写这四项配置：', args.config)
        return
    config = load_config(args.config)
    if args.ref:
        config['ref'] = args.ref
    if args.action == 'check':
        print('配置格式检查通过；未连接 GitHub/云端，也未构建或发布。')
        for command in ('git', 'docker', 'ssh', 'scp'):
            print(command + ': ' + (shutil.which(command) or '未安装'))
        return
    if args.action == 'rollback':
        if not args.restore_data:
            raise ValueError('回退会恢复部署前数据。确认后使用：./deploy.sh rollback --restore-data；当前数据会另存保留。')
        remote = '/tmp/merak-upload-' + secrets.token_hex(8)
        ssh(config, 'mkdir', '-m', '700', remote)
        upload(config, WEB / 'scripts/deploy-target.py', remote=remote)
        ssh(config, 'sudo', '-n', 'python3', remote + '/deploy-target.py', 'rollback')
        ssh(config, 'rm', '-r', remote)
        return
    if not re.fullmatch(r'[A-Za-z0-9_./-]+', config['ref']) or config['ref'].startswith('-'):
        raise ValueError('Invalid Git ref')
    repo = capture('git', '-C', WEB, 'rev-parse', '--show-toplevel')
    run('git', '-C', repo, 'fetch', 'origin')
    commit = capture('git', '-C', repo, 'rev-parse', '--verify', config['ref'] + '^{commit}')
    release = time.strftime('%Y%m%d-%H%M%S', time.gmtime()) + '-' + commit[:12] + '-' + secrets.token_hex(2)
    print('发布提交：', commit, flush=True)
    with tempfile.TemporaryDirectory(prefix='merak-deploy-') as temporary:
        root = Path(temporary)
        source = root / 'source'; source.mkdir()
        run('git', '-C', repo, 'archive', '--format=tar', f'--output={root}/source.tar', commit + ':web')
        with tarfile.open(root / 'source.tar') as stream:
            for member in stream.getmembers():
                if Path(member.name).is_absolute() or '..' in Path(member.name).parts or not (member.isfile() or member.isdir()):
                    raise ValueError('Git source contains links or unsafe paths')
            stream.extractall(source)
        script = source / 'scripts/package-linux.sh'
        if not script.is_file():
            raise RuntimeError('该提交缺少打包脚本；请先提交并推送当前应用及脚本。')
        output = root / 'output'; output.mkdir()
        run('bash', script, '--assets', config['assets_dir'], '--output', output, env={**os.environ, 'GIT_SHA': commit})
        archives = list(output.glob('*.tar.gz'))
        if len(archives) != 1:
            raise RuntimeError('未找到唯一的构建包')
        archive = archives[0]
        smoke(archive, root)
        remote = '/tmp/merak-upload-' + secrets.token_hex(8)
        ssh(config, 'mkdir', '-m', '700', remote)
        upload(config, archive, WEB / 'scripts/deploy-target.py', remote=remote)
        ssh(config, 'sudo', '-n', 'python3', remote + '/deploy-target.py', 'deploy',
            '--archive', remote + '/' + archive.name, '--digest', digest(archive), '--release', release, '--site-url', config['site_url'])
        ssh(config, 'rm', '-r', remote)
        print('完成。请访问', config['site_url'], '检查域名、HTTPS 和页面内容。')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('未完成发布：', error)
        raise SystemExit(1)
