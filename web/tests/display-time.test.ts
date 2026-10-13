import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flightTime, arrivalDelayMinutes } from '../src/lib/flights/display-time'
import { publicFlight } from '../src/lib/flights/public'
const base = {importKey:'',visibility:'public' as const,state:'completed' as const,date:'2026-09-23',from:'PKX',to:'SHA',departureLocal:'2026-09-23T16:40',arrivalLocal:'2026-09-23T19:00',departureTimeZone:'Asia/Shanghai',arrivalTimeZone:'Asia/Shanghai',actualDepartureUTC:'2026-09-23T08:36:00Z',actualArrivalUTC:'2026-09-23T10:24:00Z'}
test('actual gate times use airport local time and independently fall back to schedule', () => {
 const f=publicFlight(base)
 assert.equal(flightTime(f,'departure').clock,'16:36')
 assert.equal(flightTime({...f,state:'unconfirmed'},'departure').clock,'16:36')
 assert.equal(flightTime(f,'arrival').clock,'18:24')
 assert.equal(flightTime({...f,actualArrivalUTC:undefined},'arrival').label,'计划到达')
 assert.equal(flightTime({...f,actualArrivalUTC:undefined},'arrival').clock,'19:00')
 assert.equal(flightTime({...f,arrivalTimeZone:'America/Los_Angeles',actualArrivalUTC:'2026-09-24T03:00:00Z'},'arrival').local,'2026-09-23T20:00')
})
test('future plans and masked dates never select actual timestamps', () => {
 const f=publicFlight({...base,state:'planned',hideSchedule:true})
 assert.equal(flightTime(f,'departure').clock,'16:40')
 assert.equal(flightTime(f,'departure').local,undefined)
 assert.equal(flightTime(f,'arrival').label,'计划到达')
})

test('diverted actual arrival uses the landed airport zone while schedule keeps original destination', () => {
 const f=publicFlight({...base,to:'HND',divertedTo:'HGH',arrivalTimeZone:'Asia/Tokyo'})
 assert.equal(flightTime(f,'arrival').clock,'18:24')
 assert.equal(flightTime(f,'arrival').timeZone,'Asia/Shanghai')
 assert.equal(flightTime({...f,actualArrivalUTC:undefined},'arrival').timeZone,'Asia/Tokyo')
})

test('radar-only flights show actual runway facts until gate calibration becomes available', () => {
 const f=publicFlight({...base,actualDepartureUTC:undefined,actualArrivalUTC:undefined,takeoffUTC:'2026-09-23T08:45:00Z',touchdownUTC:'2026-09-23T10:20:00Z'})
 assert.equal(flightTime(f,'departure').label,'实际起飞')
 assert.equal(flightTime(f,'arrival').label,'实际接地')
 assert.equal(flightTime(f,'arrival').clock,'18:20')
 assert.equal(flightTime({...f,actualArrivalUTC:'2026-09-23T10:30:00Z'},'arrival').label,'实际到达')
 assert.equal(flightTime({...f,state:'planned'},'arrival').label,'计划到达')
})

test('arrival delays compare absolute instants with safe missing data and minute boundaries', () => {
 const f=publicFlight({...base,arrivalUTC:'2026-09-23T23:50:00Z',actualArrivalUTC:'2026-09-24T00:10:00Z'})
 assert.equal(arrivalDelayMinutes(f),20)
 assert.equal(arrivalDelayMinutes({...f,actualArrivalUTC:'2026-09-23T23:59:59Z'}),9)
 assert.equal(arrivalDelayMinutes({...f,actualArrivalUTC:'2026-09-24T00:00:00Z'}),10)
 assert.equal(arrivalDelayMinutes({...f,actualArrivalUTC:'2026-09-23T23:40:00Z'}),0)
 assert.equal(arrivalDelayMinutes({...f,arrivalUTC:undefined}),0)
 assert.equal(arrivalDelayMinutes({...f,actualArrivalUTC:'invalid'}),0)
 assert.equal(arrivalDelayMinutes({...f,state:'planned'}),0)
 assert.equal(arrivalDelayMinutes({...f,dateHidden:true}),0)
})
