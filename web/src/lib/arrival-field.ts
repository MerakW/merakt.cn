// Halftone shader adapted from the user-supplied maintenance-503/index.html.
const fragment = `precision highp float;
uniform vec3 ink;uniform vec2 R;uniform float C,PT,BT,RP,RW,RA,CUT,CA,SE,ST,SU,SA,BR,TM,TT,BA;
float h1(float n){return fract(sin(n*127.1+31.7)*43758.5453);}
void main(){
  vec2 px=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y);
  vec2 cc=(floor(px/C)+.5)*C;
  float d=length(px-cc)/C;
  vec2 q=cc/R; float u=mix(q.x,q.y,PT), v=mix(q.y,q.x,PT);
  float nb=mix(16.,10.,PT); float band=floor(v*nb); float bc=(band+.5)/nb;
  float hA=h1(band), hB=h1(band+19.), hC=h1(band+53.);
  float chev=1.-abs(bc-.5)*2.;
  /* intro bars shooting in from the near edge */
  float L=(BT-hA*.22)*3.4;
  float Ib=BT<0.?1.:clamp((L-u)/.2,0.,1.);
  /* the ramp: navy on the near side, red on the far side, stepped while it moves */
  float ext=SE*pow(max(0.,sin(ST*(2.+hB*1.6)+hC*6.283)),3.)*(.12+.2*hA);
  float pr=RP+RA*(.65*chev+.35*hB)-ext;
  float Ir=clamp((u-(pr-RW))/RW,0.,1.);
  /* outro: the far side is eaten back, stepped */
  float cut=CUT-CA*(.7*chev+.3*hC);
  float I=min(Ib,Ir)*step(u,cut);
  I=pow(I,1.25);
  /* breathing: a slow swell of the whole field plus a pulse that rolls through the dots */
  float wave=sin(u*9.-TT*1.9+v*1.5);
  float mid=I*(1.-I)*4.;
  I=clamp(I*(1.+BA*(.22*sin(TT*1.45)))+BA*.2*wave*mid,0.,1.);
  float r=.5*sqrt(I)*1.18*(1.+BA*.12*wave);
  float aa=1.2/C;
  float dot=smoothstep(r+aa,r-aa,d);
  float solid=smoothstep(.82,.98,I);
  float vig=1.-.32*pow(abs(v-.5)*2.,2.4);
  vec3 red=ink*BR*vig;
  float a=max(dot,solid)*(.55+.45*I)+I*I*.28;
  /* hairline seam, like a dropped row in the decoder */
  float sx=SU*mix(R.x,R.y,PT);
  float seam=SA*step(abs(mix(px.x,px.y,PT)-sx),.75)*step(.35,h1(floor(v*40.)+TM));
  a=clamp(max(a,seam*.9),0.,1.);
  gl_FragColor=vec4(red*a,a);
}`
export function arrivalField(canvas: HTMLCanvasElement, color: string): () => void {
 const gl=canvas.getContext('webgl',{antialias:false,alpha:true,premultipliedAlpha:true})
 if(!gl)return()=>{}
 let raf=0,stopped=false
 const program=gl.createProgram()!,buffer=gl.createBuffer()!,shaders:WebGLShader[]=[]
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);shaders.forEach(s=>gl.deleteShader(s));gl.deleteBuffer(buffer);gl.deleteProgram(program);delete canvas.dataset.ready}
 const compile=(type:number,code:string)=>{const shader=gl.createShader(type)!;shaders.push(shader);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return shader}
 try{
  gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'))
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader unavailable')
 }catch{stop();return()=>{}}
 gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW)
 const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0)
 const names=['R','C','PT','BT','RP','RW','RA','CUT','CA','SE','ST','SU','SA','BR','TM','TT','BA','ink']
 const uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]))
 let width=1,height=1,dpr=1,portrait=0
 function resize(){const rect=canvas.getBoundingClientRect();dpr=Math.min(2,devicePixelRatio||1);width=canvas.width=Math.max(1,Math.round(rect.width*dpr));height=canvas.height=Math.max(1,Math.round(rect.height*dpr));portrait=rect.width/rect.height<.9?1:0;gl!.viewport(0,0,width,height)}
 resize();window.addEventListener('resize',resize);canvas.dataset.ready='true'
 // Resolve CSS colors through a tiny 2D canvas, including light/dark theme variables.
 const probe=document.createElement('canvas').getContext('2d')!
 probe.fillStyle=color;probe.fillRect(0,0,1,1);const rgb=probe.getImageData(0,0,1,1).data
 gl.uniform3f(uniforms.ink,rgb[0]/255,rgb[1]/255,rgb[2]/255)
 const start=performance.now(),ease=(x:number)=>x<0?0:x>1?1:1-(1-x)**3
 const frame=(now:number)=>{
  if(stopped)return
  const t=(now-start)/1000,k=ease((t-1.25)/1.25),rw0=portrait?.36:.4
  if(!document.hidden){
   gl.uniform2f(uniforms.R,width,height)
   const values:Record<string,number>={C:Math.round(Math.max(5,Math.min(9,width/dpr/180))*dpr),PT:portrait,BT:t,RP:t<1.25?-2:-.2+1.2*k,RW:.75-(.75-rw0)*k+.07*Math.sin(t*1.45)*k,RA:.3*Math.sin(Math.PI*k),CUT:2,CA:0,SE:0,ST:0,SU:0,SA:0,BR:t<1.25?1:1-.2*k,TM:0,TT:t,BA:k}
   for(const [key,value]of Object.entries(values))gl.uniform1f(uniforms[key],value)
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3)
  }
  if(t<2.4)raf=requestAnimationFrame(frame)
 }
 raf=requestAnimationFrame(frame)
 return stop
}
