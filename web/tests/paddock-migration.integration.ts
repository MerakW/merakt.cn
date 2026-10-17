import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const directory = await mkdtemp(join(tmpdir(),'merak-paddock-migration-'))
Object.assign(process.env,{ NODE_ENV:'production', MERAK_AUTO_MIGRATE:'1', PAYLOAD_SECRET:randomUUID()+randomUUID(), DATABASE_URL:'file:'+join(directory,'test.db'),MEDIA_DIR:join(directory,'media'), FLIGHT_SYNC_ENABLED:'0' })
const { getPayload } = await import('payload')
const { default:config } = await import('../src/payload.config')
const payload = await getPayload({config})
try {
 const note = await payload.create({collection:'notes',data:{text:'测试心情',compound:'I',date:new Date().toISOString(),_status:'published'}})
 assert.equal((await payload.findByID({collection:'notes',id:note.id,overrideAccess:false})).compound,'I')
 const settings = await payload.updateGlobal({slug:'site-settings',data:{trackMode:'pit',forzaFerrari:true}})
 assert.equal(settings.trackMode,'pit')
 assert.equal((await payload.findGlobal({slug:'site-settings',overrideAccess:false})).forzaFerrari,true)
 await assert.rejects(payload.updateGlobal({slug:'site-settings',overrideAccess:false,data:{trackMode:'clear'}}))
 const versions = await payload.findVersions({collection:'notes',where:{parent:{equals:note.id}}})
 assert.equal(versions.docs[0].version.compound,'I')
 console.log('PASS: production migrations, compound/version persistence, public track settings, anonymous writes denied')
} finally { await payload.destroy() }
