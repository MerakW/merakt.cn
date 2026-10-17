import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compoundFor, readingLabel, richTextContent, trackStatus } from '../src/lib/paddock'
import { buildAge, validLatencySamples } from '../src/lib/telemetry'
test('compounds use body text and preserve an editorial mood override',()=>{
 assert.equal(compoundFor('短评'),'S')
 assert.equal(compoundFor('字'.repeat(900)),'M')
 assert.equal(compoundFor('字'.repeat(3001)),'H')
 assert.equal(compoundFor('字'.repeat(5000),'I'),'I')
 assert.equal(compoundFor('短评','toString'),'S')
 assert.equal(readingLabel('字'.repeat(299)),'< 1 MIN')
 assert.equal(richTextContent({root:{children:[{children:[{text:'真实正文'},{text:'继续'}]}]}}),'真实正文 继续')
})
test('race weekend uses circuit-local dates, maintenance takes priority, no yearly recurrence',()=>{
 assert.equal(trackStatus(new Date('2026-09-03T22:00:00Z')).label,'RACE WEEK · MNZ')
 assert.equal(trackStatus(new Date('2026-09-03T22:00:00Z')).forza,true)
 assert.equal(trackStatus(new Date('2026-09-06T22:00:00Z')).label,'TRACK CLEAR')
 assert.equal(trackStatus(new Date('2026-10-09T00:00:00Z')).label,'RACE WEEK · SGP')
 assert.equal(trackStatus(new Date('2026-10-09T00:00:00Z'),'pit',true).label,'IN PIT')
 assert.equal(trackStatus(new Date('2026-10-09T00:00:00Z'),'vsc').forza,false)
 assert.equal(trackStatus(new Date('2026-10-09T00:00:00Z'),'clear').label,'TRACK CLEAR')
 assert.equal(trackStatus(new Date('2027-10-09T00:00:00Z')).label,'TRACK CLEAR')
})
test('telemetry excludes stale, future, malformed and negative readings',()=>{
 const now=Date.parse('2026-10-16T06:00:00Z')
 assert.deepEqual(validLatencySamples([{at:'2026-10-16T05:00:00Z',ms:123},{at:'2026-10-14T05:00:00Z',ms:23},{at:'2026-10-17T05:00:00Z',ms:45},{at:'bad',ms:5},{at:'2026-10-16T05:00:00Z',ms:-1}],now),[{at:'2026-10-16T05:00:00Z',ms:123}])
 assert.equal(buildAge(undefined,now),null)
 assert.equal(buildAge('2026-10-17T06:00:00Z',now),null)
 assert.equal(buildAge('2026-10-02T06:00:00Z',now),14)
})

test('manual safety car and race preview modes do not depend on the current date',()=>{
 assert.equal(trackStatus(new Date(0),'sc').label,'SAFETY CAR')
 assert.equal(trackStatus(new Date(0),'race',false,'SGP').label,'RACE WEEK · SGP')
 assert.equal(trackStatus(new Date(0),'race',false,'MNZ').forza,true)
 assert.equal(trackStatus(new Date(0),'race',false,'invalid').label,'RACE WEEK · SGP')
})
