import { test } from 'node:test'
import assert from 'node:assert/strict'
import { endpointDistance, flightSouvenirs } from '../src/lib/flights/souvenirs'
import { publicFlight } from '../src/lib/flights/public'
import type { Airport, FlightRecord } from '../src/lib/flights/types'

const flight = (extra: Partial<FlightRecord> = {}) => publicFlight({ importKey: '', visibility: 'public', date: '2026-01-01', state: 'completed', from: 'AAA', to: 'BBB', ...extra })
const airport = (iata: string, longitude: number): Airport => ({ iata, longitude, latitude: 0, city: iata, name: iata, country: '', timeZone: 'UTC' })
const airports = [airport('AAA', 0), airport('BBB', 1), airport('CCC', 10)]

test('souvenirs exclude plans and cancellations; reverse legs count as one route and two flights', () => {
  const stats = flightSouvenirs([flight(), flight({ from: 'BBB', to: 'AAA' }), flight({ state: 'cancelled', to: 'CCC' }), flight({ state: 'planned', date: '2010-01-01' }), flight({ state: 'unconfirmed' })], airports)
  assert.equal(stats.count, 2); assert.equal(stats.familiar?.count, 2)
  assert.equal(stats.distanceCount, 2); assert.ok(Math.abs(stats.totalKm - 222.39) < 1)
  assert.deepEqual(stats.airports.map(a => a.code), ['AAA', 'BBB'])
  assert.equal(stats.first?.date, '2026-01-01')
})
test('diversion uses landed airport for stamps, routes and distance', () => {
  const stats = flightSouvenirs([flight({ divertedTo: 'CCC' })], airports)
  assert.deepEqual(stats.airports.map(a => a.code), ['AAA', 'CCC'])
  assert.equal(stats.familiar?.to, 'CCC')
  assert.ok(Math.abs(stats.farthest!.km - 1111.95) < 1)
})
test('missing and invalid coordinates do not invent distance; earliest uses chronology', () => {
  const stats = flightSouvenirs([flight(), flight({ date: '2012-01-01', to: 'ZZZ' })], airports)
  assert.equal(stats.first?.date, '2012-01-01'); assert.equal(stats.farthest?.flight.to, 'BBB')
  assert.equal(stats.distanceCount, 1); assert.equal(stats.airports.find(a => a.code === 'AAA')?.firstDate, '2012-01-01')
  assert.equal(endpointDistance(undefined, airports[0]), null)
  assert.equal(endpointDistance({ ...airports[0], latitude: 91 }, airports[1]), null)
  assert.equal(flightSouvenirs([], airports).farthest, null)
  assert.equal(flightSouvenirs([flight({ state: 'planned' })], airports).first, null)
})
test('great-circle distance takes the short path across the date line', () => {
  assert.ok(Math.abs(endpointDistance(airport('AAA', 179), airport('BBB', -179))! - 222.39) < 1)
})

test('frequent-route flight number counts both prefixes and excludes other routes', () => {
 const stats=flightSouvenirs([flight({airline:'CES',flightNumber:'5148'}),flight({airline:'CES',flightNumber:'MU5148'}),flight({airline:'CCA',flightNumber:'123'}),flight({airline:'CES',flightNumber:'999',to:'CCC'})],airports)
 assert.equal(stats.mostFlown?.count,2)
 assert.equal(stats.mostFlown?.flight.flightNumber,'5148')
})

test('carrier statistics normalize aliases and ignore incomplete flights and empty aircraft fields', () => {
 const stats=flightSouvenirs([flight({airline:'CES',flightNumber:'1',aircraft:'A320',registration:'b-1234'}),flight({airline:'MU',flightNumber:'2',aircraft:'A320',registration:'B-1234'}),flight({airline:'CCA',flightNumber:'3'}),flight({airline:'CSH',flightNumber:'4',state:'planned'})],airports)
 assert.equal(stats.airlineCount,2)
 assert.deepEqual(stats.topAirline,{name:'中国东方航空',count:2})
 assert.deepEqual(stats.topAircraft,{name:'A320',count:2})
 assert.deepEqual(stats.topRegistration,{name:'B-1234',count:2})
})
