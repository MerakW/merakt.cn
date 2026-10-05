import type { AircraftModel } from './aircraft'

type Point = readonly [number, number]
export type AircraftLightLayout = {
  profile?: 'boeing-strobe' | 'boeing-led' | 'comac-observed'
  wing: Point
  upperBeacon: Point
  lowerBeacon?: Point
  tail: Point
  tailBright?: boolean
  wingSurface: string
  upperSurface: string
}

// Image-space anchors against the 1600 × 800 assets, not card bounds.
// Far-side lights are occluded. Unresolved lenses remain provisional for review.
const layouts: Record<string, AircraftLightLayout> = {
  C919_white: {
    // COMAC ACAP 02-10, figures 4–5: top / belly red beacons,
    // wing-leading-edge strobes and strobes on either side of the APU compartment.
    // Near-side white lights only. Timing fitted to user-provided 60 fps footage.
    profile: 'comac-observed',
    wing: [910, 454], upperBeacon: [425, 410], lowerBeacon: [713, 575], tail: [1451, 458], tailBright: true,
    wingSurface: '585,518 900,450 924,461 834,496 696,539',
    upperSurface: '290,415 1190,415 1190,456 290,456',
  },
  a320_white: {
    wing: [929, 459], upperBeacon: [668, 405], tail: [1510, 447],
    wingSurface: '516,523 943,455 958,473 829,509 676,523',
    upperSurface: '390,410 1136,410 1136,445 390,445',
  },
  A320_ANA_livery: {
    wing: [929, 459], upperBeacon: [668, 405], tail: [1510, 447],
    wingSurface: '516,523 943,455 958,473 829,509 676,523',
    upperSurface: '390,410 1136,410 1136,445 390,445',
  },
  'A320_china_eastern_thumb_0d85a249-7b4c-43f2-9563-d6aa328ebd3f': {
    // Sharklet housing is at the wing / sharklet junction, not the upper tip.
    wing: [925, 452], upperBeacon: [669, 405], tail: [1504, 447],
    wingSurface: '519,522 952,451 968,464 847,506 683,522',
    upperSurface: '395,410 1138,410 1138,445 395,445',
  },
  A320_NEO_CFM_LEAP_white_sm: {
    wing: [924, 455], upperBeacon: [668, 405], tail: [1510, 447],
    wingSurface: '522,522 951,451 969,463 850,510 680,522',
    upperSurface: '390,410 1136,410 1136,445 390,445',
  },
  airbus_a321_white_cm56_engines: {
    wing: [927, 450], upperBeacon: [700, 405], tail: [1510, 442],
    wingSurface: '565,506 943,446 958,463 840,496 701,510',
    upperSurface: '440,410 1210,410 1210,442 440,442',
  },
  A321_NEO_CFM_LEAP_white_sm: {
    wing: [923, 447], upperBeacon: [700, 405], tail: [1510, 440],
    wingSurface: '575,503 955,444 973,457 870,490 709,507',
    upperSurface: '440,410 1210,410 1210,442 440,442',
  },
  A321_NEO_LR_CFM_LEAP_white_sm: {
    wing: [922, 447], upperBeacon: [700, 405], tail: [1510, 442],
    wingSurface: '575,503 955,444 973,457 870,490 709,507',
    upperSurface: '440,410 1210,410 1210,442 440,442',
  },
  // Widebody positions follow Airbus AC §2-10-0 and each side-view raster.
  // Their pulse timing remains a representative study, pending equipment data.
  'A330-200_RR_white': {
    wing: [978, 462], upperBeacon: [663, 420], tail: [1483, 440],
    wingSurface: '554,511 970,459 991,471 864,506 680,523',
    upperSurface: '390,424 1170,424 1170,454 390,454',
  },
  'A330-300_RR_white': {
    wing: [978, 449], upperBeacon: [688, 412], tail: [1482, 428],
    wingSurface: '589,498 970,446 991,460 879,488 706,508',
    upperSurface: '410,416 1200,416 1200,446 410,446',
  },
  'A330-300_cathay_pacific_2015_livery_thumb_a87f39b3-f2fa-4b48-b4e1-f992249f26b9': {
    wing: [977, 450], upperBeacon: [688, 412], tail: [1482, 428],
    wingSurface: '589,498 970,446 991,460 879,488 706,508',
    upperSurface: '410,416 1200,416 1200,446 410,446',
  },
  'A340-600_white_sm': {
    wing: [982, 433], upperBeacon: [798, 412], tail: [1480, 418],
    wingSurface: '615,477 975,430 992,441 879,469 718,486',
    upperSurface: '500,416 1230,416 1230,441 500,441',
  },
  'A350-900_white': {
    wing: [1004, 430], upperBeacon: [765, 402], lowerBeacon: [720, 548], tail: [1479, 440],
    wingSurface: '584,484 1023,425 1043,436 928,468 742,500',
    upperSurface: '470,406 1220,406 1220,437 470,437',
  },
  'A350-900_singapore_airlines_thumb_eceb8701-2490-48f6-babd-bf487f48004a': {
    wing: [1006, 430], upperBeacon: [765, 402], lowerBeacon: [720, 548], tail: [1479, 440],
    wingSurface: '584,484 1023,425 1043,436 928,468 742,500',
    upperSurface: '470,406 1220,406 1220,437 470,437',
  },
  'A380-800_white': {
    // Two upper beacons are transverse: the far-side unit is occluded here.
    wing: [1039, 508], upperBeacon: [497, 428], tail: [1481, 478],
    wingSurface: '507,554 1047,504 1066,522 953,548 741,569',
    upperSurface: '310,433 1135,433 1135,467 310,467',
  },
  // Boeing timing profiles are visual studies, not verified per-airframe fits.
  // Single white pulses are kept separate from the accepted Airbus double flash.
  '737-800_white_winglets': {
    profile: 'boeing-strobe',
    wing: [916, 485], upperBeacon: [623, 431], tail: [1448, 490],
    wingSurface: '651,526 906,482 926,493 833,527 714,550',
    upperSurface: '320,435 1115,435 1115,472 320,472',
  },
  '737_Max_8_white_sm': {
    profile: 'boeing-led',
    wing: [925, 481], upperBeacon: [623, 431], tail: [1450, 488],
    wingSurface: '667,521 917,477 935,487 849,527 721,549',
    upperSurface: '320,435 1115,435 1115,472 320,472',
  },
  '747-400_pw_white': {
    profile: 'boeing-strobe',
    // Both beacons are visible; the aft strobe sits below the APU exhaust.
    wing: [987, 479], upperBeacon: [335, 392], lowerBeacon: [335, 554], tail: [1453, 466],
    wingSurface: '510,520 977,476 995,486 881,513 700,546',
    upperSurface: '240,396 530,396 600,427 240,427',
  },
  '747-8i_white': {
    profile: 'boeing-led',
    wing: [1108, 460], upperBeacon: [318, 391], lowerBeacon: [318, 540], tail: [1453, 454],
    wingSurface: '562,500 1097,456 1118,465 960,501 729,530',
    upperSurface: '230,395 550,395 635,425 230,425',
  },
  '777-300_white': {
    profile: 'boeing-strobe',
    wing: [977, 440], upperBeacon: [308, 412], lowerBeacon: [735, 541], tail: [1433, 479],
    wingSurface: '690,484 967,436 987,447 868,480 746,516',
    upperSurface: '210,416 1170,416 1170,447 210,447',
  },
  '777-300ER_qatar_airways_livery': {
    profile: 'boeing-strobe',
    wing: [977, 440], upperBeacon: [308, 412], lowerBeacon: [735, 541], tail: [1433, 479],
    wingSurface: '690,484 967,436 987,447 868,480 746,516',
    upperSurface: '210,416 1170,416 1170,447 210,447',
  },
  '777-300_china_eastern_thumb_e301064c-26b6-4f62-98eb-ff50a8e2e30a': {
    profile: 'boeing-strobe',
    wing: [975, 441], upperBeacon: [308, 412], lowerBeacon: [733, 541], tail: [1431, 479],
    wingSurface: '690,484 966,437 986,448 868,480 746,516',
    upperSurface: '210,416 1170,416 1170,447 210,447',
  },
  '787-8_white': {
    profile: 'boeing-led',
    wing: [1000, 431], upperBeacon: [372, 417], lowerBeacon: [470, 573], tail: [1460, 487],
    wingSurface: '699,499 990,427 1010,439 869,490 750,547',
    upperSurface: '260,421 1170,421 1170,457 260,457',
  },
  '787-8_ANA_livery': {
    profile: 'boeing-led',
    wing: [1000, 431], upperBeacon: [372, 417], lowerBeacon: [470, 573], tail: [1460, 487],
    wingSurface: '699,499 990,427 1010,439 869,490 750,547',
    upperSurface: '260,421 1170,421 1170,457 260,457',
  },
  '787-9_white': {
    profile: 'boeing-led',
    wing: [992, 426], upperBeacon: [345, 416], lowerBeacon: [509, 558], tail: [1458, 481],
    wingSurface: '714,488 982,423 1002,435 881,484 760,533',
    upperSurface: '245,420 1195,420 1195,450 245,450',
  },
  '787-10_white_sm': {
    profile: 'boeing-led',
    wing: [985, 425], upperBeacon: [335, 415], lowerBeacon: [542, 545], tail: [1460, 477],
    wingSurface: '735,481 975,422 995,434 889,476 783,524',
    upperSurface: '230,419 1210,419 1210,447 230,447',
  },
}

export function aircraftLightLayout(model: AircraftModel): AircraftLightLayout | undefined {
  if (model.family) return undefined
  const asset = model.file.split('/').at(-1)?.split('.webp')[0]
  return asset ? layouts[asset] : undefined
}
