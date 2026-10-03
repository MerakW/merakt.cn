import { flightIdentity } from './airlines'

export type FlightAircraft = { aircraft?: string | null; airline?: string | null; flightNumber?: string | null; registration?: string | null }
export type AircraftModel = { file: string; livery: string; family: boolean }
const models: Record<string, string> = {
  '737800': '737-800_white_winglets', '737MAX8': '737_Max_8_white_sm',
  '747400': '747-400_pw_white', '7478': '747-8i_white', '7478I': '747-8i_white',
  '777300': '777-300_white', '777300ER': '777-300_white',
  '7878': '787-8_white', '7879': '787-9_white', '78710': '787-10_white_sm',
  A320: 'a320_white', A320NEO: 'A320_NEO_CFM_LEAP_white_sm',
  A321: 'airbus_a321_white_cm56_engines', A321NEO: 'A321_NEO_LR_CFM_LEAP_white_sm', A321LR: 'A321_NEO_LR_CFM_LEAP_white_sm', A321NEOLR: 'A321_NEO_LR_CFM_LEAP_white_sm',
  A330200: 'A330-200_RR_white', A330300: 'A330-300_RR_white', A340600: 'A340-600_white_sm',
  A350900: 'A350-900_white', A380: 'A380-800_white', A380800: 'A380-800_white', C919: 'C919_white',
}
const liveries: Record<string, { key: string; file: string }> = {
  'A32:MU': {key:'A320',file:'A320_china_eastern_thumb_0d85a249-7b4c-43f2-9563-d6aa328ebd3f'},
  'A32:NH': {key:'A320',file:'A320_ANA_livery'},
  '787:NH': {key:'7878',file:'787-8_ANA_livery'},
  '777:QR': {key:'777300ER',file:'777-300ER_qatar_airways_livery'},
  '777:MU': {key:'777300',file:'777-300_china_eastern_thumb_e301064c-26b6-4f62-98eb-ff50a8e2e30a'},
  'A330:CX': {key:'A330300',file:'A330-300_cathay_pacific_2015_livery_thumb_a87f39b3-f2fa-4b48-b4e1-f992249f26b9'},
  'A350:SQ': {key:'A350900',file:'A350-900_singapore_airlines_thumb_eceb8701-2490-48f6-babd-bf487f48004a'},
}
const aliases: Record<string, string> = { A319N:'A319NEO', A320N:'A320NEO', A321N:'A321NEO', A21N:'A321NEO', A20N:'A320NEO', '788':'7878', '789':'7879', '78X':'78710', '773':'777300', '77W':'777300ER', '738':'737800', '7M8':'737MAX8', '744':'747400', '748':'7478', A332:'A330200', A333:'A330300', A359:'A350900', A388:'A380800' }
export function aircraftModel(flight: FlightAircraft): AircraftModel | undefined {
  const raw = (flight.aircraft || '').toUpperCase().replace(/BOEING|AIRBUS|COMAC/g, '').replace(/[^A-Z0-9]/g, '')
  if (!raw) return undefined
  const key = aliases[raw] || raw.replace(/^B(?=7)/,'')
  let nearest = key
  if (!models[key]) {
    if (/^A31[89]|^A32/.test(key)) nearest = /NEO|N$/.test(key) ? 'A320NEO' : 'A320'
    else if (key.startsWith('737')) nearest = /MAX/.test(key) ? '737MAX8' : '737800'
    else if (key.startsWith('787')) nearest = '7879'
    else if (key.startsWith('777')) nearest = '777300'
    else if (key.startsWith('747')) nearest = '747400'
    else if (key.startsWith('A330')) nearest = key.includes('800') ? 'A330200' : 'A330300'
    else if (key.startsWith('A350')) nearest = 'A350900'
    else if (key.startsWith('A340')) nearest = 'A340600'
    else if (key.startsWith('A380')) nearest = 'A380800'
    else if (/^757/.test(key)) nearest = 'A321'
    else if (/^767|^A30|^A310/.test(key)) nearest = 'A330200'
    else if (/^E1|^E2|^EMBRAER|^CRJ|^ARJ|^C909/.test(key)) nearest = 'A320'
    else return undefined
  }
  const family = nearest.startsWith('A32') ? 'A32' : nearest.startsWith('A') ? nearest.slice(0,4) : nearest.slice(0,3)
  const airline = flightIdentity(flight).airline
  const painted = liveries[`${family}:${airline?.iata}`]
  return { file: `/aircraft/${painted?.file || models[nearest]}.webp?v=2`, livery: painted ? `${airline!.name}涂装` : '白模', family: (painted?.key || nearest) !== key }
}
