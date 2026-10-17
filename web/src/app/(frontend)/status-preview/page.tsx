'use client'
import {useState} from 'react'
import PageError from '../error'
import NotFound from '../not-found'
import {GlobalRecovery} from '../../global-error'
export default function StatusPreview(){
 const [kind,setKind]=useState('404')
 return <section><header className="status-preview-controls"><h1>故障页预览</h1><nav>{['404','页面错误','离线','全局错误'].map(item=><button key={item} aria-pressed={kind===item} onClick={()=>setKind(item)}>{item}</button>)}<a href="/maintenance-preview">IN PIT / 503 ↗</a></nav></header>{kind==='404'?<NotFound/>:kind==='全局错误'?<div style={{background:'#101821',color:'#e7edf3'}}><GlobalRecovery error={new Error()} retry={()=>location.reload()}/></div>:<PageError error={new Error()} previewOffline={kind==='离线'} retry={()=>location.reload()}/>}</section>
}
