'use client'
import { useEffect, useState } from 'react'
import { imageURL } from '@/lib/assets'
const refreshEvent='merak-refresh-avatar'
export function RefreshableAvatar(){
 const [revision,setRevision]=useState(0)
 useEffect(()=>{const refresh=()=>setRevision(Date.now());window.addEventListener(refreshEvent,refresh);return()=>window.removeEventListener(refreshEvent,refresh)},[])
 return <img className="gravatar-account" src={`${imageURL('/images/card/avatar.webp')}${revision?`?v=${revision}`:''}`} width={25} height={25} alt="账户头像" style={{borderRadius:'50%',objectFit:'cover'}}/>
}
export function RefreshAvatarButton(){
 const [refreshed,setRefreshed]=useState(false)
 return <><button type="button" style={{padding:'12px 0',border:0,background:'none',color:'inherit',cursor:'pointer'}} onClick={()=>{window.dispatchEvent(new Event(refreshEvent));setRefreshed(true)}}>刷新后台头像</button>{refreshed&&<small role="status" style={{display:'block'}}>已刷新电子名片头像</small>}</>
}
