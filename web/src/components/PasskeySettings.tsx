'use client'
import { useEffect, useState } from 'react'
import { passkeyError, passkeyRequest, registerPasskey } from '@/lib/passkey-client'

type Key = { id: number; name: string; createdAt: string; lastUsedAt?: string }
export default function PasskeySettings({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [supported, setSupported] = useState(false)
  useEffect(() => setSupported(window.isSecureContext && Boolean(window.PublicKeyCredential)), [])
  const refresh = async () => setKeys((await passkeyRequest('list')).keys)
  return <section className="passkey-settings"><p>使用指纹、面容、设备 PIN 或安全密钥登录。通行密钥绑定当前站点域名；本地、家庭服务器和云端域名需分别绑定。</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return
      const form = event.currentTarget, data = new FormData(form)
      setBusy(true); setMessage('')
      try { await registerPasskey(String(data.get('password')), String(data.get('name'))); form.reset(); await refresh(); setMessage('通行密钥已绑定，下次可直接使用。') }
      catch (error) { setMessage(passkeyError(error)) } finally { setBusy(false) }
    }}><label>密钥名称<input name="name" placeholder="例如：MacBook / iPhone" maxLength={80} required /></label><label>确认当前密码<input name="password" type="password" autoComplete="current-password" required /></label>
      <button disabled={busy || !supported}>{busy ? '等待设备验证…' : '添加通行密钥'}</button>
    </form>{!supported && <p>请使用支持通行密钥的浏览器，通过 HTTPS 或本机地址访问。</p>}
    <p role="status" aria-live="polite">{message}</p>
    <ul>{keys.map(key => <li key={key.id}><div><strong>{key.name}</strong><small>添加于 {new Date(key.createdAt).toLocaleDateString('zh-CN')}{key.lastUsedAt && ` · 最近使用 ${new Date(key.lastUsedAt).toLocaleDateString('zh-CN')}`}</small></div><button disabled={busy} onClick={async () => {
      if (!window.confirm(`删除「${key.name}」？此密钥将无法继续登录，密码登录仍可使用。`)) return
      setBusy(true); setMessage('')
      try { await passkeyRequest('remove', { id: key.id }); await refresh(); setMessage('通行密钥已删除。') }
      catch (error) { setMessage(passkeyError(error)) } finally { setBusy(false) }
    }}>删除</button></li>)}</ul>{!keys.length && <p>尚未绑定通行密钥。密码登录始终可用。</p>}<a href="/manage">返回管理首页 ↗</a></section>
}
