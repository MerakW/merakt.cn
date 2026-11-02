import { bilingualLabels } from './lib/i18n/admin'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import sharp from 'sharp'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { PHOTO_UPLOAD_MAX_BYTES } from './lib/photo-upload-limits'
import { Users, Trips, Albums, Posts, Notes, Events, SiteSettings } from './collections/Content'
import { PaddockSignals } from './collections/PaddockSignals'
import { Flights } from './collections/Flights'
import { Checkins } from './collections/Checkins'
import { Media } from './collections/Media'
import { Passkeys, PasskeyChallenges } from './collections/Passkeys'
import { migrations } from './migrations'
import { FlightWorkerReplays } from './collections/FlightWorkerReplays'
import { FlightSyncJobs } from './collections/FlightSyncJobs'
import { FlightProviderQueries } from './collections/FlightProviderQueries'
import { flightSyncEndpoints } from './lib/flights/sync-endpoints'
import { startFlightSyncWorker } from './lib/flights/sync-service'
import { Friends } from './collections/Friends'
import { startPitLaneMonitor } from './lib/pit-lane-monitor'

// Outgoing mail (Pit Lane garage invites / approvals / resets) from the no-reply mailbox; logged to the console when unset.
const smtpPort = Number(process.env.SMTP_PORT) || 465
const email = process.env.SMTP_HOST ? nodemailerAdapter({
  defaultFromAddress: process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@merakt.cn', defaultFromName: process.env.MAIL_FROM_NAME || 'Merak · 数字围场',
  transportOptions: { host: process.env.SMTP_HOST, port: smtpPort, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : smtpPort === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined },
}) : undefined

const baseDir = dirname(fileURLToPath(import.meta.url))
if (!process.env.PAYLOAD_SECRET) throw new Error('请设置 PAYLOAD_SECRET；参见 .env.example。')
mkdirSync(resolve('.data'), { recursive: true })

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  cookiePrefix: process.env.LOCAL_PREVIEW === '1' ? 'merak-preview' : process.env.SERVER_URL === 'http://127.0.0.1:3002' ? 'merak-qa' : 'payload',
  serverURL: process.env.SERVER_URL || 'http://127.0.0.1:3000',
  csrf: process.env.LOCAL_PREVIEW === '1' ? ['http://127.0.0.1:3003', 'http://localhost:3003'] : [],
  admin: { user: 'users', avatar: { Component: './components/admin/RefreshableAvatar#RefreshableAvatar' }, dateFormat: 'yyyy-MM-dd HH:mm', importMap: { baseDir }, meta: { titleSuffix: ' · Merak 管理' }, components: { providers: ['./components/admin/AdminLocaleSync'], beforeLogin: ['./components/admin/FlightImportLink#PasskeyLoginLink'], afterNavLinks: ['./components/admin/FlightImportLink#FlightImportLink', './components/admin/RefreshableAvatar#RefreshAvatarButton'] } },
  i18n: { supportedLanguages: { zh, en }, fallbackLanguage: 'zh' },
  collections: [Users, Media, Flights, Trips, Albums, Posts, Notes, Events, Checkins, Friends, PaddockSignals, FlightSyncJobs, FlightWorkerReplays, FlightProviderQueries, Passkeys, PasskeyChallenges].map(bilingualLabels),
  endpoints: flightSyncEndpoints,
  onInit: payload => { startFlightSyncWorker(payload); startPitLaneMonitor(payload) },
  globals: [bilingualLabels(SiteSettings)],
  editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, BlocksFeature({ blocks: [
    { slug: 'trip', labels: { singular: '航程', plural: '航程' }, fields: [{ name: 'trip', label: '选择旅行', type: 'relationship', relationTo: 'trips', required: true }] },
    { slug: 'album', labels: { singular: '相册', plural: '相册' }, fields: [{ name: 'album', label: '选择相册', type: 'relationship', relationTo: 'albums', required: true }] },
  ] })] }),
  db: sqliteAdapter({ prodMigrations: process.env.MERAK_AUTO_MIGRATE === '1' ? migrations : undefined, client: { url: process.env.DATABASE_URL || 'file:./.data/merak.db' }, transactionOptions: { behavior: 'immediate' }, wal: true, busyTimeout: 5000, migrationDir: resolve(baseDir, 'migrations') }),
  sharp,
  email,
  upload: { limits: { fileSize: PHOTO_UPLOAD_MAX_BYTES } },
  typescript: { outputFile: resolve(baseDir, 'payload-types.ts') },
})
