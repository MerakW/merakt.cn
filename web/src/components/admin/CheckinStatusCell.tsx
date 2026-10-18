'use client'

import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/admin/AdminLocalized'
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
  return <Localized><div className="checkin-quick-status" onClick={event => event.stopPropagation()}>
    <span role="status" aria-live="polite">{({ pending: "@i18n:ui.pendingReview@", approved: "@i18n:ui.approved2@", rejected: "@i18n:ui.hidden@" } as Record<string, string>)[status] || status}</span>
    {status === 'pending' && <button type="button" className="checkin-approve" disabled={busy} aria-label={i18nMessage('ui.approveMessageFromValue0', rowData.name || "@i18n:ui.guest@")} onClick={async () => {
      setBusy(true); setError('')
      try {
        const response = await fetch(`/api/checkins/${encodeURIComponent(rowData.id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) })
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "@i18n:ui.sessionExpiredSignInAgainToApprove@" : "@i18n:ui.approvalFailedPleaseTryAgain@")
        setSavedStatus('approved'); router.refresh()
      } catch (error) { setError((error as Error).message) }
      finally { setBusy(false) }
    }}>{busy ? "@i18n:ui.approving@" : "@i18n:ui.approve@"}</button>}
    <span role="status" aria-live="polite" className="admin-tool-error">{error}</span>
  </div></Localized>
}
