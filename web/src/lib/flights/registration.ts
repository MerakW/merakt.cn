/** Display formatting only: preserve raw imported values in storage. */
export function formatRegistration(value?: string | null): string {
  const text = (value || '').trim().toUpperCase()
  if (!text || text.includes('-')) return text
  if (/^B[A-Z0-9]{3,5}$/.test(text)) return `B-${text.slice(1)}`
  if (/^(9V|A6)[A-Z]{3}$/.test(text)) return `${text.slice(0,2)}-${text.slice(2)}`
  if (/^VNA[0-9]{3}$/.test(text)) return `VN-${text.slice(2)}`
  // JA and N registrations have no separator; unknown formats are left intact.
  return text
}
