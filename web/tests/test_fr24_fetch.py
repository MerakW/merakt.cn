import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("fr24_fetch", Path(__file__).parents[1] / "src/lib/flights/fr24_fetch.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class TransportTests(unittest.TestCase):
    def response(self, status=200, content=b'{"result":{}}'):
        return types.SimpleNamespace(status_code=status, iter_content=lambda: iter([content]), close=lambda: None)

    def invoke(self, response):
        def get(url, **kwargs):
            self.assertEqual(url, "https://api.flightradar24.com/common/v1/flight/list.json")
            self.assertEqual(kwargs["params"]["query"], "MU9191")
            self.assertEqual(kwargs["impersonate"], "chrome120")
            self.assertEqual(kwargs["proxy"], os.environ.get("FR24_PROXY") or None)
            self.assertFalse(kwargs["allow_redirects"])
            self.assertEqual(kwargs["timeout"], 10)
            return response
        with patch.dict(sys.modules, {"curl_cffi": types.SimpleNamespace(requests=types.SimpleNamespace(get=get))}), patch.dict(os.environ, {"FR24_IMPERSONATE": "chrome120"}):
            return helper.fetch_flight("MU9191")

    def test_explicit_provider_proxy(self):
        with patch.dict(os.environ, {"FR24_PROXY": "http://127.0.0.1:7890"}):
            self.assertEqual(self.invoke(self.response())["httpStatus"], 200)

    def test_valid_data(self):
        self.assertEqual(self.invoke(self.response()), {"httpStatus": 200, "data": {"result": {}}})

    def test_access_denied_excludes_html(self):
        self.assertEqual(self.invoke(self.response(403, b"private challenge text")), {"httpStatus": 403})

    def test_bounded_response(self):
        self.assertEqual(self.invoke(self.response(content=b"x" * (1024 * 1024 + 1))), {"error": "provider-response-too-large"})

    def test_invalid_json(self):
        self.assertEqual(self.invoke(self.response(content=b"<html>challenge</html>")), {"error": "provider-unavailable"})

    def test_invalid_input_without_network(self):
        self.assertEqual(helper.fetch_flight("../invalid"), {"error": "invalid-flight"})


if __name__ == "__main__":
    unittest.main()
