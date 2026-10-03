import { withPayload } from '@payloadcms/next/withPayload'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const buildLabel = process.env.BUILD_ID || new Date().toISOString().replace(/[-:]/g, '').replace('T', '.').slice(0, 15)
const suppliedCommit = process.env.GIT_SHA || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA
let commit = /^[a-f0-9]{7,40}$/i.test(suppliedCommit || '') ? suppliedCommit : ''
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim() } catch { /* Exported builds can supply GIT_SHA. */ }
}
export default withPayload({
  generateBuildId: async () => buildLabel,
  env: { NEXT_PUBLIC_BUILD_LABEL: buildLabel, NEXT_PUBLIC_COMMIT_SHA: commit || '' },
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingExcludes: {
    '/*': ['./.data/**/*', './.env*', './tests/**/*', './scripts/**/*'],
  },
  poweredByHeader: false,
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // Build in CI/local; the 2 GB production host only runs the resulting image.
  experimental: { cpus: 2 },
})
