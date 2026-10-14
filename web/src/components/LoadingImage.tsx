'use client'

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string }

function ImageWithPlaceholder({ onLoad, onError, ...props }: Props) {
  const image = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    if (image.current?.complete) setState(image.current.naturalWidth > 0 ? 'ready' : 'failed')
  }, [])
  return <span className="loading-image" data-state={state}>
    {state === 'loading' && <span className="loading-skeleton" aria-hidden="true" />}
    {state === 'failed' && <span className="image-unavailable" role="img" aria-label={props.alt || '图片暂不可用'}>图片暂不可用</span>}
    <img {...props} ref={image} onLoad={event => { setState('ready'); onLoad?.(event) }} onError={event => { setState('failed'); onError?.(event) }} />
  </span>
}

export default function LoadingImage(props: Props) {
  return <ImageWithPlaceholder key={props.src} {...props} />
}
