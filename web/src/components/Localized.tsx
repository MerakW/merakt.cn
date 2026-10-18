'use client'

import { Children, createContext, useContext, cloneElement, isValidElement, type ReactNode } from 'react'
import { translate, sourceValue, type MessageValue, type Locale } from '@/lib/i18n/core'

const LocaleContext = createContext<Locale>('zh-CN')
export function LocaleProvider({ locale, children }: { locale: Locale; children?: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}
export const useLocale = () => useContext(LocaleContext)
export function useTranslator() {
  const locale = useLocale()
  return (text: string, values?: readonly MessageValue[]) => translate(text, locale, values)
}
const textProps = new Set(['title', 'alt', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext', 'label', 'text'])

/** Translate React output, including live states, without mutating the DOM or stored values. */
export function localizeTree(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === 'string') return translate(node, locale)
  if (Array.isArray(node)) return Children.map(node, child => localizeTree(child, locale))
  if (!isValidElement<Record<string, unknown>>(node)) return node
  const props = node.props
  if (props['data-i18n'] === 'off' || ['script','style','code','pre'].includes(String(node.type))) return node
  const next: Record<string, unknown> = {}
  for (const name of textProps) if (typeof props[name] === 'string') next[name] = translate(props[name], locale)
  // An option's implicit value must stay stable when its display label changes.
  if (node.type === 'option' && props.value === undefined && typeof props.children === 'string') next.value = sourceValue(props.children)
  if ('children' in props && node.type !== 'textarea') next.children = localizeTree(props.children as ReactNode, locale)
  return cloneElement(node, next)
}
export default function Localized({ children }: { children?: ReactNode }) {
  return localizeTree(children, useLocale())
}
