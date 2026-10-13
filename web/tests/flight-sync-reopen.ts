import assert from 'node:assert/strict'
import { processSyncJob } from '../src/lib/flights/sync-service'
import { FlightSyncError } from '../src/lib/flights/sync-provider'
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const id = Number(process.env.REOPEN_JOB_ID)
  const job = await payload.findByID({ collection: 'flight-sync-jobs', id })
  assert.equal(job.phase, 'Awaiting_Radar')
  assert.equal(job.attempts, 1)
  const retried = await processSyncJob(payload, id, { lookup: async () => { throw new FlightSyncError('no-landed-flight', '等待雷达。') }, push: async () => { throw new Error('should not push') } }, new Date('2026-10-12T11:01:00Z'))
  assert.equal(retried.attempts, 2)
  assert.equal(retried.phase, 'Awaiting_Radar')
  assert.equal((await payload.findByID({ collection: 'flight-sync-jobs', id })).leaseToken, null)
  console.log('FLIGHT_SYNC_REOPEN_OK')
} finally { await payload.destroy() }
