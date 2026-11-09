import { describe, expect, it } from 'vitest'
import { durationParts, formatDuration } from './duration'

describe('small durations', () => {
  it.each([
    [24, '24.0 h'],
    [0, '0.0 h'],
    [1 / 60, '1 min'],
    [120 - (120 - 1 / 60), '1 min'],
    [2 / 60, '2 min'],
    [15 / 3600, '15 s'],
    [1 / 3600, '1 s'],
    [0.001 / 3600, '0.001 s'],
  ])('shows %s hours as %s', (hours, text) => {
    expect(formatDuration(hours)).toBe(text)
    if (hours > 0) expect(Number(durationParts(hours).value)).toBeGreaterThan(0)
  })
})
