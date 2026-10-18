'use client'

import Localized from '@/components/Localized'
import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string }

function ImageWithPlaceholder({ onLoad, onError, ...props }: Props) {
  const image = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    if (image.current?.complete) setState(image.current.naturalWidth > 0 ? 'ready' : 'failed')
  }, [])
  return <Localized><span className="loading-image" data-state={state}>
    {state === 'loading' && <span className="loading-skeleton" aria-hidden="true" />}
    {state === 'failed' && <span className="image-unavailable" role="img" aria-label={props.alt || "@i18n:ui.imageUnavailable@"}>{"@i18n:ui.imageUnavailable@"}</span>}
    <img {...props} ref={image} style={{ ...props.style, visibility: state === 'ready' ? 'visible' : 'hidden' }} onLoad={event => { setState('ready'); onLoad?.(event) }} onError={event => { setState('failed'); onError?.(event) }} />
  </span></Localized>
}

export default function LoadingImage(props: Props) {
  return <Localized><ImageWithPlaceholder key={props.src} {...props} /></Localized>
}
