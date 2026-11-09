import { describe, expect, it } from 'vitest'
import { campusHoursElapsed, getCycle } from './calendar'
import {
  capacityUntil,
  earliestFinish,
  expectedHours,
  finishPlan,
  type Clock,
} from './plan'

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
    expect(campusHoursElapsed(new Date('2026-09-09T22:59:30Z'))).toBeCloseTo(
      23 + 59 / 60 + 30 / 3600,
    )
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
      perDay: 19,
      todayNeeded: 11,
      possible: true,
    })
    expect(finishPlan(58, day('2026-09-10'), clock)).toMatchObject({
      perDay: 47,
      capacity: 35,
      possible: false,
    })
  })
  it.each([
    // Remaining hours already exclude today's logged hours.
    {
      remaining: 24,
      logged: 9,
      left: 1,
      perDay: 23,
      todayNeeded: 1,
      possible: true,
    },
    {
      remaining: 24,
      logged: 9,
      left: 15,
      perDay: 16.5,
      todayNeeded: 7.5,
      possible: true,
    },
    {
      remaining: 4,
      logged: 9,
      left: 10,
      perDay: 4,
      todayNeeded: 0,
      possible: true,
    },
    {
      remaining: 24,
      logged: 9,
      left: 0,
      perDay: 24,
      todayNeeded: 0,
      possible: true,
    },
    {
      remaining: 25,
      logged: 9,
      left: 1,
      perDay: 24,
      todayNeeded: 1,
      possible: true,
    },
    {
      remaining: 25.01,
      logged: 9,
      left: 1,
      perDay: 24.01,
      todayNeeded: 1,
      possible: false,
    },
    {
      remaining: 0,
      logged: 9,
      left: 1,
      perDay: 0,
      todayNeeded: 0,
      possible: true,
    },
    {
      remaining: -2,
      logged: 9,
      left: 1,
      perDay: 0,
      todayNeeded: 0,
      possible: true,
    },
  ])(
    'balances a tomorrow deadline: %j',
    ({ remaining, logged, left, perDay, todayNeeded, possible }) => {
      const now = { ...clock, hoursLeftToday: left, loggedToday: logged }
      const plan = finishPlan(remaining, day('2026-09-10'), now)
      expect(plan.perDay).toBeCloseTo(perDay)
      expect(plan.todayNeeded).toBeCloseTo(todayNeeded)
      expect(plan.todayTotal).toBeCloseTo(logged + todayNeeded)
      expect(plan.possible).toBe(possible)
      expect(plan.todayNeeded + plan.perDay).toBeCloseTo(Math.max(remaining, 0))
      if (possible) {
        expect(plan.todayNeeded).toBeLessThanOrEqual(left)
        expect(
          capacityUntil(plan.date, now, plan.perDay),
        ).toBeGreaterThanOrEqual(Math.max(remaining, 0) - 1e-6)
      }
    },
  )
  it('accounts for logged hours on a today-only deadline', () => {
    const now = { ...clock, loggedToday: 9, hoursLeftToday: 1 }
    expect(finishPlan(1, clock.today, now)).toMatchObject({
      days: 1,
      perDay: 10,
      todayNeeded: 1,
      todayTotal: 10,
      possible: true,
    })
    expect(finishPlan(2, clock.today, now)).toMatchObject({
      days: 1,
      perDay: 11,
      todayNeeded: 2,
      possible: false,
    })
    expect(finishPlan(0, clock.today, now)).toMatchObject({
      perDay: 0,
      todayNeeded: 0,
      todayTotal: 9,
      possible: true,
    })
  })
  it('does not offer time in a passed deadline', () => {
    expect(finishPlan(1, day('2026-09-08'), clock)).toMatchObject({
      days: 0,
      capacity: 0,
      todayNeeded: 0,
      perDay: 0,
      possible: false,
    })
  })
  it('keeps daily recommendations sufficient across clocks and deadlines', () => {
    for (const left of [0, 0.01, 1, 11, 24]) {
      for (const logged of [0, 2, 9, 24]) {
        for (const deadline of [0, 1, 2, 18]) {
          const date = new Date(clock.today.getTime() + deadline * 86400000)
          const now = { ...clock, hoursLeftToday: left, loggedToday: logged }
          for (const remaining of [0, 0.01, 1, 24, 30, 100, 500]) {
            const plan = finishPlan(remaining, date, now)
            expect(plan.todayNeeded + deadline * plan.perDay).toBeCloseTo(
              remaining,
            )
            if (plan.possible) {
              expect(
                capacityUntil(date, now, plan.perDay),
              ).toBeGreaterThanOrEqual(remaining - 1e-6)
              expect(plan.todayNeeded).toBeLessThanOrEqual(left + 1e-6)
              expect(plan.todayTotal).toBeLessThanOrEqual(24 + 1e-6)
              expect(plan.perDay).toBeLessThanOrEqual(24 + 1e-6)
            }
          }
        }
      }
    }
  })
  it('finds the earliest possible and realistic finish dates', () => {
    expect(earliestFinish(58, cycleDays, clock)).toEqual(day('2026-09-11'))
    expect(earliestFinish(58, cycleDays, clock, 12)).toEqual(day('2026-09-13'))
    expect(earliestFinish(1000, cycleDays, clock)).toBeNull()
  })
})

describe('expected hours', () => {
  const start = day('2026-09-28')
  const end = day('2026-10-27')
  it.each([
    ['2026-09-28', 24, 0],
    ['2026-09-28', 12, 2],
    ['2026-10-27', 24, 116],
    ['2026-10-27', 12, 118],
    ['2026-10-27', 1, 119 + 5 / 6],
    ['2026-10-27', 0, 120],
    ['2026-09-27', 12, 0],
    ['2026-10-28', 12, 120],
  ])(
    'uses the clock on %s with %s hours left',
    (today, hoursLeftToday, expected) => {
      expect(
        expectedHours(120, start, end, {
          ...clock,
          today: day(today),
          hoursLeftToday,
        }),
      ).toBeCloseTo(expected)
    },
  )
  it('follows an early finish date and clamps after its deadline', () => {
    expect(
      expectedHours(120, day('2026-09-09'), day('2026-09-10'), {
        ...clock,
        hoursLeftToday: 12,
      }),
    ).toBe(30)
    expect(
      expectedHours(120, day('2026-09-01'), day('2026-09-08'), clock),
    ).toBe(120)
  })
})
