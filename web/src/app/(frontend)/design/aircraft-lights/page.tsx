import { notFound } from 'next/navigation'
import AircraftPortrait from '@/components/AircraftPortrait'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'A320 灯光样板', robots: { index: false, follow: false } }

export default function AircraftLightPreview() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <section className="aircraft-light-preview">
    <p className="kicker">AIRCRAFT / LIGHTING STUDY</p><h1>A320 灯光样板</h1>
    <p>翼尖白灯短促双闪，机背红灯错相单闪。三张素材分别校准灯位，仅显示此视角可见的灯光。当前采用代表性 LED 灯具节奏，不代表某一架注册飞机的实际装配。</p>
    <div className="aircraft-light-samples">{[
      { label: '白模 · 常规翼尖', aircraft: 'A320' },
      { label: '全日空 · 常规翼尖', aircraft: 'A320', airline: 'NH' },
      { label: '东方航空 · Sharklet', aircraft: 'A320', airline: 'MU' },
    ].map(({ label, ...flight }) => <article key={label}><h2>{label}</h2><AircraftPortrait flight={flight} detailed animate /></article>)}</div>
    <h2>登机牌尺寸</h2><AircraftPortrait flight={{ aircraft: 'A320' }} animate />
    <h2>静态卡片对照</h2><AircraftPortrait flight={{ aircraft: 'A320' }} />
    <p>系统开启“减少动态效果”时不显示闪灯；滚出画面或切换到其他标签页时停止动画。</p>
    <p className="aircraft-credit">Aircraft illustration credit: <a href="https://www.norebbo.com/" target="_blank" rel="noreferrer">Norebbo</a></p>
  </section>
}
