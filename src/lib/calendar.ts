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

export function campusToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')))
}

export function currentMonth(today: Date) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - (today.getUTCDate() < 27 ? 1 : 0),
      1,
    ),
  )
}

export function getCycle(month: Date) {
  // Inclusive 27th–28th periods overlap on the next month's 27th and 28th.
  // The current period switches to the newly starting cycle on the 27th.
  const start = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 27),
  )
  const end = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 28),
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
