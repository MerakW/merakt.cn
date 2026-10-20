"""One HTTP call per confirmed cloud query. SQLite is also the durable result outbox.
Only stdlib. No automatic HTTP retries; interrupted reservations become unknown.
"""
import ast
import datetime as dt
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
from urllib.request import Request, build_opener, HTTPRedirectHandler

MAX_BYTES = 1024 * 1024
ENDPOINT = 'https://ai.variflight.com/servers/aviation/mcp'


def decode_response(raw, content_type='application/json'):
    text = raw.decode('utf-8-sig')
    if 'text/event-stream' in content_type or text.lstrip().startswith(('event:', 'data:')):
        messages, data = [], []
        for line in text.splitlines() + ['']:
            if line.startswith('data:'):
                data.append(line[5:].lstrip())
            elif not line and data:
                blob = '\n'.join(data)
                data = []
                if blob != '[DONE]':
                    messages.append(json.loads(blob))
        matching = [m for m in messages if m.get('id') == 1 and ('result' in m or 'error' in m)]
        if len(matching) != 1:
            raise ValueError('Ambiguous MCP response')
        response = matching[0]
    else:
        response = json.loads(text)
    if response.get('id') != 1 or 'error' in response:
        raise ValueError('MCP error')
    result = response.get('result', {})
    if result.get('isError'):
        raise ValueError('Tool error')
    if isinstance(result.get('structuredContent'), dict):
        return result['structuredContent']
    blocks = [b.get('text', '') for b in result.get('content', []) if b.get('type') == 'text']
    if len(blocks) != 1:
        raise ValueError('Ambiguous tool content')
    blob = blocks[0].strip()
    if blob.startswith('Flight details: '):
        blob = blob[len('Flight details: '):]
    try:
        decoded = json.loads(blob)
    except json.JSONDecodeError:
        # ast.literal_eval reads Python literals; it cannot execute provider text.
        decoded = ast.literal_eval(blob)
    if not isinstance(decoded, dict):
        raise ValueError('Expected flight response')
    return decoded


def open_ledger():
    path = Path(os.environ.get('VARIFLIGHT_CACHE_DB', '/var/lib/flight-logger/variflight.sqlite'))
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=10)
    path.chmod(0o600)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA synchronous=FULL')
    con.execute('''CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY, job TEXT NOT NULL, created REAL NOT NULL,
      status TEXT NOT NULL, raw BLOB, content_type TEXT, error TEXT, delivered INTEGER NOT NULL DEFAULT 0
    )''')
    con.commit()
    return con


def limit(name, default):
    value = os.environ.get(name, str(default))
    if not re.fullmatch(r'\d{1,5}', value) or int(value) > 10000:
        raise ValueError('Invalid budget')
    return int(value)


def reservation(con, job):
    query_id = job['id']
    request = job['request']
    if not isinstance(query_id, int) or isinstance(query_id, bool) or query_id <= 0:
        raise ValueError('Invalid job ID')
    if not re.fullmatch(r'[A-Z0-9]{2}\d{1,4}[A-Z]?', request['flight_number']):
        raise ValueError('Invalid flight number')
    dt.date.fromisoformat(request['date'])
    if not re.fullmatch(r'[a-f0-9-]{36}', job['lease_token']):
        raise ValueError('Invalid lease')
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    day = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp()
    con.execute('BEGIN IMMEDIATE')
    prior = con.execute('SELECT * FROM calls WHERE id=?', (query_id,)).fetchone()
    if prior:
        if json.loads(prior['job']) != job:
            con.rollback()
            raise ValueError('Conflicting job')
        con.commit()
        return False
    if con.execute('SELECT COUNT(*) FROM calls WHERE created >= ?', (day,)).fetchone()[0] >= limit('VARIFLIGHT_DAILY_QUERY_LIMIT', 4) or con.execute('SELECT COUNT(*) FROM calls WHERE created >= ?', (month,)).fetchone()[0] >= limit('VARIFLIGHT_MONTHLY_QUERY_LIMIT', 20):
        con.rollback()
        return None
    con.execute("INSERT INTO calls(id,job,created,status) VALUES(?,?,?,'reserved')", (query_id, json.dumps(job), time.time()))
    con.commit()  # Must be durable BEFORE touching the paid endpoint.
    return True


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def lookup(con, job):
    key = os.environ.get('VARIFLIGHT_API_KEY', '').strip()
    if not key:
        return {'job': job, 'error': 'provider-config'}
    reserved = reservation(con, job)
    if reserved is None:
        return {'job': job, 'error': 'provider-budget'}
    if reserved:
        request = Request(ENDPOINT, method='POST', headers={
            'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
            'X-API-Key': key, 'MCP-Protocol-Version': '2025-03-26',
        }, data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {
            'name': 'searchFlightsByNumber', 'arguments': {'fnum': job['request']['flight_number'], 'date': job['request']['date']},
        }}).encode())
        try:
            with build_opener(NoRedirect).open(request, timeout=35) as response:
                raw = response.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError('Oversized response')
                con.execute("UPDATE calls SET raw=?,content_type=?,status='response' WHERE id=?", (raw, response.headers.get('Content-Type', ''), job['id']))
                con.commit()  # Keep raw response even if decoding/Node/upload subsequently fails.
        except Exception:
            con.execute("UPDATE calls SET status='unknown',error='provider-unknown' WHERE id=?", (job['id'],))
            con.commit()
    return result(con.execute('SELECT * FROM calls WHERE id=?', (job['id'],)).fetchone())


def result(row):
    item = {'job': json.loads(row['job'])}
    if row['raw'] is not None:
        try:
            item['data'] = decode_response(row['raw'], row['content_type'])
        except Exception:
            item['error'] = 'provider-schema'
    else:
        item['error'] = row['error'] or 'provider-unknown'
    return item


def run():
    body = json.loads(sys.stdin.buffer.read(8193))
    with open_ledger() as con:
        if body.get('action') == 'pending':
            con.execute("UPDATE calls SET status='unknown',error='provider-unknown' WHERE status='reserved' AND created < ?", (time.time() - 120,))
            con.commit()
            rows = con.execute("SELECT * FROM calls WHERE status != 'reserved' AND delivered=0 ORDER BY id LIMIT 10").fetchall()
            return {'pending': [result(row) for row in rows]}
        if body.get('action') == 'ack':
            con.execute('UPDATE calls SET delivered=1 WHERE id=?', (body['id'],))
            con.commit()
            return {'ok': True}
        if body.get('action') == 'query':
            return lookup(con, body['job'])
        raise ValueError('Invalid action')


if __name__ == '__main__':
    try:
        print(json.dumps(run(), ensure_ascii=False))
    except Exception:
        print(json.dumps({'error': 'provider-config'}))
        sys.exit(1)
