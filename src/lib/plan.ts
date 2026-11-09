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
  /** Additional hours per full remaining day, or the shortfall for a today-only plan. */
  perDay: number
  /** Additional hours to log today; already logged hours are not counted again. */
  todayNeeded: number
  /** Today's logged hours plus the additional hours the plan needs today. */
  todayTotal: number
  /** Predicted creditable hours, including the current unfinished hour. */
  capacity: number
  possible: boolean
}

// Rounding in the API's hours should not turn a just-possible plan impossible.
const EPSILON = 1e-6

/** Whole-hour credit slots through `date`; the current hour stays available. */
export function capacityUntil(
  date: Date,
  clock: Clock,
  perDay = DAY_LIMIT_HOURS,
) {
  const days = daysBetween(clock.today, date) + 1
  if (days <= 0) return 0
  // Backend credits can arrive only on logout in whole hours. A partly elapsed
  // hour may already have been worked, so retain its whole credit until it ends.
  // Reported totals are authoritative, even when a day reports more than 24 h.
  const slots = Math.ceil(
    Math.max(Math.min(clock.hoursLeftToday, DAY_LIMIT_HOURS), 0),
  )
  const todayRoom = Math.min(perDay, slots)
  return todayRoom + perDay * (days - 1)
}

export function finishPlan(
  remaining: number,
  date: Date,
  clock: Clock,
): FinishPlan {
  const days = Math.max(daysBetween(clock.today, date) + 1, 0)
  const capacity = capacityUntil(date, clock)
  const hours = Math.max(remaining, 0)
  const futureDays = Math.max(days - 1, 0)
  const todayRoom = capacityUntil(clock.today, clock)
  // Spread only the remaining hours. Already reported hours have been counted
  // in the cycle total and must not reduce today's share a second time.
  // If today's share exceeds its credit slots, spread that excess over future days.
  const todayNeeded =
    days === 0
      ? 0
      : futureDays === 0
        ? hours
        : Math.min(hours / days, todayRoom)
  const todayTotal = clock.loggedToday + todayNeeded
  const perDay =
    hours === 0 || days === 0
      ? 0
      : futureDays === 0
        ? hours
        : (hours - todayNeeded) / futureDays
  return {
    date,
    key: dateKey(date),
    days,
    perDay,
    todayNeeded,
    todayTotal,
    capacity,
    possible: hours <= capacity + EPSILON,
  }
}

/** Hours expected at the current campus time on an even pace to the deadline. */
export function expectedHours(
  target: number,
  start: Date,
  end: Date,
  clock: Clock,
) {
  const days = daysBetween(start, end) + 1
  if (days <= 0) return 0
  const elapsed =
    daysBetween(start, clock.today) + 1 - clock.hoursLeftToday / DAY_LIMIT_HOURS
  return target * Math.min(Math.max(elapsed / days, 0), 1)
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
