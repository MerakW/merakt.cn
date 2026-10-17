'use client'
import { useFormFields } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import type { FlightRecord } from '@/lib/flights/types'

export function FlightImportReview() {
  const details = useFormFields(([fields]) => fields.privateDetails?.value) as FlightRecord['privateDetails']
  const issues = details?.importIssues || []
  if (!issues.length) return null
  return <aside style={{ borderLeft: '3px solid #dba63b', padding: '12px 20px', marginBottom: 24 }}>
    <strong>数据待核对 · {issues.length} 项</strong>
    <p>已保留实际入位，冲突值保存在下方 Flighty 原始导入信息中。</p>
    <ul>{issues.map((issue, index) => <li key={index}>{issue.field}：{issue.message}</li>)}</ul>
  </aside>
}
export function FlightImportReviewCell({ rowData }: DefaultCellComponentProps) {
  const issues = (rowData.privateDetails as FlightRecord['privateDetails'])?.importIssues || []
  return <span style={{ color: issues.length ? '#be8318' : 'inherit' }}>{issues.length ? `待核对 · ${issues.length}` : '—'}</span>
}
