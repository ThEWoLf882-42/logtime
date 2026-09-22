import type { CSSProperties } from 'react'
import type { DayLog } from '../lib/api'
import { dateKey, formatDate } from '../lib/calendar'

type Props = {
  days: Date[]
  today: Date
  logs: DayLog[]
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export default function DailyGrid({ days, today, logs, status }: Props) {
  const hoursByDate = new Map(logs.map((day) => [day.date, day.hours]))
  return (
    <div
      className="day-grid"
      style={
        {
          '--desktop-rows': Math.ceil(days.length / 7),
          '--tablet-rows': Math.ceil(days.length / 6),
          '--mobile-rows': Math.ceil(days.length / 4),
        } as CSSProperties
      }
    >
      {days.map((day) => {
        const key = dateKey(day)
        const hours = hoursByDate.get(key)
        const known = hours !== null && hours !== undefined
        const future = day > today
        const isToday = key === dateKey(today)
        const label = future
          ? 'Upcoming'
          : known
            ? hours > 0
              ? 'Logged'
              : 'No hours'
            : hours === null
              ? 'Unavailable'
              : status === 'loading'
                ? 'Loading'
                : status === 'idle'
                  ? 'Not loaded'
                  : 'Unavailable'
        const state = future
          ? 'future'
          : known
            ? hours > 0
              ? 'logged'
              : 'zero'
            : 'unknown'
        return (
          <article
            className={`day-card is-${state} ${label === 'Unavailable' ? 'is-unavailable' : ''} ${isToday ? 'is-today' : ''}`}
            key={key}
            style={
              {
                '--intensity': known ? Math.min(hours / 12, 1) : 0,
              } as CSSProperties
            }
            data-date={key}
            aria-busy={label === 'Loading'}
            aria-label={`${formatDate(day)}, ${label}${known ? `, ${hours.toFixed(1)} hours` : ''}`}
          >
            <div className="day-date">
              <time dateTime={key} aria-current={isToday ? 'date' : undefined}>
                <b>{day.getUTCDate()}</b>
                <span>{formatDate(day, { month: 'short' })}</span>
              </time>
              <span className="day-weekday">
                {isToday ? 'Today' : formatDate(day, { weekday: 'short' })}
              </span>
            </div>
            <div className="day-bottom">
              <p className="day-hours">
                {known ? hours.toFixed(1) : '—'}
                {known && <span>h</span>}
              </p>
              <span className="day-status">
                <i aria-hidden="true" />
                {label}
              </span>
            </div>
            <div className="day-meter" aria-hidden="true">
              <span />
            </div>
          </article>
        )
      })}
    </div>
  )
}
