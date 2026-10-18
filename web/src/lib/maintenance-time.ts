/** datetime-local values on the maintenance form always represent UTC+8. */
export function recoveryTime(value: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid recovery time')
  const date = new Date(`${value}:00+08:00`)
  if (!Number.isFinite(date.getTime()) || beijingInput(date.toISOString()) !== value) throw new Error('Invalid recovery time')
  return date.toISOString()
}
export function beijingInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8*3600000).toISOString().slice(0,16) : ''
}

export function maintenanceExpired(mode?: string | null, expected?: string | null, now = Date.now()): boolean {
  return mode === 'pit' && Boolean(expected) && Number.isFinite(Date.parse(expected!)) && Date.parse(expected!) <= now
}
