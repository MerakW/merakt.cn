import assert from 'node:assert/strict'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })
try {
  assert.equal((await payload.count({ collection: 'flights' })).totalDocs, Number(process.env.EXPECTED_FLIGHTS))
  console.log('REOPEN_OK')
} finally { await payload.destroy() }
