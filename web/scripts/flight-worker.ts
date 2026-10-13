import { createPrivateKey } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { lookupFlight, pushCalibration, FlightSyncError, type SyncRequest } from '../src/lib/flights/sync-provider'
import { signedHeaders, workerPath } from '../src/lib/flights/worker-protocol'

const server = new URL(process.env.FLIGHT_CLOUD_URL || 'https://merakt.cn')
if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash || !['', '/'].includes(server.pathname)) throw new Error('FLIGHT_CLOUD_URL 必须是 HTTPS 网站根地址。')
const privateKey = createPrivateKey(await readFile(process.env.FLIGHT_WORKER_PRIVATE_KEY_FILE || '/run/keys/worker-private.pem'))
if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('请选择 Ed25519 私钥。')
if (process.env.BARK_KEY_FILE) process.env.BARK_KEY = (await readFile(process.env.BARK_KEY_FILE, 'utf8')).trim()
process.env.FR24_TRANSPORT ||= 'curl_cffi'
if (process.env.FLIGHTAWARE_API_KEY_FILE) process.env.FLIGHTAWARE_API_KEY = (await readFile(process.env.FLIGHTAWARE_API_KEY_FILE, 'utf8')).trim()
process.env.FR24_PYTHON ||= '/opt/venv/bin/python'
const provider = process.env.FLIGHT_DATA_PROVIDER || 'fr24'
if (!['fr24', 'flightaware'].includes(provider)) throw new Error('FLIGHT_DATA_PROVIDER 配置无效。')
if (provider === 'flightaware' && !process.env.FLIGHTAWARE_API_KEY) throw new Error('家庭端尚未配置 FlightAware Key。')

async function rpc(input: unknown) {
  const body = JSON.stringify(input)
  const response = await fetch(new URL(workerPath, server), { method: 'POST', headers: signedHeaders(body, privateKey), body, signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!response.ok) throw new Error(`云端 HTTP ${response.status}`)
  return response.json()
}

async function once() {
  const { job } = await rpc({ action: 'claim' })
  if (!job) return false
  let result: Record<string, unknown>
  try {
    if (job.phase === 'Awaiting_Radar') result = { ok: true, facts: await lookupFlight(job.request as SyncRequest) }
    else if (job.phase === 'Pending_Gate_Calibration' && job.record_id) { await pushCalibration(job.flight_number, job.record_id); result = { ok: true } }
    else throw new FlightSyncError('provider-config', '任务不受支持。', false)
  } catch (error) {
    result = { ok: false, error_code: error instanceof FlightSyncError ? error.code : 'provider-unavailable' }
  }
  const accepted = await rpc({ action: 'result', job_id: job.job_id, lease_token: job.lease_token, ...result })
  console.log(`任务 ${job.job_id}: ${accepted.status}`)
  return true
}

if (process.argv.includes('--check')) {
  const result = await rpc({ action: 'check' })
  console.log(`云端连接与签名验证：${result.status}`)
} else if (process.argv.includes('--once')) {
  if (!await once()) console.log('当前没有到期任务。')
} else {
  console.log(`Flight Logger 家庭端已启动，数据源 ${process.env.FLIGHT_DATA_PROVIDER || 'fr24'}，每 15 秒领取任务。`)
  let stopping = false
  process.on('SIGTERM', () => { stopping = true })
  process.on('SIGINT', () => { stopping = true })
  while (!stopping) {
    let busy = false
    try { busy = await once() }
    catch (error) { console.error(error instanceof Error && /^云端 HTTP \d{3}$/.test(error.message) ? error.message : '云端暂未确认处理结果；稍后重试。') }
    if (!busy) await new Promise(resolve => setTimeout(resolve, 15000))
  }
}
