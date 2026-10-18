'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '@payloadcms/ui'
import { localeCookie } from '@/lib/i18n/core'

export default function AdminLocaleSync({ children }: { children: ReactNode }) {
  const { i18n, switchLanguage } = useTranslation()
  const initialized = useRef(false), target = useRef<string | null>(null)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      const saved = document.cookie.split('; ').find(value => value.startsWith(`${localeCookie}=`))?.split('=')[1]
      const language = saved === 'en' ? 'en' : saved === 'zh-CN' ? 'zh' : null
      if (language && language !== i18n.language && switchLanguage) {
        target.current = language
        void switchLanguage(language)
        return
      }
    }
    if (target.current && target.current !== i18n.language) return
    target.current = null
    document.cookie = `${localeCookie}=${i18n.language === 'en' ? 'en' : 'zh-CN'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  }, [i18n.language, switchLanguage])
  return children
}
