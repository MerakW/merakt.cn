import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { zh } from '@payloadcms/translations/languages/zh'
import sharp from 'sharp'
import { Users, Trips, Albums, Posts, Notes, Events, SiteSettings } from './collections/Content'
import { Flights } from './collections/Flights'
import { Checkins } from './collections/Checkins'
import { Media } from './collections/Media'
import { migrations } from './migrations'

const baseDir = dirname(fileURLToPath(import.meta.url))
if (!process.env.PAYLOAD_SECRET) throw new Error('请设置 PAYLOAD_SECRET；参见 .env.example。')
mkdirSync(resolve('.data'), { recursive: true })

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  cookiePrefix: process.env.SERVER_URL === 'http://127.0.0.1:3002' ? 'merak-qa' : 'payload',
  serverURL: process.env.SERVER_URL || 'http://127.0.0.1:3000',
  admin: { user: 'users', importMap: { baseDir }, meta: { titleSuffix: ' · Merak 管理' }, components: { afterNavLinks: ['./components/admin/FlightImportLink#FlightImportLink'] } },
  i18n: { supportedLanguages: { zh }, fallbackLanguage: 'zh' },
  collections: [Users, Media, Flights, Trips, Albums, Posts, Notes, Events, Checkins],
  globals: [SiteSettings],
  editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, BlocksFeature({ blocks: [
    { slug: 'trip', labels: { singular: '航程', plural: '航程' }, fields: [{ name: 'trip', label: '选择旅行', type: 'relationship', relationTo: 'trips', required: true }] },
    { slug: 'album', labels: { singular: '相册', plural: '相册' }, fields: [{ name: 'album', label: '选择相册', type: 'relationship', relationTo: 'albums', required: true }] },
  ] })] }),
  db: sqliteAdapter({ prodMigrations: process.env.MERAK_AUTO_MIGRATE === '1' ? migrations : undefined, client: { url: process.env.DATABASE_URL || 'file:./.data/merak.db' }, transactionOptions: { behavior: 'immediate' }, wal: true, busyTimeout: 5000, migrationDir: resolve(baseDir, 'migrations') }),
  sharp,
  upload: { limits: { fileSize: 30 * 1024 * 1024 } },
  typescript: { outputFile: resolve(baseDir, 'payload-types.ts') },
})
