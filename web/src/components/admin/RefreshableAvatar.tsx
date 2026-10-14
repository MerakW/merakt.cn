'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const refreshEvent = 'merak-refresh-avatar'

export function RefreshableAvatar() {
  const { user } = useAuth()
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : ''
  const [hash, setHash] = useState('')
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setHash('')
    if (email && crypto.subtle) crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)).then(bytes => {
      if (!cancelled) setHash(Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [email])
  useEffect(() => {
    const refresh = () => { setRevision(Date.now()); setFailed(false) }
    refresh()
    window.addEventListener(refreshEvent, refresh)
    return () => window.removeEventListener(refreshEvent, refresh)
  }, [])
  if (!hash || failed) return <span aria-label="账户头像">{email.slice(0, 1).toUpperCase() || 'M'}</span>
  return <img className="gravatar-account" src={`https://www.gravatar.com/avatar/${hash}?d=mp&r=g&s=100&v=${revision}`} width={25} height={25} alt="账户头像" style={{ borderRadius: '50%' }} onError={() => setFailed(true)} />
}

export function RefreshAvatarButton() {
  const [refreshed, setRefreshed] = useState(false)
  return <><button type="button" style={{ padding: '12px 0', border: 0, background: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => { window.dispatchEvent(new Event(refreshEvent)); setRefreshed(true) }}>刷新后台头像</button>{refreshed && <small role="status" style={{ display: 'block' }}>已重新请求 Gravatar 头像</small>}</>
}
