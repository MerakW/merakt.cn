import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { shouldShowArrival, arrivalBootScript } from '../src/lib/site-arrival'
test('arrival decisions cover a first visit, one recovery and reduced motion', () => {
 const state={path:'/',force:false,seen:false,recovery:false,reduced:false}
 assert.equal(shouldShowArrival(state),true)
 assert.equal(shouldShowArrival({...state,seen:true}),false)
 assert.equal(shouldShowArrival({...state,seen:true,force:true}),true)
 assert.equal(shouldShowArrival({...state,path:'/blog',seen:true,recovery:true}),true)
 assert.equal(shouldShowArrival({...state,path:'/blog'}),false)
 for(const path of ['/manage/maintenance','/pit-wall','/status-preview'])assert.equal(shouldShowArrival({...state,path,recovery:true}),false)
 assert.equal(shouldShowArrival({...state,recovery:true,reduced:true}),false)
})
test('head script hides content before hydration and fails open without a late intro', () => {
 const root={dataset:{} as Record<string,string>};let release=()=>{}
 vm.runInNewContext(arrivalBootScript,{document:{documentElement:root},sessionStorage:{getItem:()=>null},location:{pathname:'/',search:''},URLSearchParams,matchMedia:()=>({matches:false}),setTimeout:(fn:()=>void)=>{release=fn}})
 assert.equal(root.dataset.merakArrival,'pending')
 release();assert.equal(root.dataset.merakArrival,'skip')
})
