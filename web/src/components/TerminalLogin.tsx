'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function TerminalLogin() {
  const router = useRouter()
  const [localPort, setLocalPort] = useState('')
  useEffect(() => { if (['localhost','127.0.0.1'].includes(location.hostname)) setLocalPort(location.port) }, [])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <div className="terminal-login terminal-v2"><div className="terminal-top"><span>MERAK / CONTROL TERMINAL</span><span>AUTH REQUIRED</span></div><div className="terminal-grid" aria-hidden="true" /><div className="terminal-scan" aria-hidden="true" /><aside className="terminal-signal" aria-label="连接状态"><div className="signal-orbit" aria-hidden="true"><i /><i /><i /><span>MK</span></div><p>{busy ? 'VERIFYING IDENTITY' : error ? 'ACCESS DENIED' : 'AWAITING IDENTITY'}</p><ol><li>控制台已就绪</li><li>{busy ? '正在验证凭据' : '等待管理员验证'}</li><li>验证通过后载入管理功能</li></ol></aside><div className="terminal-form"><p className="terminal-prompt">&gt; establish connection<span className="terminal-cursor">_</span></p><h1>身份验证</h1><p>{localPort === '3002' ? '本机隔离测试站 · 测试账号在此登录' : '请输入管理员凭据。'}</p>{localPort === '3000' && <a className="test-login-link" href="http://127.0.0.1:3002/manage/login">使用测试账号？前往隔离测试站（3002）</a>}<form onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      const response = await fetch('/api/users/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      if (!response.ok) { setError(response.status === 429 ? '尝试过于频繁，请稍后重试。' : '邮箱或密码不正确，或账号暂时被锁定。'); return }
      router.replace('/manage'); router.refresh()
    } catch { setError('连接失败，请稍后重试。') } finally { setBusy(false) }
  }}><label>EMAIL / 邮箱<input name="email" type="email" autoComplete="username" required /></label><label>ACCESS KEY / 密码<input name="password" type="password" autoComplete="current-password" required /></label><p role="alert">{error}</p><button disabled={busy}>{busy ? '验证中…' : '连接控制台'}</button></form><a href="/">返回网站</a></div><div className="terminal-bottom">PRIVATE ACCESS <span>MERAK · HANGZHOU</span></div></div>
}
