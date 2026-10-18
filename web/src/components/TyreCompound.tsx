import Localized from '@/components/Localized'
import { compounds, type Compound } from '@/lib/paddock'
export default function TyreCompound({ compound, compact = false }: { compound: Compound; compact?: boolean }) {
  const tyre = compounds[compound]
  return <Localized><span className="tyre-compound" data-compound={compound} title={tyre.hint} aria-label={`${tyre.name} · ${tyre.hint}`}><span className="tyre-ring" aria-hidden="true">{compound}</span>{!compact && <span><b>{tyre.name}</b><small>{tyre.label}</small></span>}</span></Localized>
}
export function CompoundLegend() {
  return <Localized><details className="compound-legend"><summary>{"@i18n:ui.tyreCompoundsChooseYourReadingPace@"}</summary><div>{(Object.keys(compounds) as Compound[]).map(c => <TyreCompound key={c} compound={c}/>)}</div><p>{"@i18n:ui.compoundsReflectThePaceAndMoodOfThe@"}</p></details></Localized>
}
