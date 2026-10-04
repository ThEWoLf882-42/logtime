import type { DayLog } from './api'
import { dateKey } from './calendar'
import { clampHeat } from './heat'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export type DayState = 'logged' | 'zero' | 'unknown' | 'future'
export type DayInfo = {
  date: Date
  key: string
  hours: number | null
  state: DayState
  label: string
  /** Hours past a full day, and how drastic that overrun is (0 to 1). */
  overtime: number
  heat: number
  isToday: boolean
}

// A twelve-hour day is a full day; hours beyond it count as overtime.
export const FULL_DAY_HOURS = 12
// Six hours past a full day (an 18-hour day) is the most drastic overrun.
export const OVERTIME_SPAN_HOURS = 6

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
    const overtime = hours === null ? 0 : Math.max(hours - FULL_DAY_HOURS, 0)
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
      overtime,
      heat: clampHeat(overtime / OVERTIME_SPAN_HOURS),
      isToday: key === todayKey,
    }
  })
}
