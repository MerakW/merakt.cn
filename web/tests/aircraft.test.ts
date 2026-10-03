import test from 'node:test'
import assert from 'node:assert/strict'
import { aircraftModel } from '../src/lib/flights/aircraft'

test('prefers available airline liveries within the aircraft family', () => {
  assert.match(aircraftModel({aircraft:'Airbus A321neo',airline:'CES'})!.file, /A320_china_eastern/)
  assert.match(aircraftModel({aircraft:'Boeing 787-9',airline:'ANA'})!.file, /787-8_ANA/)
  assert.equal(aircraftModel({aircraft:'Boeing 787-9',airline:'ANA'})!.family,true)
  assert.match(aircraftModel({aircraft:'Airbus A330-200',airline:'CPA'})!.file,/cathay/)
  assert.match(aircraftModel({aircraft:'Airbus A350-900',airline:'SIA'})!.file,/singapore/)
  assert.match(aircraftModel({aircraft:'Boeing 737-800',airline:'CES'})!.file,/737-800_white/)
})
test('uses the nearest available model and accepts common short codes', () => {
  for(const aircraft of ['A319n','Airbus A319neo']) assert.match(aircraftModel({aircraft})!.file,/A320_NEO/)
  assert.match(aircraftModel({aircraft:'Boeing 737-700'})!.file,/737-800/)
  assert.match(aircraftModel({aircraft:'Airbus A330'})!.file,/A330-300/)
  assert.match(aircraftModel({aircraft:'Airbus A321neo'})!.file,/A321_NEO_LR/)
  assert.match(aircraftModel({aircraft:'789',airline:'ANA'})!.file,/787-8_ANA/)
  assert.match(aircraftModel({aircraft:'788'})!.file,/787-8_white/)
  assert.match(aircraftModel({aircraft:'773',airline:'CES'})!.file,/777-300_china/)
  assert.match(aircraftModel({aircraft:'Comac C919'})!.file,/C919/)
  for(const aircraft of ['Unknown',undefined]) assert.equal(aircraftModel({aircraft}),undefined)
})

test('registration illustration uses a record with a known aircraft', async () => {
  const { flightSouvenirs } = await import('../src/lib/flights/souvenirs')
  const { publicFlight } = await import('../src/lib/flights/public')
  const base = {importKey:'test',date:'2025-01-01',from:'HGH',to:'PKX',state:'completed' as const,visibility:'public' as const,registration:'B919E'}
  const result=flightSouvenirs([publicFlight(base),publicFlight({...base,date:'2025-02-01',aircraft:'Comac C919'})],[])
  assert.equal(result.topRegistrationFlight?.aircraft,'Comac C919')
  assert.equal(result.topRegistration?.count,2)
})
