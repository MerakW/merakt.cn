"""Refresh radar's public scheduled-airport allowlist; flight history stays unchanged."""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
from datetime import datetime, timezone

url = 'https://ourairports.com/data/airports.csv'
data = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urllib.request.urlopen(url, timeout=45).read()
rows = csv.DictReader(io.StringIO(data.decode('utf-8-sig')))
codes = sorted({r['iata_code'] for r in rows if r['scheduled_service'] == 'yes' and r['type'] in {'large_airport', 'medium_airport', 'small_airport'} and len(r['iata_code']) == 3})
if len(codes) < 2000 or 'SIN' not in codes or 'NAY' in codes or 'QPG' in codes:
    raise ValueError('Unexpected airport status data; existing snapshot was not changed.')
result = {'source': url, 'retrieved': datetime.now(timezone.utc).date().isoformat(), 'sha256': hashlib.sha256(data).hexdigest(), 'scheduled': codes}
output = Path(__file__).resolve().parents[1] / 'src/data/radar-airports.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'Updated {len(codes)} scheduled passenger airport codes.')
