import { redirect } from 'next/navigation'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Props = { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }
export function generateMetadata({ params, searchParams }: Props) { return generatePageMetadata({ config, params, searchParams }) }
export default async function Page({ params, searchParams }: Props) { if ((await params).segments?.[0] === 'login') redirect('/manage/login'); return RootPage({ config, params, searchParams, importMap }) }
