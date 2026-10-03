import { describe, expect, it } from 'vitest'
import { describeDays } from './days'
import { clampHeat, heatColor, heatTier } from './heat'

describe('heat', () => {
  it('ranks overruns into three increasingly drastic tiers', () => {
    expect(heatTier(0)).toBe(0)
    expect(heatTier(0.01)).toBe(1)
    expect(heatTier(0.4)).toBe(2)
    expect(heatTier(0.7)).toBe(3)
    expect(heatTier(clampHeat(5))).toBe(3)
  })
  it('climbs from hot orange through crimson to violet', () => {
    expect(heatColor(0)).toBe('rgb(255 138 31)')
    expect(heatColor(2 / 3)).toBe('rgb(255 45 85)')
    expect(heatColor(1)).toBe('rgb(193 60 255)')
    expect(heatColor(9)).toBe(heatColor(1))
    expect(heatColor(0.5)).not.toBe(heatColor(0.4))
  })
  it('measures overtime past a twelve-hour day', () => {
    const days = [new Date('2026-09-01'), new Date('2026-09-02')]
    const [normal, long] = describeDays(
      days,
      new Date('2026-09-02'),
      [
        { date: '2026-09-01', hours: 11.5 },
        { date: '2026-09-02', hours: 15 },
      ],
      'ready',
    )
    expect(normal).toMatchObject({ overtime: 0, heat: 0, level: 11.5 / 12 })
    expect(long).toMatchObject({ overtime: 3, heat: 0.5, level: 1 })
  })
})
