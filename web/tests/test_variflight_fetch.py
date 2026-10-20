import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('variflight_fetch', Path(__file__).resolve().parents[1] / 'src/lib/flights/variflight_fetch.py')
provider = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provider)
DATA = {'code': 200, 'data': [{'FlightNo': 'QA101', 'FlightIngateTime': ''}]}
RAW = json.dumps({'jsonrpc': '2.0', 'id': 1, 'result': {'content': [{'type': 'text', 'text': 'Flight details: ' + repr(DATA)}], 'isError': False}}).encode()
JOB = {'id': 1, 'lease_token': '00000000-0000-4000-8000-000000000001', 'request': {'flight_number': 'QA101', 'date': '2026-10-11'}}

class Response:
    headers = {'Content-Type': 'application/json'}
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self, limit): return RAW

class VariFlightTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'VARIFLIGHT_API_KEY': 'synthetic-test-key', 'VARIFLIGHT_CACHE_DB': str(Path(self.folder.name)/'cache.db'), 'VARIFLIGHT_DAILY_QUERY_LIMIT': '4', 'VARIFLIGHT_MONTHLY_QUERY_LIMIT': '20'})
        self.env.start()
        self.con = provider.open_ledger()
    def tearDown(self):
        self.con.close(); self.env.stop(); self.folder.cleanup()
    def test_json_python_literal_and_sse_are_safe(self):
        self.assertEqual(provider.decode_response(RAW), DATA)
        self.assertEqual(provider.decode_response(b'data: '+RAW+b'\n\n', 'text/event-stream'), DATA)
        hostile = json.dumps({'id': 1, 'result': {'content': [{'type': 'text', 'text': "__import__('os').system('false')"}]}}).encode()
        with self.assertRaises((ValueError, SyntaxError)):
            provider.decode_response(hostile)
    @patch.object(provider, 'build_opener')
    def test_duplicate_and_upload_retry_reuse_persisted_response(self, opener):
        opener.return_value.open.return_value = Response()
        self.assertEqual(provider.lookup(self.con, JOB)['data'], DATA)
        self.assertEqual(provider.lookup(self.con, JOB)['data'], DATA)
        self.assertEqual(opener.return_value.open.call_count, 1)
        self.assertIsNotNone(self.con.execute('SELECT raw FROM calls').fetchone()[0])
        self.assertEqual(self.con.execute('SELECT delivered FROM calls').fetchone()[0], 0)
    @patch.object(provider, 'build_opener')
    def test_timeout_never_calls_again(self, opener):
        opener.return_value.open.side_effect = TimeoutError()
        self.assertEqual(provider.lookup(self.con, JOB)['error'], 'provider-unknown')
        self.assertEqual(provider.lookup(self.con, JOB)['error'], 'provider-unknown')
        self.assertEqual(opener.return_value.open.call_count, 1)
    @patch.object(provider, 'build_opener')
    def test_crash_after_reservation_is_not_retried(self, opener):
        self.assertTrue(provider.reservation(self.con, JOB))
        self.assertEqual(provider.lookup(self.con, JOB)['error'], 'provider-unknown')
        opener.assert_not_called()
    @patch.object(provider, 'build_opener')
    def test_budget_is_reserved_before_network(self, opener):
        opener.return_value.open.return_value = Response()
        with patch.dict(os.environ, {'VARIFLIGHT_DAILY_QUERY_LIMIT': '1'}):
            provider.lookup(self.con, JOB)
            second = {**JOB, 'id': 2}
            self.assertEqual(provider.lookup(self.con, second)['error'], 'provider-budget')
            self.assertEqual(opener.return_value.open.call_count, 1)
    @patch.object(provider, 'build_opener')
    def test_malformed_response_does_not_trigger_another_charge(self, opener):
        response = Response()
        response.read = lambda limit: b'not json'
        opener.return_value.open.return_value = response
        self.assertEqual(provider.lookup(self.con, JOB)['error'], 'provider-schema')
        self.assertEqual(provider.lookup(self.con, JOB)['error'], 'provider-schema')
        self.assertEqual(opener.return_value.open.call_count, 1)

if __name__ == '__main__': unittest.main()
