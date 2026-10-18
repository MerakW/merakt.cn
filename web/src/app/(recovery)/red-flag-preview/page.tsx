'use client'
import GlobalError from '../../global-error'
const error = Object.assign(new Error('Recovery page preview'), {digest:'PREVIEW'})
export default function Preview(){return <GlobalError error={error} retry={()=>location.reload()}/>}
