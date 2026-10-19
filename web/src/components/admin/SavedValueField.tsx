'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { TextField, useField, useTranslation, useDocumentInfo } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import { translate } from '@/lib/i18n/core'
import './admin-tools.css'

/** Reuse saved values while retaining Payload's text editing and validation. */
export default function SavedValueField(props: TextFieldClientProps) {
  const { setValue, disabled } = useField<string>({ path: props.path })
  const { collectionSlug } = useDocumentInfo()
  const { i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en' : 'zh-CN'
  const label = typeof props.field.label === 'string' ? props.field.label : props.field.label?.[i18n.language] || props.field.name
  const [options, setOptions] = useState<string[]>([])
  const name = props.path
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/${collectionSlug}/saved-values?field=${encodeURIComponent(name)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Equipment options unavailable'); return response.json() })
      .then(data => { if (!controller.signal.aborted && Array.isArray(data.options)) setOptions(data.options.filter((value: unknown): value is string => typeof value === 'string')) })
      .catch(() => { /* History is optional; standard text entry remains available. */ })
    return () => controller.abort()
  }, [name, collectionSlug])
  return <div className="field-type saved-equipment-field" style={{ ...(props.field.admin?.width ? { '--field-width': props.field.admin.width } : { flex: '1 1 0%' }), ...props.field.admin?.style, minWidth: 0 } as CSSProperties}><TextField {...props} />{options.length > 0 && <select className="saved-equipment-history" aria-label={translate('admin.equipment.chooseSaved', locale, [String(label)])} value="" disabled={disabled || props.readOnly} onChange={event => { if (event.target.value) setValue(event.target.value) }}>
    <option value="">{translate('admin.equipment.chooseSaved', locale, [String(label)])}</option>
    {options.map(value => <option key={value} value={value}>{value}</option>)}
  </select>}</div>
}
