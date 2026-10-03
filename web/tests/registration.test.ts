import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRegistration } from '../src/lib/flights/registration'
import { publicFlight } from '../src/lib/flights/public'
import { flightSouvenirs } from '../src/lib/flights/souvenirs'
test('registration display inserts known separators and preserves JA, N and unknown formats', () => {
 for (const [raw,expected] of [['B919E','B-919E'],['BHLW','B-HLW'],['9vskp','9V-SKP'],['A6ENB','A6-ENB'],['VNA329','VN-A329'],['JA215A','JA215A'],['N12345','N12345'],['B-919G','B-919G'],['UNKNOWN','UNKNOWN']]) assert.equal(formatRegistration(raw),expected)
})
test('public display and frequency counts merge raw and formatted tail numbers without mutating input', () => {
 const f={importKey:'',visibility:'public' as const,state:'completed' as const,date:'2026-01-01',from:'HGH',to:'PKX',registration:'B919G'}
 const first=publicFlight(f), second=publicFlight({...f,registration:'B-919G'})
 assert.equal(first.registration,'B-919G');assert.equal(f.registration,'B919G')
 assert.deepEqual(flightSouvenirs([first,second],[]).topRegistration,{name:'B-919G',count:2})
})
