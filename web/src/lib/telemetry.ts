import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
export type LatencySample = { at: string; ms: number }
export function validLatencySamples(data: unknown, now = Date.now()): LatencySample[] {
  if (!Array.isArray(data)) return []
  return data.filter((v): v is LatencySample => v && typeof v.at === 'string' && typeof v.ms === 'number' && Number.isFinite(v.ms) && v.ms >= 0 && v.ms <= 120000 && Date.parse(v.at) <= now && Date.parse(v.at) >= now - 86400000).sort((a,b) => Date.parse(a.at)-Date.parse(b.at)).slice(-1440)
}
export async function getLatencySamples() {
  if (!process.env.TELEMETRY_FILE) return []
  try { return validLatencySamples(JSON.parse(await readFile(process.env.TELEMETRY_FILE,'utf8'))) } catch { return [] }
}
export function buildAge(value: string | undefined, now = Date.now()) {
  const date = value ? Date.parse(value) : NaN
  return Number.isFinite(date) && date <= now ? Math.floor((now-date)/86400000) : null
}

let recording = Promise.resolve()
export async function recordContentLatency(ms: number): Promise<LatencySample[]> {
  const file = resolve(process.env.CONTENT_TELEMETRY_FILE || '.data/telemetry/content-latency.json')
  let result: LatencySample[] = []
  const operation = recording.then(async () => {
    let samples: LatencySample[] = []
    try { samples = validLatencySamples(JSON.parse(await readFile(file,'utf8'))) } catch { /* First observation starts the history. */ }
    const now = Date.now()
    if (!samples.length || now-Date.parse(samples.at(-1)!.at)>=60000) {
      samples.push({at:new Date(now).toISOString(),ms})
      samples = samples.slice(-1440)
      try {
        await mkdir(dirname(file),{recursive:true})
        const temp = `${file}.${process.pid}.tmp`
        await writeFile(temp,JSON.stringify(samples),{mode:0o600})
        await rename(temp,file)
      } catch { /* Read-only deployments still show the current measurement. */ }
    }
    result = samples
  })
  recording = operation.catch(()=>{})
  await operation
  return result
}
