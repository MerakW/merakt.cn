import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { FlightSyncError, type SyncRequest } from '../src/lib/flights/sync-provider'
import { parseVariFlight } from '../src/lib/flights/variflight'

type PaidJob = { id: number; lease_token: string; request: SyncRequest }
type Outbox = { job: PaidJob; data?: unknown; error?: string }
type RPC = (body: unknown) => Promise<any>
export function providerHelper(input: unknown): Promise<any> {
  return new Promise((resolvePromise, reject) => {
    const child = execFile(process.env.VARIFLIGHT_PYTHON || process.env.FR24_PYTHON || '/opt/venv/bin/python', [resolve('src/lib/flights/variflight_fetch.py')],
      { timeout: 60000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        if (error) { reject(new Error('Paid-query ledger unavailable')); return }
        try { resolvePromise(JSON.parse(stdout)) } catch { reject(new Error('Paid-query ledger unavailable')) }
      })
    child.stdin?.end(JSON.stringify(input))
  })
}
async function deliver(rpc: RPC, entry: Outbox) {
  if (!entry.job) throw new Error('Missing durable query reservation')
  let result: Record<string, unknown>
  try {
    if (entry.error) throw new FlightSyncError(entry.error, 'Query not completed', false)
    result = { ok: true, flights: parseVariFlight(entry.data, entry.job.request) }
  } catch (error) { result = { ok: false, error_code: error instanceof FlightSyncError ? error.code : 'provider-schema' } }
  await rpc({ action: 'provider-query-result', id: entry.job.id, lease_token: entry.job.lease_token, ...result })
  await providerHelper({ action: 'ack', id: entry.job.id })
}
export async function processProviderQuery(rpc: RPC): Promise<boolean> {
  if (!process.env.VARIFLIGHT_API_KEY) return false
  const { pending } = await providerHelper({ action: 'pending' })
  if (!Array.isArray(pending)) throw new Error('Paid-query ledger unavailable')
  // Deliver persisted results before asking for more work; cloud outages never cause another charge.
  if (pending.length) { for (const entry of pending) await deliver(rpc, entry); return true }
  const { job } = await rpc({ action: 'provider-query-claim' })
  if (!job) return false
  const entry = await providerHelper({ action: 'query', job })
  await deliver(rpc, entry)
  return true
}
