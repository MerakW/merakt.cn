/** Saved-model suggestions use real SQLite queries against disposable synthetic media. */
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { exifFixture } from './photo-exif-fixture'

const directory = await mkdtemp(join(tmpdir(), 'merak-equipment-'))
Object.assign(process.env, { NODE_ENV: 'production', MERAK_AUTO_MIGRATE: '1', PAYLOAD_SECRET: randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), FLIGHT_SYNC_ENABLED: '0' })
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { savedValueOptions, mediaSavedFields, flightSavedFields } = await import('../src/lib/saved-values')
const equipmentOptions = savedValueOptions('media', mediaSavedFields)
const flightOptions = savedValueOptions('flights', flightSavedFields)
const { default: sharp } = await import('sharp')
const payload = await getPayload({ config })
const request = (field: string, user?: unknown) => ({ url: 'http://localhost/api/media/saved-values?field=exposure.' + field, payload, user }) as PayloadRequest
try {
  const user = await payload.create({ collection:'users', data:{name:'器材测试',email:'equipment@example.test',password:randomUUID()} })
  const image = await sharp({create:{width:2,height:2,channels:3,background:'#aaccee'}}).png().toBuffer()
  async function save(camera: string, lens: string) {
    return payload.create({collection:'media',data:{alt:'synthetic fixture',visibility:'private',exposure:{camera,lens}},file:{data:image,name:randomUUID()+'.png',mimetype:'image/png',size:image.length}})
  }
  const record = await save('Canon EOS R5','RF 24-70mm F2.8')
  await save(' Canon EOS R5 ','RF 24-70mm F2.8')
  await save('','')
  const cameras = await equipmentOptions(request('camera',user))
  assert.equal(cameras.status,200)
  assert.match(cameras.headers.get('Cache-Control')!,/no-store/)
  assert.deepEqual(await cameras.json(),{options:['Canon EOS R5']})
  assert.deepEqual(await (await equipmentOptions(request('lens',user))).json(),{options:['RF 24-70mm F2.8']})
  await save('Sony A7 IV','FE 35mm F1.4 GM')
  assert.deepEqual(await (await equipmentOptions(request('camera',user))).json(),{options:['Canon EOS R5','Sony A7 IV']})
  assert.equal((await equipmentOptions(request('camera'))).status,401)
  assert.equal((await equipmentOptions(request('alt',user))).status,400)
  const selected = await payload.update({collection:'media',id:record.id,data:{exposure:{camera:'Sony A7 IV',lens:'FE 35mm F1.4 GM'}}})
  assert.equal(selected.exposure?.camera,'Sony A7 IV')
  assert.equal(selected.exposure?.lens,'FE 35mm F1.4 GM')
  const flight = await payload.create({collection:'flights',draft:true,data:{_status:'draft',aircraft:'Airbus A350-900',aircraftCode:'A359',registration:'B-TEST',airline:'Test Airways'}})
  for (const [field, expected] of [['aircraft','Airbus A350-900'],['aircraftCode','A359'],['registration','B-TEST'],['airline','Test Airways']]) {
    const req = {url:'http://localhost/api/flights/saved-values?field='+field,payload,user} as PayloadRequest
    assert.deepEqual(await (await flightOptions(req)).json(),{options:[expected]})
  }
  assert.equal((await flightOptions({url:'http://localhost/api/flights/saved-values?field=privateDetails',payload,user} as PayloadRequest)).status,400)
  assert.ok(flight.id)
  const exifImage = await exifFixture()
  const exifFile = {data:exifImage,name:randomUUID()+'.jpg',mimetype:'image/jpeg',size:exifImage.length}
  const detected = await payload.create({collection:'media',data:{alt:'synthetic EXIF fixture',visibility:'private',exposure:{lens:'Manual lens'}},file:exifFile})
  assert.deepEqual(detected.exposure,{medium:'digital',camera:'Canon EOS R5',lens:'Manual lens',focalLength:'85 mm',shutter:'1/250',aperture:'2.8',iso:400,filmStock:null})
  const edited = await payload.update({collection:'media',id:detected.id,data:{exposure:{camera:'Manual camera',iso:800}}})
  assert.equal(edited.exposure?.camera,'Manual camera')
  assert.equal(edited.exposure?.iso,800)
  const replaced = await payload.update({collection:'media',id:detected.id,data:{alt:'replacement'},file:{...exifFile,name:randomUUID()+'.jpg'}})
  assert.equal(replaced.exposure?.camera,'Manual camera')
  assert.equal(replaced.exposure?.iso,800)
  assert.equal(replaced.exposure?.lens,'Manual lens')
  const film = await payload.create({collection:'media',data:{alt:'synthetic film scan',visibility:'private',exposure:{medium:'film',camera:'Film camera',filmStock:'Test Film'}},file:{...exifFile,name:randomUUID()+'.jpg'}})
  assert.equal(film.exposure?.camera,'Film camera')
  assert.equal(film.exposure?.filmStock,'Test Film')
  assert.ok(film.exposure?.iso == null)
  console.log('PASS: EXIF automatically fills uploads; manual values, replacement uploads and film settings stay intact.')
  console.log('PASS: saved camera/lens history, deduplication, new models, reuse, authenticated access and no-store responses.')
} finally { await payload.destroy() }
