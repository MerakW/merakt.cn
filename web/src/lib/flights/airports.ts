import data from '@/data/airports.json'
import type { Airport } from './types'

export const airports = data as Airport[]
export const airportMap = new Map(airports.map(airport => [airport.iata, airport]))
export function getAirport(code: string) { return airportMap.get(code) }
