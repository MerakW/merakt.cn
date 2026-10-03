import test from 'node:test'
import assert from 'node:assert/strict'
import { flightCollection, matchesCollection } from '../src/lib/flights/collection'
const flight = (aircraft:string, airline='CES',date='2025-01-01',state='completed')=>({aircraft,airline,date,state})
test('families merge variants and prefer the newer representative without counting cancelled flights',()=>{
 const data=flightCollection([flight('Airbus A319'),flight('Airbus A321neo'),flight('Boeing 737 MAX 8'),flight('Boeing 737-800'),flight('Boeing 787-9','ANA','2025-01-01','cancelled')])
 assert.equal(data.families.length,2)
 assert.equal(data.families.find(f=>f.key==='A320')?.count,2)
 assert.equal(data.families.find(f=>f.key==='A320')?.model,'Airbus A321neo LR')
 assert.equal(data.families.find(f=>f.key==='737')?.model,'Boeing 737 MAX 8')
 assert.equal(matchesCollection(flight('Airbus A319'),{kind:'family',key:'A320',label:'A320 family'}),true)
})
test('historical alliance groups and their filters agree',()=>{
 const before=flight('Airbus A320','CSN','2018-01-01'),after=flight('Airbus A320','CSN','2025-01-01')
 const data=flightCollection([before,after])
 assert.deepEqual(data.carriers.map(c=>c.alliance),['skyteam','others'])
 const filter={kind:'carrier' as const,key:'CSN',label:'南航',alliance:'others'}
 assert.equal(matchesCollection(before,filter),false)
 assert.equal(matchesCollection(after,filter),true)
})
