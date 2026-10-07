import { describe, expect, it } from 'vitest'
import { campusHoursElapsed, getCycle } from './calendar'
import { capacityUntil, earliestFinish, finishPlan, type Clock } from './plan'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
// 13:00 on campus: 11 hours of today are left, and 2 are already logged.
const clock: Clock = {
  today: day('2026-09-09'),
  hoursLeftToday: 11,
  loggedToday: 2,
}
const cycleDays = getCycle(day('2026-08-01')).days

describe('finish plans', () => {
  it('reads the campus clock in Casablanca time', () => {
    expect(campusHoursElapsed(new Date('2026-09-09T12:30:00Z'))).toBe(13.5)
  })
  it('counts only what is left of today, and full days after it', () => {
    expect(capacityUntil(day('2026-09-08'), clock)).toBe(0)
    expect(capacityUntil(day('2026-09-09'), clock)).toBe(11)
    expect(capacityUntil(day('2026-09-10'), clock)).toBe(35)
    // At twelve hours a day, today only has 10 of its 12 left to give.
    expect(capacityUntil(day('2026-09-10'), clock, 12)).toBe(22)
  })
  it('flags plans that need more hours than are left', () => {
    expect(finishPlan(30, day('2026-09-10'), clock)).toMatchObject({
      days: 2,
      perDay: 15,
      possible: true,
    })
    expect(finishPlan(58, day('2026-09-10'), clock)).toMatchObject({
      perDay: 29,
      capacity: 35,
      possible: false,
    })
  })
  it('finds the earliest possible and realistic finish dates', () => {
    expect(earliestFinish(58, cycleDays, clock)).toEqual(day('2026-09-11'))
    expect(earliestFinish(58, cycleDays, clock, 12)).toEqual(day('2026-09-13'))
    expect(earliestFinish(1000, cycleDays, clock)).toBeNull()
  })
})
