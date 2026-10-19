import { translatedMetadata } from '@/lib/i18n/server'
import { requirePreviewAdmin } from '@/lib/preview-access'
export async function generateMetadata() { return translatedMetadata({title:"@i18n:ui.errorPagePreview@",robots:{index:false,follow:false}}) }
export default async function Layout({children}:{children:React.ReactNode}){
  await requirePreviewAdmin()
  return children
}
