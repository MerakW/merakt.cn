import assert from 'node:assert/strict'
import { getPayload, createLocalReq } from 'payload'
import config from '../src/payload.config'
import { workerEndpoint } from '../src/lib/flights/sync-worker'

const payload = await getPayload({ config })
try {
  const http = new Request('https://merakt.cn/api/flight/worker', { method: 'POST', body: process.env.REPLAY_BODY, headers: JSON.parse(process.env.REPLAY_HEADERS!) })
  const req = await createLocalReq({}, payload)
  Object.assign(req, { headers: http.headers, body: http.body })
  assert.equal((await workerEndpoint(req)).status, 409)
  console.log('WORKER_REPLAY_REOPEN_OK')
} finally { await payload.destroy() }
