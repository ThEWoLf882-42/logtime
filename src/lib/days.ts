import type { DayLog } from './api'
import { dateKey } from './calendar'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export type DayState = 'logged' | 'zero' | 'unknown' | 'future'
export type DayInfo = {
  date: Date
  key: string
  hours: number | null
  state: DayState
  label: string
  /** Share of a full day, from 0 to 1, used to fill cards and dial rays. */
  level: number
  isToday: boolean
}

// A twelve-hour day fills a card and reaches the edge of the dial.
export const FULL_DAY_HOURS = 12

export function describeDays(
  days: Date[],
  today: Date,
  logs: DayLog[],
  status: LoadStatus,
): DayInfo[] {
  const hoursByDate = new Map(logs.map((log) => [log.date, log.hours]))
  const todayKey = dateKey(today)
  return days.map((date) => {
    const key = dateKey(date)
    const hours = hoursByDate.get(key) ?? null
    const future = date > today
    // Days still in flight show as loading; settled failures are unavailable.
    const label = future
      ? 'Upcoming'
      : hours !== null
        ? hours > 0
          ? 'Logged'
          : 'No hours'
        : status === 'loading' && !hoursByDate.has(key)
          ? 'Loading'
          : status === 'idle'
            ? 'Not loaded'
            : 'Unavailable'
    return {
      date,
      key,
      hours,
      state: future
        ? 'future'
        : hours === null
          ? 'unknown'
          : hours > 0
            ? 'logged'
            : 'zero',
      label,
      level: hours === null ? 0 : Math.min(hours / FULL_DAY_HOURS, 1),
      isToday: key === todayKey,
    }
  })
}
