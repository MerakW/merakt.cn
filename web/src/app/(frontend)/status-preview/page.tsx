'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslator } from '@/components/Localized'
import OffTheRadar from '@/components/OffTheRadar'
import PageError from '../error'
import { GlobalRecovery } from '../../global-error'

const kinds = ['404', 'page', 'offline', 'global', 'pit'] as const
type PreviewKind = typeof kinds[number]
const previewError = Object.assign(new Error('Error page preview'), { digest: '133980504' })
export default function StatusPreview() {
 const [kind, setKind] = useState<PreviewKind>('404')
 const t = useTranslator()
 const locale = useLocale()
 const router = useRouter()
 const labels = { '404': '404', page: t('ui.pageError'), offline: t('ui.offline'), global: 'RED FLAG', pit: 'IN PIT / 503' }
 const retry = () => location.reload()
 return <section><header className="status-preview-controls"><h1>{t('ui.errorPagePreview')}</h1><nav>{kinds.map(item => <button key={item} aria-pressed={kind === item} onClick={() => setKind(item)}>{labels[item]}</button>)}<a href="/red-flag-preview" target="_blank" rel="noopener">RED FLAG ↗</a><a href="/maintenance-preview" target="_blank" rel="noopener">IN PIT / 503 ↗</a></nav></header>{kind === 'pit' ? <iframe key={locale} title="IN PIT / 503" src="/maintenance-preview" style={{width:'100%',height:'100svh',minHeight:720,border:0}} /> : kind === '404' ? <OffTheRadar /> : kind === 'global' ? <GlobalRecovery error={previewError} retry={retry} onLocaleChange={() => router.refresh()} /> : <PageError key={kind} error={previewError} previewOffline={kind === 'offline'} retry={retry} />}</section>
}
