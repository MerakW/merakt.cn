export const compounds = {
  S: { name: 'SOFT', label: '极速 / 随手记', hint: '红胎 · 短评与突发灵感' },
  M: { name: 'MEDIUM', label: '均衡 / 日常', hint: '黄胎 · 游记、体验与日常记录' },
  H: { name: 'HARD', label: '耐久 / 长文', hint: '白胎 · 深度长文与技术复盘' },
  I: { name: 'INTERMEDIATE', label: '特殊天气 / 心情', hint: '绿胎 · 赛道湿滑，小心驾驶' },
} as const
export type Compound = keyof typeof compounds
export function richTextContent(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: unknown; root?: unknown; children?: unknown[] }
  if (typeof node.text === 'string') return node.text
  if (node.root) return richTextContent(node.root)
  return Array.isArray(node.children) ? node.children.map(richTextContent).join(' ') : ''
}
export function readingMinutes(text: string) {
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/\S+/g) || []).length
  return (chinese + words) / 300
}
export function compoundFor(text: string, selected?: string | null): Compound {
  if (selected && Object.hasOwn(compounds, selected)) return selected as Compound
  const minutes = readingMinutes(text)
  return minutes < 1 ? 'S' : minutes > 10 ? 'H' : 'M'
}
export function readingLabel(text: string) {
  const minutes = readingMinutes(text)
  return minutes < 1 ? '< 1 MIN' : `≈ ${Math.ceil(minutes)} MIN`
}
export const teams = ['Ferrari', 'McLaren', 'Mercedes', 'Red Bull Racing', 'Aston Martin', 'Alpine', 'Williams', 'Haas', 'Audi', 'Cadillac', 'Racing Bulls'] as const
export type RaceWeekend = { code: string; start: string; end: string; zone: string }
// Official calendar, checked 2026-10-16: https://www.formula1.com/en/racing/2026
export const raceWeekends: RaceWeekend[] = [
  ['MEL','03-06','03-08','Australia/Melbourne'], ['SHA','03-13','03-15','Asia/Shanghai'],
  ['SUZ','03-27','03-29','Asia/Tokyo'], ['MIA','05-01','05-03','America/New_York'],
  ['MTL','05-22','05-24','America/Toronto'], ['MCO','06-05','06-07','Europe/Monaco'],
  ['BCN','06-12','06-14','Europe/Madrid'], ['AUT','06-26','06-28','Europe/Vienna'],
  ['SIL','07-03','07-05','Europe/London'], ['SPA','07-17','07-19','Europe/Brussels'],
  ['BUD','07-24','07-26','Europe/Budapest'], ['ZAN','08-21','08-23','Europe/Amsterdam'],
  ['MNZ','09-04','09-06','Europe/Rome'], ['MAD','09-11','09-13','Europe/Madrid'],
  ['BAK','09-24','09-26','Asia/Baku'], ['SEP','10-02','10-04','Asia/Kuala_Lumpur'],
  ['SGP','10-09','10-11','Asia/Singapore'], ['AUS','10-23','10-25','America/Chicago'],
  ['MEX','10-30','11-01','America/Mexico_City'], ['SAO','11-06','11-08','America/Sao_Paulo'],
  ['LAS','11-19','11-21','America/Los_Angeles'], ['QAT','11-27','11-29','Asia/Qatar'],
  ['ABU','12-04','12-06','Asia/Dubai'],
].map(([code,start,end,zone]) => ({ code, start: `2026-${start}`, end: `2026-${end}`, zone }))
export function trackStatus(now: Date, mode = 'auto', forza = false, raceCode = 'SGP') {
  if (mode === 'sc') return { label: 'SAFETY CAR', kind: 'sc', detail: '安全车带领中', forza: false }
  if (mode === 'race') return { label: `RACE WEEK · ${raceWeekends.some(r => r.code === raceCode) ? raceCode : 'SGP'}`, kind: 'race', detail: '比赛周末', forza: forza || raceCode === 'MNZ' }
  if (mode === 'pit') return { label: 'IN PIT', kind: 'pit', detail: '进站作业中', forza: false }
  if (mode === 'vsc') return { label: 'VSC ENDING', kind: 'vsc', detail: '正在更新，即将恢复', forza: false }
  const race = mode === 'auto' ? raceWeekends.find(r => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: r.zone, year:'numeric',month:'2-digit',day:'2-digit' }).format(now)
    return date >= r.start && date <= r.end
  }) : undefined
  return { label: race ? `RACE WEEK · ${race.code}` : 'TRACK CLEAR', kind: race ? 'race' : 'clear', detail: race ? '比赛周末 · 按赛道当地日期' : '赛道净空', forza: forza || race?.code === 'MNZ' }
}

export const teamColors: Record<string,string> = {
  Ferrari:'#e8293e', McLaren:'#ff8700', Mercedes:'#27e2c0', 'Red Bull Racing':'#5282ef',
  'Aston Martin':'#87bd64', Alpine:'#f58cbe', Williams:'#529aff', Haas:'#dedde0',
  Audi:'#ee482c', Cadillac:'#c8b899', 'Racing Bulls':'#b6caff', Independent:'#d4e1cf',
}

export const teamLogos: Record<string, string> = {
  Ferrari:'ferrari', McLaren:'mclaren', Mercedes:'mercedes', 'Red Bull Racing':'redbullracing',
  'Aston Martin':'astonmartin', Alpine:'alpine', Williams:'williams', Haas:'haasf1team',
  Audi:'audi', Cadillac:'cadillac', 'Racing Bulls':'racingbulls',
}


export function teamLogoSize(team: string) {
  const ratios: Record<string,number> = { Ferrari:242.95/97.12, McLaren:87.8/44, Mercedes:500/552, 'Red Bull Racing':1006/471, 'Aston Martin':1890.97/654.98, Alpine:24.46/13.06, Williams:500/257, Haas:199.386/182.555, Audi:616.114/569.017, Cadillac:2659.892/1365.088, 'Racing Bulls':3 }
  const ratio = ratios[team] || 2
  const height = Math.min(78, Math.sqrt(6000/ratio), 150/ratio)
  return { width: Math.round(height*ratio), height: Math.round(height) }
}
