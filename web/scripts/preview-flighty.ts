import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { previewFlightyCSV } from '../src/lib/flights/import-flighty'
import type { Airport } from '../src/lib/flights/types'

const input = process.argv[2]
if (!input) throw new Error('用法：npm run import:preview -- /absolute/path/to/FlightyExport.csv')
const airports = JSON.parse(readFileSync(new URL('../src/data/airports.json', import.meta.url), 'utf8')) as Airport[]
const preview = previewFlightyCSV(readFileSync(input, 'utf8'), new Map(airports.map(a => [a.iata, a])))
mkdirSync('.data', { recursive: true, mode: 0o700 })
const output = resolve('.data/flighty-preview.json')
writeFileSync(output, JSON.stringify(preview, null, 2) + '\n', { mode: 0o600 })
const summary = {
  rows: preview.totalRows,
  readyToImport: preview.flights.length,
  duplicates: preview.duplicates.map(({ row, firstRow }) => ({ row, firstRow })),
  states: Object.fromEntries(['completed', 'planned', 'cancelled', 'unconfirmed'].map(state => [state, preview.flights.filter(f => f.state === state).length])),
  errors: preview.issues.filter(i => i.severity === 'error'),
  warnings: preview.issues.filter(i => i.severity === 'warning'),
  privateOutput: output,
}
console.log(JSON.stringify(summary, null, 2))
process.exitCode = preview.valid ? 0 : 1
