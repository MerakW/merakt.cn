'use client'
import { useEffect, useRef } from 'react'

/**
 * Halftone field shared by the in-site error pages. Same dot language as the
 * IN PIT / RED FLAG pages, coloured from the site's own tokens so it follows
 * the light and dark themes.
 *   radar — range rings, sweep and an out-of-range contact (404)
 *   radio — team radio waveform breaking up (page error)
 *   flat  — carrier lost, a flat line with the odd blip (offline)
 */
export type HalftoneMode = 'radar' | 'radio' | 'flat'

const MODES: Record<HalftoneMode, number> = { radar: 0, radio: 1, flat: 2 }

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FS = `precision highp float;
uniform vec2 R;uniform float C,T,M,IT;uniform vec3 A,B;
float h1(float n){return fract(sin(n*127.1+31.7)*43758.5453);}
float n1(float x){float i=floor(x),f=fract(x);return mix(h1(i),h1(i+1.),f*f*(3.-2.*f));}
void main(){
  vec2 px=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y);
  vec2 cc=(floor(px/C)+.5)*C;
  float d=length(px-cc)/C;
  vec2 q=cc/R;
  float aa=1.2/C;
  /* intro: stepped halftone wipe from the left */
  float band=floor(q.y*12.);
  float L=(IT-h1(band)*.25)*2.6;
  float rev=IT<0.?1.:clamp((L-q.x)/.25,0.,1.);
  float Ia=0.,Ib=0.;
  if(M<.5){
    vec2 c=R*.5;float rad=min(R.x,R.y)*.44;
    vec2 p=(cc-c)/rad;float r=length(p);float an=atan(p.y,p.x);
    float disc=step(r,1.);
    float k=C/rad;
    float ring=0.;
    for(int i=1;i<=4;i++){float ri=float(i)*.25;ring=max(ring,1.-smoothstep(0.,k*.9,abs(r-ri)));}
    float cross=max(1.-smoothstep(0.,k*.6,abs(p.x)),1.-smoothstep(0.,k*.6,abs(p.y)));
    float sw=T*.9;
    float a=mod(sw-an,6.2832);
    float trail=exp(-a*1.5)*disc;
    float ph=fract(T/3.4);
    float ping=(1.-smoothstep(0.,k*1.3,abs(r-ph*1.2)))*(1.-ph)*.85*step(r,1.2);
    Ia=max(max(ring*.55*disc,cross*.2*disc),max(trail*(.18+.5*n1(r*9.+an*3.)),.06*disc));
    Ia=max(Ia,ping);
    vec2 bp=vec2(cos(-.61),sin(-.61))*1.13;
    float bd=length(p-bp);
    float blink=.35+.65*exp(-mod(sw+.61,6.2832)*1.1);
    Ib=max((1.-smoothstep(.0,.055,bd))*blink,(1.-smoothstep(0.,k*.8,abs(bd-.1)))*blink*.55);
  }else{
    float x=q.x,dy=abs(q.y-.5);
    float amp;
    if(M<1.5){
      float env=smoothstep(.2,.8,n1(x*3.4-T*1.15))*.85+.15;
      float wave=abs(sin(x*41.-T*7.)*.6+sin(x*97.+T*5.)*.3+sin(x*13.-T*2.)*.4);
      amp=.03+.36*env*wave;
      float seg=floor(x*16.);
      float drop=step(.7,h1(seg+floor(T*2.2)*7.));
      amp*=1.-drop*.95;
    }else{
      float bx=fract(T*.16)*1.3-.15;
      float blip=exp(-pow((x-bx)*28.,2.));
      amp=.008+.22*blip*abs(sin(x*120.));
    }
    float e=C/R.y*1.5;
    Ia=clamp((amp-dy)/e,0.,1.)*(.5+.5*(1.-dy/max(amp,.001)));
    Ia=max(Ia,(1.-smoothstep(0.,C/R.y*.6,dy))*.32);
    Ia*=smoothstep(0.,.14,x)*smoothstep(1.,.86,x);
  }
  Ia*=rev;Ib*=rev;
  float ra=.5*sqrt(clamp(Ia,0.,1.))*1.15,rb=.5*sqrt(clamp(Ib,0.,1.))*1.15;
  float da=smoothstep(ra+aa,ra-aa,d)*step(.02,Ia),db=smoothstep(rb+aa,rb-aa,d)*step(.02,Ib);
  gl_FragColor=vec4(A*da*(1.-db)+B*db,max(da,db));
}`

function hex(v: string, fallback: [number, number, number]): [number, number, number] {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return fallback
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

export default function Halftone({ mode, className }: { mode: HalftoneMode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const current = useRef(mode)
  current.current = mode
  const redraw = useRef<() => void>(() => {})

  useEffect(() => {
    const cv = ref.current
    const gl = cv?.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true })
    if (!cv || !gl) return
    const sh = (type: number, src: string) => { const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o); return o }
    const pg = gl.createProgram()!
    const vertex = sh(gl.VERTEX_SHADER, VS), fragment = sh(gl.FRAGMENT_SHADER, FS)
    gl.attachShader(pg, vertex); gl.attachShader(pg, fragment); gl.linkProgram(pg)
    gl.deleteShader(vertex); gl.deleteShader(fragment)
    if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { gl.deleteProgram(pg); return }
    gl.useProgram(pg)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(pg, n)
    const U = { R: u('R'), C: u('C'), T: u('T'), M: u('M'), IT: u('IT'), A: u('A'), B: u('B') }

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 1, H = 1, dpr = 1, raf = 0, colA: number[] = [0.14, 0.29, 0.93], colB: number[] = [0.96, 0.42, 0.23]
    const T0 = performance.now()
    const paint = () => {
      const s = getComputedStyle(document.documentElement)
      const m = current.current
      colA = hex(s.getPropertyValue(m === 'radar' ? '--blue' : m === 'radio' ? '--orange' : '--muted'), [0.14, 0.29, 0.93])
      colB = hex(s.getPropertyValue('--orange'), [0.96, 0.42, 0.23])
    }
    let lastMode = ''
    const draw = (now: number) => {
      if (lastMode !== current.current) { lastMode = current.current; paint() }
      const t = reduce ? 1.2 : (now - T0) / 1000
      gl.uniform2f(U.R, W, H)
      gl.uniform1f(U.C, Math.round(Math.max(5, Math.min(8, W / dpr / 90)) * dpr))
      gl.uniform1f(U.T, t); gl.uniform1f(U.M, MODES[current.current])
      gl.uniform1f(U.IT, reduce || t > 1.4 ? -1 : t)
      gl.uniform3fv(U.A, colA); gl.uniform3fv(U.B, colB)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const size = () => {
      dpr = Math.min(2, devicePixelRatio || 1)
      const r = cv.getBoundingClientRect(); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr))
      cv.width = W; cv.height = H; gl.viewport(0, 0, W, H)
      if (reduce) draw(performance.now())
    }
    const loop = (now: number) => { if (!document.hidden) draw(now); raf = requestAnimationFrame(loop) }
    // follow the theme toggle
    const themeWatch = new MutationObserver(() => { paint(); if (reduce) draw(performance.now()) })
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-track'] })
    const ro = new ResizeObserver(size)
    ro.observe(cv)
    paint(); size()
    cv.dataset.on = 'true'
    redraw.current = () => { if (reduce) draw(performance.now()) }
    if (!reduce) raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); themeWatch.disconnect(); redraw.current = () => {}; gl.deleteBuffer(buffer); gl.deleteProgram(pg) }
  }, [])

  // the animated loop picks up a new mode by itself; a static (reduced-motion) frame needs a nudge
  useEffect(() => { redraw.current() }, [mode])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
