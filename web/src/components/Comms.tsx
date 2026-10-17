'use client'
import ArrowIcon from './ArrowIcon'
import { copyFrequency } from '@/lib/cockpit'
export default function Comms() {
 return <div className="comms"><p className="kicker">COMMS / FREQUENCIES</p><div><a href="https://github.com/MerakW">GITHUB <span>// MerakW</span><ArrowIcon direction="up-right"/></a><a href="https://v.douyin.com/9FjfikdKPog">DOUYIN <span>// @merak_w</span><ArrowIcon direction="up-right"/></a><button type="button" onClick={()=>void copyFrequency()}>TENCENT QQ <span className="qq-frequency"><span>COPY ID</span><span>1540180211</span></span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button><a href="https://x.com/real_merakw">X <span>// @real_merakw</span><ArrowIcon direction="up-right"/></a></div></div>
}
