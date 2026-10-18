'use client'
import Localized from '@/components/admin/AdminLocalized'
import { useEffect, useState } from 'react'
import { imageURL } from '@/lib/assets'
const refreshEvent='merak-refresh-avatar'
export function RefreshableAvatar(){
 const [revision,setRevision]=useState(0)
 useEffect(()=>{const refresh=()=>setRevision(Date.now());window.addEventListener(refreshEvent,refresh);return()=>window.removeEventListener(refreshEvent,refresh)},[])
 return <Localized><img className="gravatar-account" src={`${imageURL('/images/card/avatar.webp')}${revision?`?v=${revision}`:''}`} width={25} height={25} alt="@i18n:ui.accountAvatar@" style={{borderRadius:'50%',objectFit:'cover'}}/></Localized>
}
export function RefreshAvatarButton(){
 const [refreshed,setRefreshed]=useState(false)
 return <Localized><><button type="button" style={{padding:'12px 0',border:0,background:'none',color:'inherit',cursor:'pointer'}} onClick={()=>{window.dispatchEvent(new Event(refreshEvent));setRefreshed(true)}}>{"@i18n:ui.refreshAdminAvatar@"}</button>{refreshed&&<small role="status" style={{display:'block'}}>{"@i18n:ui.digitalCardAvatarRefreshed@"}</small>}</></Localized>
}
