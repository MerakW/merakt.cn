'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

function SplitDigit({ digit, position, run }: { digit: string; position: number; run: number }) {
  const [frame, setFrame] = useState<{ previous: string; next: string; step: number; duration: number } | null>(null)
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const stop = () => { stopped = true; clearTimeout(timer); setFrame(null) }
    preference.addEventListener('change', stop)
    if (!run || preference.matches) { setFrame(null); return () => preference.removeEventListener('change', stop) }
    // Every wheel travels through consecutive digits, then brakes over its last four leaves.
    const steps = 12 + position
    const start = (Number(digit) - steps % 10 + 10) % 10
    let step = 0
    const flip = () => {
      if (stopped) return
      const remaining = steps - step
      const duration = remaining > 4 ? 115 : [380, 290, 220, 170][remaining - 1]
      const previous = String((start + step) % 10)
      const next = String((start + step + 1) % 10)
      setFrame({ previous, next, step, duration })
      step++
      timer = setTimeout(() => { if (step < steps) flip(); else setFrame(null) }, duration + 12)
    }
    timer = setTimeout(flip, position * 70)
    return () => { stopped = true; clearTimeout(timer); preference.removeEventListener('change', stop) }
  }, [digit, position, run])
  return <span className="flap-digit" data-digit={frame?.next ?? digit} data-flipping={Boolean(frame)}>
    <span className="flap-half flap-upper">{frame?.next ?? digit}</span>
    <span className="flap-half flap-lower">{frame?.previous ?? digit}</span>
    {frame && <span key={`${run}-${frame.step}`} className="flap-moving" style={{ '--flip-duration': `${frame.duration}ms` } as CSSProperties}>
      <span className="flap-half flap-upper flap-falling-top">{frame.previous}</span>
      <span className="flap-half flap-lower flap-falling-bottom">{frame.next}</span>
    </span>}
  </span>
}

function Flaps({ value, label, unit, digits, run }: { value: number; label: string; unit: string; digits: number; run: number }) {
  const text = String(value).padStart(digits, '0')
  return <div className="counter-reading"><span className="counter-label">{label}</span><div className="counter-value" role="img" aria-label={`${label} ${value} ${unit}`}><span className="flap-line" aria-hidden="true">{[...text].map((digit, index) => <SplitDigit key={index} digit={digit} position={index} run={run} />)}</span><small aria-hidden="true">{unit}</small></div></div>
}

export default function FlightCounter({ km, flights, airports, airlines, distanceCount }: { km: number; flights: number; airports: number; airlines: number; distanceCount: number }) {
  const board = useRef<HTMLElement>(null)
  const [run, setRun] = useState(0)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setRun(value => value + 1); observer.disconnect() }
    }, { threshold: .25 })
    if (board.current) observer.observe(board.current)
    return () => observer.disconnect()
  }, [])
  return <section ref={board} data-revealed={run > 0} className="flight-counter" aria-labelledby="counter-heading"><div className="counter-top"><h2 id="counter-heading">飞行累计</h2><span>MERAK / FLIGHT COUNTER</span><div className="counter-led" aria-label="数据已载入"><i aria-hidden="true" /><ReadyMatrix /><small>记录已载入</small></div></div><div className="counter-readings"><Flaps value={Math.round(km)} label="累计航程 · 估算" unit="KM" digits={6} run={run} /><Flaps value={flights} label="已完成飞行" unit="段" digits={3} run={run} /><Flaps value={airports} label="到访机场" unit="座" digits={2} run={run} /><Flaps value={airlines} label="搭乘航司" unit="家" digits={2} run={run} /></div><p>里程按机场间距离估算，不代表实际飞行距离<span>{distanceCount === flights ? `${distanceCount} 段记录已计入` : `${distanceCount} / ${flights} 段有坐标可计算`}</span></p></section>
}

function ReadyMatrix() {
 const glyphs = ['11110100011000111110101001001010001','11111100001000011110100001000011111','01110100011000111111100011000110001','11110100011000110001100011000111110','10001100010101000100001000010000100']
 return <svg className="ready-matrix" viewBox="0 0 60 14" width="90" height="21" aria-hidden="true">{glyphs.flatMap((glyph,g) => [...glyph].map((on,i) => <circle key={`${g}-${i}`} cx={g*12+(i%5)*2+1} cy={Math.floor(i/5)*2+1} r=".65" fill={on === '1' ? '#aee7c7' : '#314442'} />))}</svg>
}
