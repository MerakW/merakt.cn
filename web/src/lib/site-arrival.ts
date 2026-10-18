type ArrivalState = { path: string; force: boolean; seen: boolean; recovery: boolean; reduced: boolean }
export function shouldShowArrival({ path, force, seen, recovery, reduced }: ArrivalState): boolean {
  if (reduced || path.startsWith('/manage') || path === '/pit-wall' || path === '/status-preview') return false
  return recovery || (path === '/' && (force || !seen))
}
// Runs in <head>, before the server-rendered body can paint.
export const arrivalBootScript = `(()=>{
 const root=document.documentElement;
 let seen=false,recovery=false;
 try{seen=sessionStorage.getItem('merak-site-arrival')==='1';recovery=sessionStorage.getItem('merak-recovery-arrival')==='1'}catch{}
 const show=(${shouldShowArrival.toString()})({path:location.pathname,force:new URLSearchParams(location.search).has('intro'),seen,recovery,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
 if(!show)return;
 root.dataset.merakArrival='pending';
 setTimeout(()=>{if(root.dataset.merakArrival==='pending'){root.dataset.merakArrival='skip'}},4000);
})()`
export const arrivalBootCSS = 'html[data-merak-arrival="pending"] body>:not(.site-arrival){visibility:hidden!important}'
