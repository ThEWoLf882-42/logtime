import { dateKey, daysBetween } from './calendar'
import { FULL_DAY_HOURS } from './days'

// Campus is open around the clock, so a day holds at most 24 logged hours.
export const DAY_LIMIT_HOURS = 24
// The pace suggested as realistic: a full twelve-hour day.
export const REALISTIC_HOURS = FULL_DAY_HOURS

// How a plan looks as the daily load climbs past a full day, by heat tier.
export const LOAD_FACES = ['', '😵', '🧟', '⚰️'] as const
// Past what a day can hold.
export const DEAD = '💀'

/** Where today stands: the campus date, hours left in it, and hours logged so far. */
export type Clock = {
  today: Date
  hoursLeftToday: number
  loggedToday: number
}

export type FinishPlan = {
  date: Date
  key: string
  /** Days from today through the finish date, inclusive. */
  days: number
  /** Hours each of those days needs, spread evenly. */
  perDay: number
  /** The most hours that can still be logged by the end of the finish date. */
  capacity: number
  possible: boolean
}

// Rounding in the API's hours should not turn a just-possible plan impossible.
const EPSILON = 1e-6

/** Hours that can still be logged from now through `date` at `perDay` hours a day. */
export function capacityUntil(
  date: Date,
  clock: Clock,
  perDay = DAY_LIMIT_HOURS,
) {
  const days = daysBetween(clock.today, date) + 1
  if (days <= 0) return 0
  // Today only offers what is left of it, and what is left of its daily share.
  const todayRoom = Math.max(
    Math.min(perDay - clock.loggedToday, clock.hoursLeftToday),
    0,
  )
  return todayRoom + perDay * (days - 1)
}

export function finishPlan(
  remaining: number,
  date: Date,
  clock: Clock,
): FinishPlan {
  const days = Math.max(daysBetween(clock.today, date) + 1, 1)
  const capacity = capacityUntil(date, clock)
  return {
    date,
    key: dateKey(date),
    days,
    perDay: remaining / days,
    capacity,
    possible: remaining <= capacity + EPSILON,
  }
}

/** The first day by which `remaining` hours fit at `perDay` hours a day, if any. */
export function earliestFinish(
  remaining: number,
  days: Date[],
  clock: Clock,
  perDay = DAY_LIMIT_HOURS,
) {
  return (
    days.find(
      (day) =>
        day >= clock.today &&
        capacityUntil(day, clock, perDay) + EPSILON >= remaining,
    ) ?? null
  )
}
