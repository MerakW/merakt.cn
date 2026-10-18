'use client'
import { useTranslation } from '@payloadcms/ui'
import Localized, { LocaleProvider } from '@/components/Localized'
import type { ReactNode } from 'react'
export default function AdminLocalized({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  return <LocaleProvider locale={i18n.language === 'en' ? 'en' : 'zh-CN'}><Localized>{children}</Localized></LocaleProvider>
}
