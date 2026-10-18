'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslator } from './Localized'
import { localeCookie } from '@/lib/i18n/core'
export default function LanguageControl({ adminLocaleCookie }: { adminLocaleCookie: string }) {
  const locale = useLocale(), t = useTranslator()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" className="language-control" lang={locale === 'en' ? 'zh-CN' : 'en'} aria-label={t(locale === 'en' ? 'language.switchToChinese' : 'language.switchToEnglish')} disabled={pending} onClick={() => {
    const next = locale === 'en' ? 'zh-CN' : 'en'
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    document.cookie = `${adminLocaleCookie}=${next === 'en' ? 'en' : 'zh'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    startTransition(() => router.refresh())
  }}>{t(locale === 'en' ? 'language.chinese' : 'language.english')}</button>
}
