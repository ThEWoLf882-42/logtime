import { describe, expect, it } from 'vitest'
import {
  addDays,
  campusToday,
  currentMonth,
  dateKey,
  formatApiDate,
  getCycle,
  shiftMonth,
} from './calendar'

describe('29th–28th calendar', () => {
  it('selects the correct cycle at the rollover', () => {
    expect(dateKey(currentMonth(new Date('2026-09-28')))).toBe('2026-08-01')
    expect(dateKey(currentMonth(new Date('2026-09-29')))).toBe('2026-09-01')
    expect(dateKey(currentMonth(new Date('2026-01-01')))).toBe('2025-12-01')
  })
  it('keeps a shorter March cycle after a non-leap February', () => {
    const month = new Date('2026-01-01')
    const next = shiftMonth(month, 1)
    expect(dateKey(getCycle(next).start)).toBe('2026-03-01')
    expect(dateKey(getCycle(next).end)).toBe('2026-03-28')
    expect(dateKey(shiftMonth(next, -1))).toBe(dateKey(month))
  })
  it('includes leap day', () => {
    const cycle = getCycle(new Date('2024-02-01'))
    expect(dateKey(cycle.start)).toBe('2024-02-29')
    expect(cycle.days).toHaveLength(29)
  })
  it('has no gaps or overlapping days through leap years and DST', () => {
    for (let index = 0; index < 60; index++) {
      const month = shiftMonth(new Date('2023-01-01'), index)
      const cycle = getCycle(month)
      expect(dateKey(addDays(cycle.end, 1))).toBe(
        dateKey(getCycle(shiftMonth(month, 1)).start),
      )
      expect(new Set(cycle.days.map(dateKey)).size).toBe(cycle.days.length)
      for (const day of cycle.days)
        expect(dateKey(currentMonth(day))).toBe(dateKey(month))
    }
  })
  it('uses Casablanca today while preserving the API day convention', () => {
    expect(dateKey(campusToday(new Date('2026-09-09T23:30:00Z')))).toBe(
      '2026-09-10',
    )
    expect(dateKey(campusToday(new Date('2026-02-22T23:30:00Z')))).toBe(
      '2026-02-22',
    )
    expect(formatApiDate(new Date('2026-09-09'))).toBe(
      '2026-09-08T23:00:00.000Z',
    )
  })
})
