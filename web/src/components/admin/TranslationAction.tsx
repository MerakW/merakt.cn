'use client'

import { useRef, useState } from 'react'
import { useDocumentInfo, useForm, useTranslation } from '@payloadcms/ui'
import { readableTranslation, translationSnapshot, type TranslationPatch } from '@/lib/translation/fields'
import './admin-tools.css'

export default function TranslationAction() {
  const { collectionSlug } = useDocumentInfo()
  const { getData, getFields, dispatchFields, setModified, disabled } = useForm()
  const { i18n } = useTranslation()
  const en = i18n.language === 'en'
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [overwrite, setOverwrite] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ patches: TranslationPatch[]; snapshot: string } | null>(null)
  async function translate() {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setPreview(null)
    const data = getData()
    const snapshot = translationSnapshot(String(collectionSlug), data)
    try {
      const response = await fetch('/api/translate-draft', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: collectionSlug, data, overwrite }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Translation failed')
      setPreview({ patches: result.patches, snapshot })
    } catch (error) { setError(error instanceof Error ? error.message : 'Translation failed') }
    finally { running.current = false; setBusy(false) }
  }
  function apply() {
    if (!preview) return
    if (translationSnapshot(String(collectionSlug), getData()) !== preview.snapshot) { setPreview(null); setError(en ? 'Content changed. Generate a new translation.' : '内容已更改，请重新生成译文。'); return }
    const fields = getFields()
    // Payload's Lexical field remounts for external changes only when initialValue changes too.
    dispatchFields({ type: 'UPDATE_MANY', formState: Object.fromEntries(preview.patches.map(patch => [patch.path, { ...fields[patch.path], value: patch.value, ...(patch.path === 'bodyEn' ? { initialValue: patch.value } : {}), valid: true, isModified: true }])) })
    setModified(true); setPreview(null)
  }
  return <div className="translation-action">
    <div className="flight-provider-actions">
      <button type="button" className="checkin-approve" disabled={busy || disabled} onClick={translate}>{busy ? (en ? 'Translating…' : '正在翻译…') : (en ? 'Translate to English' : '翻译为英文')}</button>
      <label><input type="checkbox" checked={overwrite} disabled={busy || disabled} onChange={event => setOverwrite(event.target.checked)} /> {en ? 'Replace existing English' : '覆盖已有英文'}</label>
    </div>
    {error && <p role="alert" className="admin-tool-error">{error}</p>}
    {preview && <div className="translation-preview">
      <p>{en ? 'Review before applying. Applied text enters the editor draft.' : '审核后填入编辑器草稿。'}</p>
      {preview.patches.map(patch => <div key={patch.path}><strong>{patch.path}</strong><p lang="en">{readableTranslation(patch.value)}</p></div>)}
      <div className="flight-provider-actions"><button type="button" className="checkin-approve" disabled={disabled} onClick={apply}>{en ? 'Apply translation' : '填入译文'}</button><button type="button" className="checkin-approve" onClick={() => setPreview(null)}>{en ? 'Discard' : '丢弃'}</button></div>
    </div>}
  </div>
}
