'use client'
import { useEffect, useRef } from 'react'

/** Perspective trails: a bounded canvas, no images or WebGL dependency. */
export default function SpeedTunnel() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d', { alpha: false })
    if (!element || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0, height = 0, frame = 0, last = 0, visible = true, elapsed = 0, pointerX = 0, pointerY = 0, steerX = 0, steerY = 0
    const rays = Array.from({length:120}, (_,i) => ({ angle: i * 2.399963, depth: .015 + ((i * 37) % 120) / 120 * .985, color: i % 5 < 2 ? '255,73,88' : i % 5 === 2 ? '235,247,255' : '77,192,255' }))
    const draw = (delta = 0) => {
      elapsed += delta
      ctx.fillStyle = '#071225'; ctx.fillRect(0,0,width,height)
      steerX += (pointerX-steerX)*.06; steerY += (pointerY-steerY)*.06
      // A fixed camera plane is cropped to the container, never stretched per axis.
      const scale = Math.max(width / 1200, height / 700)
      const cx = width * .5 + steerX * 42 * scale, cy = height * .46 + steerY * 17.5 * scale
      const project = (x:number,y:number,z:number) => [cx+x*132*scale/z,cy+y*132*scale/z]
      // Each light travels beyond the viewport before wrapping back to the horizon.
      for (const ray of rays) {
        if(delta) { ray.depth -= delta * .00048; if(ray.depth < .012) ray.depth += .988 }
        const tail = Math.min(1.2,ray.depth+.17)
        const [x,y]=project(Math.cos(ray.angle),Math.sin(ray.angle),ray.depth)
        const [tx,ty]=project(Math.cos(ray.angle),Math.sin(ray.angle),tail)
        ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y)
        ctx.strokeStyle=`rgba(${ray.color},${Math.min(.9,(1-ray.depth)*1.2)})`;ctx.lineWidth=.6+(1-ray.depth)*1.5;ctx.stroke()
      }
      // A finite far plane preserves the width of the distant road.
      const road = (side:number,z:number) => [cx+side*(54+264/z)*scale,cy+52.5*scale/z] as [number,number]
      const farLeft=road(-1,4),farRight=road(1,4),nearLeft=road(-1,.09),nearRight=road(1,.09)
      ctx.fillStyle='#071020';ctx.beginPath();ctx.moveTo(...farLeft);ctx.lineTo(...farRight);ctx.lineTo(...nearRight);ctx.lineTo(...nearLeft);ctx.closePath();ctx.fill()
      for(const side of [-1,1]) {
        ctx.beginPath();ctx.moveTo(...road(side,4));ctx.lineTo(...road(side,.09));ctx.strokeStyle='#a5dafa';ctx.lineWidth=1.4;ctx.stroke()
        // Contiguous kerb panels cover the entire road, including its far end.
        const phase=(elapsed*.0009)% .12
        for(let i=0;i<35;i++) {
          const z=Math.max(.09,4-i*.12-phase),next=Math.max(.09,z-.12)
          if(z<=.09)continue
          ctx.beginPath();ctx.moveTo(...road(side,z));ctx.lineTo(...road(side*1.065,z));ctx.lineTo(...road(side*1.065,next));ctx.lineTo(...road(side,next));ctx.closePath();ctx.fillStyle=i%2?'#ecf4ff':'#f14959';ctx.fill()
        }
      }
      for(let i=0;i<34;i++) {
        const z=4-((i*.12+elapsed*.0009)%3.9)
        ctx.beginPath();ctx.moveTo(...road(0,z));ctx.lineTo(...road(0,Math.max(.09,z-.045)));ctx.strokeStyle='#718eb1';ctx.lineWidth=Math.min(6,.8/z);ctx.stroke()
      }

    }
    const tick = (time:number) => { if(time-last>=1000/60) {draw(last ? Math.min(50,time-last) : 0);last=time} frame=requestAnimationFrame(tick) }
    const sync = () => {cancelAnimationFrame(frame);last=0;if(!reduced.matches&&!document.hidden&&visible) frame=requestAnimationFrame(tick);else draw()}
    const resize = () => {const rect=element.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();sync()}
    const observer=new ResizeObserver(resize);observer.observe(element)
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()});intersection.observe(element)
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync)
    const parent=element.parentElement
    const move=(event:PointerEvent)=>{const rect=element.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width*2-1;pointerY=(event.clientY-rect.top)/rect.height*2-1}
    const leave=()=>{pointerX=0;pointerY=0}
    parent?.addEventListener('pointermove',move);parent?.addEventListener('pointerleave',leave)
    resize()
    return ()=>{parent?.removeEventListener('pointermove',move);parent?.removeEventListener('pointerleave',leave);cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)}
  },[])
  return <canvas ref={canvas} className="speed-tunnel" aria-hidden="true" />
}
