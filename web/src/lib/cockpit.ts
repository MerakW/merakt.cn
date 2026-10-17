export function setFlightDeck(enabled: boolean) {
 const root=document.documentElement
 if(enabled){root.dataset.cockpit='flight';root.dataset.theme='dark'}
 else {delete root.dataset.cockpit;let saved=null;try{saved=sessionStorage.getItem('merak-visit-theme')}catch{};root.dataset.theme=saved==='light'||saved==='dark'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
 try{if(enabled)sessionStorage.setItem('merak-flight-deck','1');else sessionStorage.removeItem('merak-flight-deck')}catch{}
 window.dispatchEvent(new Event('merak-theme'))
}
export function setTheme(theme: 'light'|'dark') {
  delete document.documentElement.dataset.cockpit
  try{sessionStorage.removeItem('merak-flight-deck')}catch{}
  document.documentElement.dataset.theme=theme
  try{sessionStorage.setItem('merak-visit-theme',theme)}catch{}
  window.dispatchEvent(new Event('merak-theme'))
}
export function setTelemetry(enabled: boolean) {
  document.documentElement.dataset.telemetry=String(enabled)
  try{sessionStorage.setItem('merak-telemetry',String(enabled))}catch{}
  window.dispatchEvent(new Event('merak-telemetry'))
}
export async function copyFrequency() {
  let copied=false
  try { await navigator.clipboard.writeText('1540180211');copied=true } catch {
    const previous=document.activeElement as HTMLElement|null, field=document.createElement('textarea')
    const x=window.scrollX,y=window.scrollY
    field.value='1540180211';field.readOnly=true;field.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';document.body.append(field);field.focus({preventScroll:true});field.select()
    try{copied=document.execCommand('copy')}catch{}finally{field.remove();previous?.focus({preventScroll:true});window.scrollTo({left:x,top:y,behavior:'instant'})}
  }
  window.dispatchEvent(new CustomEvent('merak-toast',{detail:copied?'FREQUENCY 1540180211 COPIED TO CLIPBOARD':'复制未完成 · QQ 1540180211'}))
}
