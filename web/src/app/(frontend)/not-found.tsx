import Link from 'next/link'
import ArrowIcon from '@/components/ArrowIcon'
export default function NotFound() {
 return <section className="dnf-page"><div className="dnf-code">404<span>DNF</span></div><p className="kicker">DID NOT FINISH / 偏离航道</p><h1>这个扇区，<br/>不在雷达范围内。</h1><p>Tower to Merak: 请求的航路未找到。<br/>回到围场，重新出发。</p><Link href="/">RETURN TO PIT LANE / 返回围场 <ArrowIcon/></Link><div className="dnf-grid" aria-hidden="true"><i/><i/><i/><i/><i/></div></section>
}
