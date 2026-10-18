'use client'
import Localized from '@/components/Localized'
import type { GalleryPhoto } from '@/lib/gallery'
export default function PhotoLab({photo,onOpen}:{photo:GalleryPhoto;onOpen?: (button:HTMLButtonElement)=>void}) {
 const data=photo.exposure,film=data?.medium==='film'
 const equipment=[data?.camera?.trim(),data?.lens?.trim()].filter(Boolean)
 const aperture=data?.aperture?.trim().replace(/^[fFƒＦｆ]\s*[/／]?\s*/, '')
 const settings=film?[data?.filmStock?.trim()]:[data?.focalLength?.trim(),data?.shutter?.trim(),aperture?`ƒ/${aperture}`:undefined,data?.iso?`ISO ${data.iso}`:undefined]
 const parameters=settings.filter(Boolean)
 return <Localized><div className="photo-lab"><button className="lab-image" onClick={e=>onOpen?.(e.currentTarget)} aria-label="@i18n:ui.enlargePhoto@"><img data-i18n="off" src={photo.display} width={photo.width} height={photo.height} alt={photo.alt}/></button>{(equipment.length>0||parameters.length>0)&&<div className="photo-equipment" aria-label="@i18n:ui.cameraSettings@">{equipment.map((label,index)=><span key={`${index}-${label}`}>{index===0&&data?.camera?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l2-3h4l2 3h4v14H4V6Z"/><circle cx="12" cy="12" r="4"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v4m9 5h-4m-5 9v-4m-9-5h4"/></svg>}{label}</span>)}{parameters.length>0&&<span className="photo-exposure-values">{parameters.join(' · ')}</span>}</div>}</div></Localized>
}
