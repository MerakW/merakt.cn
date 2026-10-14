'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'
import './admin-tools.css'

export function CheckinStatusCell({ cellData, rowData }: DefaultCellComponentProps) {
  const router = useRouter()
  const [savedStatus, setSavedStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const status = savedStatus || String(cellData)
  return <div className="checkin-quick-status" onClick={event => event.stopPropagation()}>
    <span role="status" aria-live="polite">{({ pending: '待审核', approved: '通过', rejected: '不公开' } as Record<string, string>)[status] || status}</span>
    {status === 'pending' && <button type="button" className="checkin-approve" disabled={busy} aria-label={`批准 ${rowData.name || '访客'} 的留言`} onClick={async () => {
      setBusy(true); setError('')
      try {
        const response = await fetch(`/api/checkins/${encodeURIComponent(rowData.id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) })
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '登录已失效，请重新登录后批准。' : '批准失败，请重试。')
        setSavedStatus('approved'); router.refresh()
      } catch (error) { setError((error as Error).message) }
      finally { setBusy(false) }
    }}>{busy ? '批准中…' : '一键批准'}</button>}
    <span role="status" aria-live="polite" className="admin-tool-error">{error}</span>
  </div>
}
