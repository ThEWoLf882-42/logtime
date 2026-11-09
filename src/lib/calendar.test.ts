import { describe, expect, it } from 'vitest'
import {
  addDays,
  campusToday,
  campusHoursElapsed,
  currentMonth,
  dateKey,
  formatApiDate,
  getCycle,
  shiftMonth,
} from './calendar'

describe('28th–27th calendar', () => {
  it('selects the correct cycle at the rollover', () => {
    expect(dateKey(currentMonth(new Date('2026-09-26')))).toBe('2026-08-01')
    expect(dateKey(currentMonth(new Date('2026-09-27')))).toBe('2026-08-01')
    expect(dateKey(currentMonth(new Date('2026-09-28')))).toBe('2026-09-01')
    expect(dateKey(currentMonth(new Date('2026-01-01')))).toBe('2025-12-01')
  })
  it('starts in February even in non-leap years', () => {
    const month = new Date('2026-01-01')
    const next = shiftMonth(month, 1)
    expect(dateKey(getCycle(next).start)).toBe('2026-02-28')
    expect(dateKey(getCycle(next).end)).toBe('2026-03-27')
    expect(getCycle(next).days).toHaveLength(28)
    expect(dateKey(shiftMonth(next, -1))).toBe(dateKey(month))
  })
  it('includes leap day', () => {
    const cycle = getCycle(new Date('2024-02-01'))
    expect(dateKey(cycle.start)).toBe('2024-02-28')
    expect(cycle.days.map(dateKey)).toContain('2024-02-29')
    expect(cycle.days).toHaveLength(29)
  })
  it('includes both endpoints with no gaps or overlap between periods', () => {
    for (let index = 0; index < 60; index++) {
      const month = shiftMonth(new Date('2023-01-01'), index)
      const cycle = getCycle(month)
      expect(dateKey(addDays(cycle.end, 1))).toBe(
        dateKey(getCycle(shiftMonth(month, 1)).start),
      )
      expect(new Set(cycle.days.map(dateKey)).size).toBe(cycle.days.length)
      expect(cycle.days.map(dateKey).at(-1)).toBe(dateKey(cycle.end))
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
  it.each([
    ['2026-09-09T22:59:59Z', '2026-09-09', 23 + 59 / 60 + 59 / 3600],
    ['2026-09-09T23:00:00Z', '2026-09-10', 0],
    ['2026-09-20T00:59:59Z', '2026-09-20', 1 + 59 / 60 + 59 / 3600],
    ['2026-09-20T01:00:00Z', '2026-09-20', 1],
    ['2026-11-09T22:59:59Z', '2026-11-09', 22 + 59 / 60 + 59 / 3600],
    ['2026-11-09T23:00:00Z', '2026-11-09', 23],
    ['2026-11-09T23:59:59Z', '2026-11-09', 23 + 59 / 60 + 59 / 3600],
    ['2026-11-10T00:00:00Z', '2026-11-10', 0],
    ['2026-11-27T23:00:00Z', '2026-11-27', 23],
    ['2026-11-28T00:00:00Z', '2026-11-28', 0],
    ['2027-02-22T23:00:00Z', '2027-02-22', 23],
  ])(
    'keeps campus dates and clocks consistent at %s',
    (instant, expectedDate, expectedHour) => {
      const now = new Date(instant)
      expect(dateKey(campusToday(now))).toBe(expectedDate)
      expect(campusHoursElapsed(now)).toBeCloseTo(expectedHour)
    },
  )
})
