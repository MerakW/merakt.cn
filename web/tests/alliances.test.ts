import test from 'node:test'
import assert from 'node:assert/strict'
import {flightAlliance} from '../src/lib/flights/alliances'

test('flight numbers include the appropriate alliance without assigning independent carriers',()=>{
  for(const airline of ['CES','CSH','CXA','HVN']) assert.equal(flightAlliance({airline})?.key,'skyteam')
  for(const airline of ['CCA','ANA','SIA']) assert.equal(flightAlliance({airline})?.key,'star')
  for(const airline of ['CPA','QTR']) assert.equal(flightAlliance({airline})?.key,'oneworld')
  for(const airline of ['UAE','CSC','VJC','TGW','CSN']) assert.equal(flightAlliance({airline}),undefined)
  assert.equal(flightAlliance({flightNumber:'MU5194'})?.key,'skyteam')
})
test('historical memberships and connecting partners remain distinguishable',()=>{
  assert.equal(flightAlliance({airline:'HDA',date:'2012-01-22'})?.key,'oneworld')
  assert.equal(flightAlliance({airline:'HDA',date:'2026-01-01'}),undefined)
  assert.equal(flightAlliance({airline:'CSN',date:'2018-01-01'})?.key,'skyteam')
  assert.match(flightAlliance({airline:'CSN',date:'2019-01-01'})!.name,/过渡期/)
  assert.equal(flightAlliance({airline:'CSN',date:'2020-01-01'}),undefined)
  assert.equal(flightAlliance({airline:'CXA',date:'2012-01-01'}),undefined)
  assert.match(flightAlliance({airline:'DKH'})!.name,/优连伙伴/)
})
