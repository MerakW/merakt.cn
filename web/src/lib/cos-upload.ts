import 'server-only'
import { createHash, createHmac } from 'node:crypto'

export function cosConfigured() {
  return ['COS_BUCKET', 'COS_REGION', 'COS_SECRET_ID', 'COS_SECRET_KEY'].every(key => Boolean(process.env[key]?.trim()))
}

// COS REST signature: https://cloud.tencent.com/document/product/436/7778
export async function uploadPhotoToCOS(key: string, image: Buffer) {
  if (!cosConfigured()) throw new Error('图片上传服务尚未配置，请先配置服务器的 COS 环境变量。')
  const bucket = process.env.COS_BUCKET!.trim(), region = process.env.COS_REGION!.trim()
  if (!/^[a-z0-9][a-z0-9-]*-\d+$/.test(bucket) || !/^[a-z]+-[a-z]+(?:-\d+)?$/.test(region)) {
    throw new Error('COS 存储桶名称或地域配置无效。')
  }
  if (!/^fursuitfriday\/upload-[a-f0-9]+\.webp$/.test(key)) throw new Error('图片存储路径无效。')
  const host = `${bucket}.cos.${region}.myqcloud.com`
  const pathname = '/' + key
  const now = Math.floor(Date.now() / 1000)
  const keyTime = `${now - 60};${now + 600}`
  const md5 = createHash('md5').update(image).digest('base64')
  const headers: Record<string, string> = { 'content-md5': md5, 'content-type': 'image/webp', host }
  if (process.env.COS_SESSION_TOKEN) headers['x-cos-security-token'] = process.env.COS_SESSION_TOKEN.trim()
  const names = Object.keys(headers).sort()
  const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())
  const httpHeaders = names.map(name => `${encode(name)}=${encode(headers[name])}`).join('&')
  const httpString = `put\n${pathname}\n\n${httpHeaders}\n`
  const signKey = createHmac('sha1', process.env.COS_SECRET_KEY!.trim()).update(keyTime).digest('hex')
  const stringToSign = `sha1\n${keyTime}\n${createHash('sha1').update(httpString).digest('hex')}\n`
  const signature = createHmac('sha1', signKey).update(stringToSign).digest('hex')
  headers.authorization = `q-sign-algorithm=sha1&q-ak=${process.env.COS_SECRET_ID!.trim()}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${names.join(';')}&q-url-param-list=&q-signature=${signature}`
  headers['cache-control'] = 'public, max-age=31536000, immutable'
  let response: Response
  try {
    response = await fetch(`https://${host}${pathname}`, {
      method: 'PUT', headers, body: new Uint8Array(image), redirect: 'error', signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error('COS 连接失败或超时，未发布相册。请稍后重试。')
  }
  if (!response.ok) throw new Error(`COS 上传失败（HTTP ${response.status}），未发布相册。请检查上传权限和存储桶配置。`)
  await response.body?.cancel()
}
