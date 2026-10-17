import { compounds, type Compound } from '@/lib/paddock'
export default function TyreCompound({ compound, compact = false }: { compound: Compound; compact?: boolean }) {
  const tyre = compounds[compound]
  return <span className="tyre-compound" data-compound={compound} title={tyre.hint} aria-label={`${tyre.name} · ${tyre.hint}`}><span className="tyre-ring" aria-hidden="true">{compound}</span>{!compact && <span><b>{tyre.name}</b><small>{tyre.label}</small></span>}</span>
}
export function CompoundLegend() {
  return <details className="compound-legend"><summary>TYRE COMPOUNDS / 选一套配方读下去</summary><div>{(Object.keys(compounds) as Compound[]).map(c => <TyreCompound key={c} compound={c}/>)}</div><p>配方代表文字的节奏与心境；阅读时间按正文估算。</p></details>
}
