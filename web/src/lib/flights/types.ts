export type FlightState = 'planned' | 'completed' | 'cancelled' | 'unconfirmed'
export type Visibility = 'private' | 'public' | 'scheduled'

export interface Airport {
  iata: string
  name: string
  city: string
  country: string
  timeZone: string
  latitude: number
  longitude: number
}

export interface FlightRecord {
  id?: number | string
  importKey: string
  sourceId?: string
  date: string
  hideSchedule?: boolean
  airline?: string
  flightNumber?: string
  from: string
  to: string
  divertedTo?: string
  state: FlightState
  visibility: Visibility
  publishAt?: string
  departureLocal?: string
  arrivalLocal?: string
  departureUTC?: string
  arrivalUTC?: string
  actualDepartureUTC?: string
  actualArrivalUTC?: string
  departureTimeZone?: string
  arrivalTimeZone?: string
  aircraft?: string
  registration?: string
  note?: string
  // Never serialize this field through public endpoints or public components.
  privateDetails?: {
    pnr?: string
    seat?: string
    seatType?: string
    cabinClass?: string
    reason?: string
    sourceRow?: Record<string, string>
  }
}

export interface ImportIssue {
  row: number
  field?: string
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface ImportPreview {
  totalRows: number
  flights: FlightRecord[]
  duplicates: { row: number; firstRow?: number; importKey: string }[]
  issues: ImportIssue[]
  valid: boolean
}
