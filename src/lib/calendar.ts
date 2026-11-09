// Calendar dates use UTC internally so browser time zones and DST cannot shift days.
export const dateKey = (date: Date) => date.toISOString().slice(0, 10)
export const addDays = (date: Date, amount: number) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + amount,
    ),
  )
export const shiftMonth = (month: Date, amount: number) =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1))

// Morocco returned permanently to GMT at 02:00 GMT+1 on September 20, 2026.
// Some browsers still ship the previous GMT+1 rules. Keep current campus dates
// consistent while retaining historical Casablanca/Ramadan offsets before then.
// Source: https://www.cg.gov.ma/fr/node/13036 (decree 2.26.530).
const GMT_RETURN = Date.parse('2026-09-20T01:00:00Z')
const campusTimeZone = (now: Date) =>
  now.getTime() >= GMT_RETURN ? 'UTC' : 'Africa/Casablanca'

export function campusToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: campusTimeZone(now),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')))
}

/** Hours already passed in today's campus day, from 0 up to 24. */
export function campusHoursElapsed(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: campusTimeZone(now),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  return (
    part('hour') +
    part('minute') / 60 +
    part('second') / 3600 +
    now.getUTCMilliseconds() / 3600000
  )
}

export const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 86400000)

export function currentMonth(today: Date) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - (today.getUTCDate() < 28 ? 1 : 0),
      1,
    ),
  )
}

export function getCycle(month: Date) {
  // Inclusive 28th–27th periods cover consecutive days without overlap.
  const start = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 28),
  )
  const end = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 27),
  )
  const count = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return {
    start,
    end,
    days: Array.from({ length: count }, (_, index) => addDays(start, index)),
  }
}

export const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) => date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })

// Preserve the existing endpoint's day selector (previous day at 23:00 UTC).
// This is an API convention, independent of the user's browser time zone.
export const formatApiDate = (date: Date) =>
  new Date(date.getTime() - 3600000).toISOString()
