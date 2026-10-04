#!/usr/bin/env python3
"""Cloud-side release activation. Called over SSH; requires root on Ubuntu."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tarfile
import time
import urllib.request

BASE = Path('/opt/merak')
IMAGE = 'node:22-bookworm-slim'


def run(*args):
    return subprocess.run(args, check=True, text=True)


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(temporary, path)


def unpack(archive, destination):
    """Accept ordinary files/directories only; never follow archive links."""
    with tarfile.open(archive, 'r:gz') as stream:
        members = stream.getmembers()
        for member in members:
            path = Path(member.name)
            if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                raise ValueError('Unsafe archive member: ' + member.name)
            if not (destination / path).resolve().is_relative_to(destination.resolve()):
                raise ValueError('Archive path escapes release')
        stream.extractall(destination, members=members)


def compose(*args):
    run('docker', 'compose', '-p', 'merak-deploy', '-f', str(BASE / 'deploy-compose.json'), *args)


def switch(release):
    temporary = BASE / 'current-next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release, target_is_directory=True)
    os.replace(temporary, BASE / 'current')


def healthy():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    last_error = '尚未收到响应'
    for _ in range(45):
        try:
            with opener.open('http://127.0.0.1:3000/api/flights?limit=1', timeout=3) as response:
                body = json.load(response)
                if response.status == 200 and isinstance(body, dict) and isinstance(body.get('docs'), list):
                    return True
                last_error = f'HTTP {response.status}，响应不含有效 docs 列表'
        except (OSError, ValueError) as error:
            last_error = f'{type(error).__name__}: {error}'
        time.sleep(1)
    print('云端健康检查最后错误（直连本机，未使用代理）：', last_error, flush=True)
    return False


def setup(site_url):
    for name in ('releases', 'backups', 'data'):
        (BASE / name).mkdir(parents=True, exist_ok=True)
    # Do not take over an existing 1Panel or manually managed container.
    result = subprocess.run(['docker', 'inspect', 'merak-web'], capture_output=True, text=True)
    if result.returncode == 0:
        labels = json.loads(result.stdout)[0]['Config'].get('Labels') or {}
        if labels.get('com.docker.compose.project') != 'merak-deploy':
            raise RuntimeError('已有 merak-web 由其他方式管理。请先完成一次性迁移，脚本不会接管或删除它。')
    settings = BASE / 'runtime.env'
    if not settings.exists():
        with settings.open('x') as stream:
            stream.write(f'PAYLOAD_SECRET={secrets.token_hex(32)}\nSERVER_URL={site_url}\nMERAK_DATA_DIR=/data\nHOSTNAME=127.0.0.1\nPORT=3000\nNODE_OPTIONS=--max-old-space-size=768\nNEXT_TELEMETRY_DISABLED=1\n')
        settings.chmod(0o600)
    values = dict(line.split('=', 1) for line in settings.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
    for key, expected in {'SERVER_URL': site_url, 'MERAK_DATA_DIR': '/data', 'HOSTNAME': '127.0.0.1', 'PORT': '3000'}.items():
        if values.get(key) != expected:
            raise RuntimeError(f'runtime.env 的 {key} 与单命令部署配置不符，请先核对；不会自动覆盖。')
    if not values.get('PAYLOAD_SECRET') or values.get('DATABASE_URL') or values.get('MEDIA_DIR') or values.get('PAYLOAD_DROP_DATABASE') == 'true':
        raise RuntimeError('runtime.env 的数据库/密钥配置不兼容，停止发布。')
    config = {'services': {'web': {
        'image': IMAGE, 'container_name': 'merak-web', 'platform': 'linux/amd64',
        'user': '1000:1000', 'working_dir': '/app', 'command': ['node', 'start-production.mjs'],
        'init': True, 'restart': 'unless-stopped', 'network_mode': 'host',
        'env_file': [str(settings)], 'volumes': [f'{BASE}/current:/app', f'{BASE}/data:/data'],
        'mem_limit': '1200m', 'stop_grace_period': '30s',
        'logging': {'driver': 'json-file', 'options': {'max-size': '10m', 'max-file': '3'}}}}}
    write_json(BASE / 'deploy-compose.json', config)
    run('docker', 'compose', 'version')
    # Pull before stopping the current service.
    run('docker', 'pull', IMAGE)


def activate(archive, digest, release_id, site_url):
    checksum = hashlib.sha256()
    with archive.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
    if checksum.hexdigest() != digest:
        raise RuntimeError('运行包校验失败，未切换服务。')
    current = BASE / 'current'
    if current.exists() and not current.is_symlink():
        raise RuntimeError('current 不是受管版本链接；不会覆盖现有目录。')
    last = BASE / 'last-deploy.json'
    prior = json.loads(last.read_text()) if last.exists() else {}
    if prior.get('status') in ('failed', 'preparing') and prior.get('previous'):
        raise RuntimeError('上次发布未完成，请先 rollback --restore-data，保留原回退依据。')
    release = BASE / 'releases' / release_id
    if release.exists():
        raise RuntimeError('版本目录已存在；不会覆盖。')
    release.mkdir(parents=True)
    unpack(archive, release)
    for file in ('server.js', 'start-production.mjs', 'prepare-runtime.mjs', 'release.json'):
        if not (release / file).is_file():
            raise RuntimeError('运行包不完整：' + file)
    setup(site_url)
    run('chown', '-R', '1000:1000', str(release), str(BASE / 'data'))
    previous = str(current.resolve()) if current.is_symlink() else None
    if prior.get('status') in ('failed', 'preparing') and not prior.get('previous'):
        previous = None
    state = {'previous': previous, 'release': str(release), 'backup': None, 'status': 'preparing'}
    compose('stop', 'web')
    try:
        backup = BASE / 'backups' / f'{release_id}.tar.gz'
        with tarfile.open(backup, 'w:gz') as stream:
            stream.add(BASE / 'data', arcname='data')
        backup.chmod(0o600)
        state['backup'] = str(backup)
        write_json(BASE / 'last-deploy.json', state)
    except Exception:
        if previous:
            compose('up', '-d', 'web')
        raise
    try:
        switch(release)
        compose('up', '-d', '--force-recreate', 'web')
        if not healthy():
            raise RuntimeError('新版未通过健康检查')
        state['status'] = 'healthy'
        write_json(BASE / 'last-deploy.json', state)
        print('发布成功：', release_id)
    except Exception:
        with contextlib.suppress(Exception):
            compose('stop', 'web')
        state['status'] = 'failed'
        write_json(BASE / 'last-deploy.json', state)
        print('新版已停止；旧程序、迁移前数据备份均已保留。执行 deploy.sh rollback --restore-data 可恢复上一版。')
        raise


def rollback():
    state = json.loads((BASE / 'last-deploy.json').read_text())
    if state['status'] == 'rolled-back' or not state.get('previous') or not state.get('backup'):
        raise RuntimeError('没有可回退的上一版；首次部署失败请修正原因后重新发布。')
    previous = Path(state['previous'])
    if not previous.is_dir():
        raise RuntimeError('上一版目录不存在')
    restored = BASE / f'restore-{time.time_ns()}'
    restored.mkdir()
    unpack(Path(state['backup']), restored)
    if not (restored / 'data').is_dir():
        raise RuntimeError('备份不包含 data')
    compose('stop', 'web')
    retained = BASE / f'data-before-rollback-{time.time_ns()}'
    (BASE / 'data').rename(retained)
    (restored / 'data').rename(BASE / 'data')
    run('chown', '-R', '1000:1000', str(BASE / 'data'))
    switch(previous)
    compose('up', '-d', '--force-recreate', 'web')
    if not healthy():
        compose('stop', 'web')
        raise RuntimeError('回退后健康检查失败，已停止；数据现场位于 ' + str(retained))
    state['status'] = 'rolled-back'
    write_json(BASE / 'last-deploy.json', state)
    print('已恢复上一版及部署前数据。回退前的数据另存于：', retained)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['deploy', 'rollback'])
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--digest')
    parser.add_argument('--release')
    parser.add_argument('--site-url')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('云端发布助手需要 sudo 权限。')
    import re
    from urllib.parse import urlparse
    if args.action == 'deploy':
        if not args.archive or not re.fullmatch(r'[0-9a-f]{64}', args.digest or '') or not re.fullmatch(r'[0-9A-Za-z-]+', args.release or ''):
            raise ValueError('Invalid release arguments')
        url = urlparse(args.site_url or '')
        if url.scheme != 'https' or not url.hostname or url.username or url.password or any(c in args.site_url for c in '\r\n'):
            raise ValueError('Invalid site URL')
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / '.deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.action == 'deploy':
            activate(args.archive, args.digest, args.release, args.site_url)
        else:
            rollback()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('发布停止：', error)
        raise SystemExit(1)
