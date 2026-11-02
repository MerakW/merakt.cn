/**
 * Clearance card — one plain-text application format shared by every channel
 * (online form, email, QQ / X / Douyin DMs, GitHub issue or PR). Admins paste any of
 * them into the Friends "import card" field; the parser accepts Chinese or English labels and YAML.
 */
import { FRIEND_TYRES, HEX_PATTERN, TLA_PATTERN, colorTyre, safeHttpURL, type Tyre } from './pit-lane'

export const PIT_LANE_REPO = 'MerakW/merakt.cn'
export type Application = { tla: string; name: string; url: string; teamColor: string; tyre: 'auto' | Tyre; bio: string; coolingMsg: string; contact: string; backlinkUrl: string }
export type ApplicationSource = 'web' | 'email' | 'social' | 'github' | 'admin'

const FIELDS: [keyof Application, string, string][] = [
  ['tla', '三字码', 'TLA'], ['name', '站点名称', 'NAME'], ['url', '网址', 'URL'], ['teamColor', '涂装色', 'COLOR'], ['tyre', '轮胎', 'TYRE'],
  ['bio', '简介', 'BIO'], ['coolingMsg', '留言', 'MESSAGE'], ['backlinkUrl', '友链页', 'BACKLINK'], ['contact', '联系方式', 'CONTACT'],
]
export const CARD_TITLE = 'HGH PIT LANE · CLEARANCE CARD'

/** Human-readable card with bilingual labels; every line is also machine-parseable. */
export function formatCard(app: Application): string {
  const value = (key: keyof Application) => key === 'tyre' ? (app.tyre === 'auto' ? `AUTO → ${colorTyre(app.teamColor)}` : app.tyre) : String(app[key] || '').trim() || '—'
  return [`【${CARD_TITLE} · P 房入驻申请】`, ...FIELDS.map(([key, zh, en]) => `${zh} ${en}: ${value(key)}`), '— merakt.cn/pit-lane'].join('\n')
}
export function toYaml(app: Application): string {
  const quote = (text: string) => JSON.stringify(text.trim())
  return ['# HGH PIT LANE · friends/<TLA>.yml', ...FIELDS.filter(([key]) => key !== 'contact').map(([key, , en]) => `${en.toLowerCase()}: ${key === 'tyre' ? (app.tyre === 'auto' ? 'auto' : app.tyre) : quote(String(app[key] || ''))}`)].join('\n') + '\n'
}

const LABELS = new Map<string, keyof Application>(FIELDS.flatMap(([key, zh, en]) => [[zh, key], [en.toLowerCase(), key], [key.toLowerCase(), key]] as [string, keyof Application][]))
LABELS.set('color', 'teamColor'); LABELS.set('颜色', 'teamColor'); LABELS.set('主题色', 'teamColor'); LABELS.set('名字', 'name'); LABELS.set('链接', 'url'); LABELS.set('地址', 'url'); LABELS.set('colour', 'teamColor'); LABELS.set('名称', 'name'); LABELS.set('站点', 'url'); LABELS.set('backlinkurl', 'backlinkUrl'); LABELS.set('散热留言', 'coolingMsg'); LABELS.set('cooling', 'coolingMsg') // pre-2026-11 cards
const LINE = /^\s*(?:[-*>#]\s*)?(?:\*\*)?([\p{Script=Han}A-Za-z ]{2,16}?)(?:\s+([A-Za-z]{2,12}))?(?:\*\*)?\s*[:：]\s*(.*?)\s*$/u

/** Parse a clearance card, YAML file or GitHub issue body. Unknown or empty values are dropped. */
export function parseCard(text: string): Partial<Application> {
  const out: Partial<Application> = {}
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(LINE)
    if (!match) continue
    const label = match[1].trim()
    if (/^(qq|微信|wechat|email|e-mail|邮箱|telegram|tg|x|twitter)$/i.test(label) && match[3].trim() && !out.contact) { out.contact = `${label} ${match[3].trim()}`.slice(0, 80); continue }
    const key = LABELS.get((match[2] || '').toLowerCase()) || LABELS.get(match[1].trim().toLowerCase()) || LABELS.get(match[1].trim().split(/\s+/).pop()!.toLowerCase())
    let value = match[3].replace(/^["']|["']$/g, '').trim()
    if (!key || !value || value === '—' || value === '-' || key in out) continue
    if (key === 'tla') { value = value.toUpperCase(); if (!TLA_PATTERN.test(value)) continue }
    if (key === 'url' || key === 'backlinkUrl') { const url = safeHttpURL(value); if (!url) continue; value = url }
    if (key === 'teamColor') { if (!HEX_PATTERN.test(value)) continue; value = value.toLowerCase() }
    if (key === 'tyre') { const tyre = value.toUpperCase(); out.tyre = FRIEND_TYRES.includes(tyre as Tyre) ? tyre as Tyre : 'auto'; continue }
    out[key] = value as never
  }
  return out
}

export function githubIssueURL(app: Application): string {
  const body = `${formatCard({ ...app, contact: '' })}\n\n<!-- 请确认已在你的站点挂上 merakt.cn 友链 / Please link merakt.cn on your site first -->`
  return `https://github.com/${PIT_LANE_REPO}/issues/new?${new URLSearchParams({ title: `[PIT LANE] ${app.tla} · ${app.name}`, labels: 'pit-lane', body })}`
}
/** GitHub forks the repo for the visitor and opens a PR with the prefilled file. */
export function githubFileURL(app: Application): string {
  return `https://github.com/${PIT_LANE_REPO}/new/main?${new URLSearchParams({ filename: `friends/${app.tla || 'TLA'}.yml`, value: toYaml(app) })}`
}
export function mailtoURL(email: string, app: Application): string {
  return `mailto:${email}?subject=${encodeURIComponent(`[PIT LANE] ${app.tla} · ${app.name}`)}&body=${encodeURIComponent(formatCard(app))}`
}
/** Unguessable status ticket; only its SHA-256 is stored. */
export const TICKET_PATTERN = /^PIT-[A-Z]{3}-[A-HJ-NP-Z2-9]{6}$/
