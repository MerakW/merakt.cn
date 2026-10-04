import { imageURL } from '@/lib/assets'
import ThemeControl from '@/components/ThemeControl'
import SiteNav from '@/components/SiteNav'
import type { Metadata } from 'next'
import './site.css'
import './flights.css'
import './flight-archive.css'
import './home-gallery.css'
import './personal.css'
import './journal-motion.css'
import './checkin-terminal.css'
import './cover-lounge.css'
import './aircraft.css'
import './theme.css'

export const metadata: Metadata = { title: { default: 'Merak · 数字围场', template: '%s · Merak' }, description: 'Merak 的飞行、毛五影像与生活记录。', icons: { icon: { url: imageURL('/images/card/merak-mark.svg'), type: 'image/svg+xml' } } }

export default function Layout({ children }: { children: React.ReactNode }) {
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA || ''
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var t=sessionStorage.getItem('merak-visit-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}} /></head><body>
    <a className="skip-link" href="#main">跳至内容</a>
    <header className="site-nav"><a className="brand" href="/" aria-label="Merak 首页"><span className="brand-wings" aria-hidden="true">//</span>MERAK<span className="brand-caption">DIGITAL<br />PADDOCK</span></a><SiteNav /><ThemeControl /><span className="nav-location">HANGZHOU <span aria-hidden="true">↗</span> THE WORLD</span></header>
    <main className="site-main" id="main" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <div className="footer-identity"><strong>MERAK.</strong><span>無限進步。</span><a className="footer-revision" href="https://github.com/MerakW/merakt.cn"><span className="footer-repo"><img src={imageURL('/images/card/github.svg')} width="13" height="13" alt="" />GitHub</span><span className="footer-build"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h6m8 0h6"/><circle cx="12" cy="12" r="4"/></svg>BUILD / {commit ? commit.slice(0,7).toUpperCase() : 'LOCAL'}</span></a></div>
      <div className="footer-links">

        <a href="/manage">管理</a><a href="https://status.merakt.cn/status/home">系统状态 ↗</a><a href="https://beian.miit.gov.cn/">浙ICP备2023006729号-1</a>
      </div>
    </footer>
  </body></html>
}
