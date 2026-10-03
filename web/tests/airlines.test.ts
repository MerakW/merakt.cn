import {test} from 'node:test'
import assert from 'node:assert/strict'
import {flightIdentity} from '../src/lib/flights/airlines'
test('flight labels normalize numeric, IATA and ICAO inputs without duplicate prefixes',()=>{
 assert.equal(flightIdentity({airline:'CES',flightNumber:'5148'}).label,'MU5148')
 assert.equal(flightIdentity({airline:'CES',flightNumber:'MU 5148'}).label,'MU5148')
 assert.equal(flightIdentity({airline:'CSHD',flightNumber:'CSH1234'}).label,'FM1234')
 assert.equal(flightIdentity({airline:'CSC',flightNumber:'3U8888'}).icao,'CSC8888')
 assert.equal(flightIdentity({airline:'UNKNOWN',flightNumber:'XY123'}).label,'XY123')
 assert.equal(flightIdentity({airline:'CES'}).label,'航班未记录')
})
