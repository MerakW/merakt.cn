"""Small Chrome transport based on the owner's verified script. No storage or auth secrets."""
import json
import os
import re
import sys


def fetch_flight(number):
    if not re.fullmatch(r"[A-Z0-9]{2}\d{1,4}[A-Z]?", number):
        return {"error": "invalid-flight"}
    try:
        from curl_cffi import requests
    except ImportError:
        return {"error": "missing-curl-cffi"}
    try:
        response = requests.get(
            "https://api.flightradar24.com/common/v1/flight/list.json",
            params={"query": number, "fetchBy": "flight", "page": 1, "limit": 50},
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://www.flightradar24.com/",
            },
            impersonate=os.environ.get("FR24_IMPERSONATE", "chrome120"),
            proxy=os.environ.get("FR24_PROXY") or None,
            timeout=10,
            allow_redirects=False,
            stream=True,
        )
        try:
            if response.status_code != 200:
                return {"httpStatus": response.status_code}
            data = bytearray()
            for chunk in response.iter_content():
                data.extend(chunk)
                if len(data) > 1024 * 1024:
                    return {"error": "provider-response-too-large"}
            return {"httpStatus": 200, "data": json.loads(data)}
        finally:
            response.close()
    except Exception:
        return {"error": "provider-unavailable"}


if __name__ == "__main__":
    print(json.dumps(fetch_flight(sys.argv[1] if len(sys.argv) == 2 else ""), ensure_ascii=False))
