// Heat measures how far a value runs past its limit, from 0 (at the limit)
// to 1 (the most drastic level). Colors climb from hot orange through red
// and crimson to violet, so larger overruns read as more severe.
export type HeatTier = 0 | 1 | 2 | 3

const STOPS: Array<[number, [number, number, number]]> = [
  [0, [255, 138, 31]],
  [1 / 3, [255, 69, 32]],
  [2 / 3, [255, 45, 85]],
  [1, [193, 60, 255]],
]

export const clampHeat = (value: number) => Math.min(Math.max(value, 0), 1)

export function heatTier(heat: number): HeatTier {
  if (heat <= 0) return 0
  return heat < 1 / 3 ? 1 : heat < 2 / 3 ? 2 : 3
}

export function heatColor(heat: number) {
  const value = clampHeat(heat)
  const index = Math.min(Math.floor(value * 3), STOPS.length - 2)
  const [from, start] = STOPS[index]
  const [to, end] = STOPS[index + 1]
  const ratio = (value - from) / (to - from)
  const channels = start.map((channel, i) =>
    Math.round(channel + (end[i] - channel) * ratio),
  )
  return `rgb(${channels.join(' ')})`
}

export const DAY_HEAT_LABELS = [
  '',
  'Overtime',
  'Heavy overtime',
  'Extreme overtime',
] as const
export const GOAL_HEAT_LABELS = [
  '',
  'Over goal',
  'Well over goal',
  'Far over goal',
] as const
