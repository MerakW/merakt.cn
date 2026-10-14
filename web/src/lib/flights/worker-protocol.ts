import { createHash, sign, randomUUID, type KeyLike } from 'node:crypto'

export const workerPath = '/api/flight/worker'
export function signingMessage(body: string, timestamp: string, nonce: string) {
  return `POST\n${workerPath}\n${timestamp}\n${nonce}\n${createHash('sha256').update(body).digest('hex')}`
}
export function signedHeaders(body: string, key: KeyLike, now = Date.now(), nonce = randomUUID()) {
  const timestamp = String(now)
  return {
    'Content-Type': 'application/json', 'X-Flight-Timestamp': timestamp, 'X-Flight-Nonce': nonce,
    'X-Flight-Signature': sign(null, Buffer.from(signingMessage(body, timestamp, nonce)), key).toString('base64'),
  }
}
