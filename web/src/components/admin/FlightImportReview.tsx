'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/admin/AdminLocalized'
import { useFormFields } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import type { FlightRecord } from '@/lib/flights/types'

export function FlightImportReview() {
  const details = useFormFields(([fields]) => fields.privateDetails?.value) as FlightRecord['privateDetails']
  const issues = details?.importIssues || []
  if (!issues.length) return null
  return <Localized><aside style={{ borderLeft: '3px solid #dba63b', padding: '12px 20px', marginBottom: 24 }}>
    <strong>{"@i18n:ui.dataNeedsReview@ "}{issues.length} {" @i18n:ui.items@"}</strong>
    <p>{"@i18n:ui.actualGateArrivalIsRetainedConflictingValuesAre@"}</p>
    <ul>{issues.map((issue, index) => <li key={index}>{issue.field}：{issue.message}</li>)}</ul>
  </aside></Localized>
}
export function FlightImportReviewCell({ rowData }: DefaultCellComponentProps) {
  const issues = (rowData.privateDetails as FlightRecord['privateDetails'])?.importIssues || []
  return <Localized><span style={{ color: issues.length ? '#be8318' : 'inherit' }}>{issues.length ? i18nMessage('ui.needsReviewValue0', issues.length) : '—'}</span></Localized>
}
