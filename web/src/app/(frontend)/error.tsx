'use client'
import { useEffect, useState } from 'react'
import ArrowIcon from '@/components/ArrowIcon'
export default function PageError({error,retry,previewOffline}:{error:Error & {digest?:string};retry:()=>void;previewOffline?:boolean}) {
 const [offline,setOffline]=useState(false)
 useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])
 return <section className="dnf-page error-page"><div className="dnf-code">{(previewOffline??offline)?'COMMS':'BOX'}<span>{(previewOffline??offline)?'OFFLINE':'INTERRUPTED'}</span></div><p className="kicker">PIT WALL / CONNECTION</p><h1>{(previewOffline??offline)?'连接暂时中断。':'这个扇区暂时无法载入。'}</h1><p>{(previewOffline??offline)?'恢复网络连接后，再尝试一次。':'请重试，或先返回围场。'}</p><div className="error-actions"><button onClick={()=>retry()}>重新连接 <ArrowIcon/></button><a href="/">返回围场</a></div>{error.digest&&<small>事件编号 / {error.digest}</small>}</section>
}
