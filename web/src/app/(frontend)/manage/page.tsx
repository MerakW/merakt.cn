import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: '后台管理', robots: { index: false, follow: false } }
export default async function ManagePage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/manage/login')
  return <div className="manage-home"><p className="kicker">MERAK / STUDIO</p><h1>管理我的网站</h1><p>{user ? `你好，${user.name}。` : '登录后上传照片、整理航程，或者写点什么。'}</p><a className="manage-login" href="/admin">{user ? '进入管理后台' : '登录 / 首次设置管理员'}</a><div className="manage-shortcuts">{[['通行密钥','绑定设备密钥，使用指纹、面容或设备 PIN 登录。','/manage/security'],['发一条毛五','拖入一张图片、粘贴文案，自动上传并发布。','/manage/fursuitfriday'],['值机留言','审核访客提交的留言，通过后才会公开。','/admin/collections/checkins'],['毛五相册','上传照片或短片，填写配文、记录日期与摄影署名。','/admin/collections/albums'],['媒体库','上传、查看原件，设置媒体公开范围。','/admin/collections/media'],['飞行记录','编辑航段，选择公开范围。','/admin/collections/flights'],['导入 Flighty','上传 CSV，预览后导入。','/manage/import'],['博客','撰写文章、保存草稿与发布。','/admin/collections/posts'],['首页设置','更换主图、修改介绍和精选相册。','/admin/globals/site-settings']].map(([title,description,url]) => <a href={url} key={title}><h2>{title}</h2><p>{description}</p></a>)}</div><section className="upload-guide"><h2>发一条毛五</h2><p><a className="quiet-link" href="/manage/fursuitfriday">使用单图发布入口 ↗</a>，一张照片和一段配文即可发布。多图或短片仍可在相册后台整理。</p><ol><li>进入「毛五相册」，新建相册，填写名称与记录日期；链接名称会自动生成，也可以自己修改。</li><li>在「照片与短片」里添加一行，点「上传照片或短片」新建媒体；选择文件并填写图片说明。</li><li>需要展示的媒体设为「公开」，补上配文与摄影署名。一个相册可以添加多张。</li><li>保存草稿可以继续修改；发布相册后，毛五页会自动显示。</li></ol><p>支持 JPG、PNG、WebP、AVIF、MP4、WebM，单个文件最多 30 MB。私有媒体不会出现在公开相册里。</p></section></div>
}
