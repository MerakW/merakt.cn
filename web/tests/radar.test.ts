import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET, POST } from '../src/app/(frontend)/api/radar/route'

test('automatic Singapore origins use SIN instead of nearby air bases or Seletar', async () => {
  for (const [lat, lon] of [[1.3521, 103.8198], [1.36042, 103.91000], [1.38726, 103.70900], [1.41695, 103.86800]]) {
    const response = await POST(new Request('http://localhost/api/radar', {
      method: 'POST', body: JSON.stringify({ lat, lon }),
    }))
    assert.equal(response.status, 200)
    const route = await response.json()
    assert.equal(route.airport, 'SIN')
    assert.equal(route.city, 'Singapore')
    assert.ok(route.km > 3000 && route.km < 4000)
  }
})

test('automatic locations outside Singapore and manual airport choices remain intact', async () => {
  const response = await POST(new Request('http://localhost/api/radar', {
    method: 'POST', body: JSON.stringify({ lat: 30.2295, lon: 120.434 }),
  }))
  assert.equal((await response.json()).airport, 'HGH')
  for (const airport of ['SIN', 'XSP', 'HND']) {
    const response = GET(new Request(`http://localhost/api/radar?airport=${airport}`))
    assert.equal((await response.json()).airport, airport)
  }
  assert.equal(GET(new Request('http://localhost/api/radar?airport=ZZZ')).status, 400)
})

test('multi-airport city defaults are explicit, including Beijing and Taipei', async () => {
  const examples: [string, number, number, string, string[]][] = [
    ['Beijing',39.9042,116.4074,'PEK',['PEK','PKX']],
    ['Taipei City',25.0330,121.5654,'TPE',['TPE','TSA']],
    ['Shanghai',31.2304,121.4737,'PVG',['PVG','SHA']],
    ['Tokyo',35.6762,139.6503,'HND',['HND','NRT']],
    ['London',51.5074,-0.1278,'LHR',['LHR','LGW','LCY','LTN','STN','SEN']],
    ['New York',40.7128,-74.0060,'JFK',['JFK','EWR','LGA']],
  ]
  for (const [city,lat,lon,expected,alternatives] of examples) {
    const response = await POST(new Request('http://localhost/api/radar', {
      method:'POST',body:JSON.stringify({lat,lon,city}),
    }))
    const route = await response.json()
    assert.equal(route.airport, expected, city)
    assert.deepEqual(route.airports, alternatives, city)
    assert.equal(route.automatic, true)
    assert.equal(route.km % 10, 0)
    assert.equal(route.minutes % 5, 0)
  }
})

test('manual secondary airports stay selected and unrelated cities do not inherit metro defaults', async () => {
  for (const airport of ['PKX','TSA','XSP','SHA','NRT','LGW','EWR']) {
    const response = GET(new Request(`http://localhost/api/radar?airport=${airport.toLowerCase()}`))
    const route = await response.json()
    assert.equal(route.airport, airport)
    assert.equal(route.automatic, false)
  }
  const response = await POST(new Request('http://localhost/api/radar', {
    method:'POST',body:JSON.stringify({lat:52.05,lon:0.2,city:'Cambridge'}),
  }))
  const route = await response.json()
  assert.notEqual(route.airport,'LHR')
  assert.deepEqual(route.airports,[route.airport])
})

test('near Hangzhou uses the nearby state for both IP locations and HGH, with a real boundary', async () => {
  for (const [lat,lon] of [[30.26,120.16],[30.2741,120.1551],[30.2295,120.434]]) {
    const response = await POST(new Request('http://localhost/api/radar', {
      method:'POST',body:JSON.stringify({lat,lon}),
    }))
    const route = await response.json()
    assert.equal(route.local,true)
    assert.equal(route.airport,'HGH')
  }
  assert.equal((await GET(new Request('http://localhost/api/radar?airport=HGH')).json()).local,true)
  const response = await POST(new Request('http://localhost/api/radar', {
    method:'POST',body:JSON.stringify({lat:30.8,lon:120.1551}),
  }))
  assert.equal((await response.json()).local,false)
})

test('invalid locations and oversized input are rejected instead of calculating an origin', async () => {
  for (const body of ['null','{}','{"lat":null,"lon":120}','{"lat":91,"lon":120}','{"lat":30,"lon":181}','{"lat":30,"lon":120,"city":4}']) {
    const response = await POST(new Request('http://localhost/api/radar',{method:'POST',body}))
    assert.equal(response.status,400,body)
  }
  assert.equal((await POST(new Request('http://localhost/api/radar',{method:'POST',body:' '.repeat(513)}))).status,413)
  assert.equal(GET(new Request('http://localhost/api/radar')).status,400)
})
