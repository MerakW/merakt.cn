import type { AircraftModel } from './aircraft'

type Point = readonly [number, number]
export type AircraftLightLayout = {
  wing: Point
  upperBeacon: Point
  wingSurface: string
  upperSurface: string
}

// Image-space anchors against the 1600 × 800 assets, not card bounds.
// The far wing / lower beacon are occluded; the rear-facing tail light is cropped.
const layouts: Record<string, AircraftLightLayout> = {
  a320_white: {
    wing: [949, 459], upperBeacon: [668, 405],
    wingSurface: '516,523 943,455 958,473 829,509 676,523',
    upperSurface: '390,410 1136,410 1136,445 390,445',
  },
  A320_ANA_livery: {
    wing: [949, 459], upperBeacon: [668, 405],
    wingSurface: '516,523 943,455 958,473 829,509 676,523',
    upperSurface: '390,410 1136,410 1136,445 390,445',
  },
  'A320_china_eastern_thumb_0d85a249-7b4c-43f2-9563-d6aa328ebd3f': {
    // Sharklet housing is at the wing / sharklet junction, not the upper tip.
    wing: [957, 452], upperBeacon: [669, 405],
    wingSurface: '519,522 952,451 968,464 847,506 683,522',
    upperSurface: '395,410 1138,410 1138,445 395,445',
  },
}

export function aircraftLightLayout(model: AircraftModel): AircraftLightLayout | undefined {
  if (model.family) return undefined
  const asset = model.file.split('/').at(-1)?.split('.webp')[0]
  return asset ? layouts[asset] : undefined
}
