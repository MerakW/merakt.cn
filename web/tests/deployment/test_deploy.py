import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

target = module('target', ROOT / 'scripts/deploy-target.py')
local = module('local', ROOT / 'scripts/deploy.py')

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.patch = patch.object(target, 'BASE', self.base)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        for name in ('data', 'backups', 'releases/old'):
            (self.base / name).mkdir(parents=True)
        (self.base / 'data/sentinel').write_text('original')
        target.switch(self.base / 'releases/old')
        self.archive = self.base / 'package.tar.gz'
        with tarfile.open(self.archive, 'w:gz') as stream:
            for name in ('server.js', 'start-production.mjs', 'prepare-runtime.mjs', 'release.json'):
                info = tarfile.TarInfo(name); info.size = 2
                stream.addfile(info, io.BytesIO(b'{}'))
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def test_rejects_unsafe_archive_before_extracting(self):
        for name, kind in (('../escape', tarfile.REGTYPE), ('link', tarfile.SYMTYPE)):
            with tarfile.open(self.archive, 'w:gz') as stream:
                info = tarfile.TarInfo(name); info.type = kind; info.linkname = '/tmp'
                stream.addfile(info)
            with self.assertRaises(ValueError):
                target.unpack(self.archive, self.base / 'unpacked')

    def test_checksum_failure_does_not_touch_service(self):
        with patch.object(target, 'compose') as compose:
            with self.assertRaises(RuntimeError):
                target.activate(self.archive, '0' * 64, 'new', 'https://merakt.cn')
            compose.assert_not_called()
        self.assertEqual((self.base / 'current').resolve().name, 'old')

    def test_failed_health_retains_data_and_blocks_next_release(self):
        with patch.object(target, 'setup'), patch.object(target, 'run'), patch.object(target, 'compose') as compose, patch.object(target, 'healthy', return_value=False):
            with self.assertRaises(RuntimeError):
                target.activate(self.archive, self.digest, 'new', 'https://merakt.cn')
            self.assertEqual(compose.call_args.args, ('stop', 'web'))
            state = json.loads((self.base / 'last-deploy.json').read_text())
            self.assertEqual(state['status'], 'failed')
            self.assertTrue(Path(state['backup']).exists())
            with self.assertRaisesRegex(RuntimeError, '上次发布'):
                target.activate(self.archive, self.digest, 'next', 'https://merakt.cn')
        self.assertEqual((self.base / 'data/sentinel').read_text(), 'original')

    def test_rollback_restores_snapshot_and_retains_new_writes(self):
        with patch.object(target, 'setup'), patch.object(target, 'run'), patch.object(target, 'compose'), patch.object(target, 'healthy', return_value=True):
            target.activate(self.archive, self.digest, 'new', 'https://merakt.cn')
            (self.base / 'data/sentinel').write_text('new writes')
            target.rollback()
        self.assertEqual((self.base / 'data/sentinel').read_text(), 'original')
        retained = next(self.base.glob('data-before-rollback-*'))
        self.assertEqual((retained / 'sentinel').read_text(), 'new writes')
        self.assertEqual((self.base / 'current').resolve().name, 'old')

    def test_backup_failure_restarts_previous(self):
        with patch.object(target, 'setup'), patch.object(target, 'run'), patch.object(target, 'compose') as compose, patch.object(tarfile.TarFile, 'add', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                target.activate(self.archive, self.digest, 'new', 'https://merakt.cn')
            self.assertEqual(compose.call_args.args, ('up', '-d', 'web'))
        self.assertEqual((self.base / 'current').resolve().name, 'old')

    def test_assets_must_be_explicit(self):
        config = self.base / 'config.json'
        config.write_text(json.dumps({'ssh_host': 'cloud', 'site_url': 'https://merakt.cn', 'ref': 'origin/main'}))
        with self.assertRaisesRegex(ValueError, 'assets_dir'):
            local.load_config(config)

if __name__ == '__main__':
    unittest.main()
