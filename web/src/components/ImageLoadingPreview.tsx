'use client'

import { useState } from 'react'
import AircraftPortrait from './AircraftPortrait'
import LoadingImage from './LoadingImage'

export default function ImageLoadingPreview() {
  const [round, setRound] = useState(0)
  return <section style={{ padding: '36px 0 60px' }}>
    <p className="kicker">LOCAL / IMAGE LOADING</p><h1>图片加载预览</h1>
    <p>慢速图片等待 5 秒后显示；失败样例等待 5 秒后返回 404。点击重新演示可再次观察骨架。</p>
    <button type="button" onClick={() => setRound(value => value + 1)} style={{ padding: '12px 24px', margin: '12px 0 24px', cursor: 'pointer' }}>重新演示加载过程</button>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 24 }}>
      {([['slow', '慢速加载 · 5 秒'], ['failed', '加载失败 · 无破图图标'], ['ready', '正常加载']] as const).map(([mode, title]) => {
        const src = `/design/image-loading/asset?mode=${mode}&round=${round}`
        return <article key={`${mode}-${round}`} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, background: 'var(--paper)' }}>
          <h2 style={{ fontSize: 17 }}>{title}</h2><p className="kicker">HGH → HKG · 飞机卡片</p>
          <div style={{ minHeight: 180 }}><AircraftPortrait flight={{ aircraft: 'A320' }} previewSrc={src} /></div>
          <p>相册图片</p><div style={{ height: 180, position: 'relative', overflow: 'hidden', borderRadius: 6 }}><LoadingImage src={src} width={1600} height={800} alt="测试飞机插画" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          {mode === 'failed' && <p style={{ fontSize: 12, color: 'var(--muted)' }}>请求失败后，飞机区域移除机模；相册区域显示“图片暂不可用”。</p>}
        </article>
      })}
    </div>
    <p><a href="/flights">返回飞行记录</a> · <a href="/fursuitfriday">查看相册</a></p>
  </section>
}
