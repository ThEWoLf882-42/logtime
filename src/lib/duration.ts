/** Keep small positive amounts visible instead of rounding them to zero hours. */
export function durationParts(hours: number) {
  const seconds = Number((hours * 3600).toPrecision(3))
  if (hours > 0 && seconds < 60) return { value: String(seconds), unit: 's' }
  if (hours > 0 && hours < 0.1)
    return { value: String(Number((hours * 60).toFixed(1))), unit: 'min' }
  return { value: hours.toFixed(1), unit: 'h' }
}

export function formatDuration(hours: number, trim = false) {
  const { value, unit } = durationParts(hours)
  return `${trim ? Number(value) : value} ${unit}`
}
