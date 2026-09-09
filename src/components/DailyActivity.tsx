import { useState } from 'react'
import type { DayLog } from '../lib/api'
import { dateKey, formatDate } from '../lib/calendar'

type Props = {
  days: Date[]
  today: Date
  logs: DayLog[]
  ready: boolean
  loading: boolean
  error: boolean
  hasData: boolean
  dailyPace: number
}

export default function DailyActivity({
  days,
  today,
  logs,
  ready,
  loading,
  error,
  hasData,
  dailyPace,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'logged' | 'missing'>('all')
  const logged = logs.filter((day) => (day.hours ?? 0) > 0).length
  const hourMap = new Map(logs.map((day) => [day.date, day.hours]))
  const visibleDays = days.filter(
    (day) =>
      filter === 'all' ||
      (filter === 'logged'
        ? (hourMap.get(dateKey(day)) ?? 0) > 0
        : ready && hourMap.get(dateKey(day)) === 0),
  )
  return (
    <section
      className="panel daily-panel"
      id="day-board"
      tabIndex={-1}
      aria-busy={loading}
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">ONE DAY AT A TIME</p>
          <h2>
            Daily activity{' '}
            <span className="count-badge">{days.length} days</span>
          </h2>
        </div>
        <div
          className="filter-tabs"
          role="group"
          aria-label="Filter daily activity"
        >
          {(['all', 'logged', 'missing'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all'
                ? 'All days'
                : value === 'logged'
                  ? 'Logged'
                  : 'No hours'}
            </button>
          ))}
        </div>
      </div>
      <div className="day-summary">
        <span>
          <b>{hasData ? logged : '—'}</b> days logged
        </span>
        <span>
          <b>{ready ? logs.filter((day) => day.hours === 0).length : '—'}</b>{' '}
          days with no hours
        </span>
        <span className="summary-note">
          Daily target pace <b>{dailyPace.toFixed(1)} h</b>
        </span>
      </div>
      <div className="day-board">
        {visibleDays.map((day) => {
          const key = dateKey(day)
          const hours = hourMap.get(key)
          const isFuture = day > today
          const isToday = key === dateKey(today)
          const known = ready && hours != null
          const status = isFuture
            ? 'Upcoming'
            : !known
              ? loading
                ? 'Loading'
                : ready || error
                  ? 'Unavailable'
                  : 'Not loaded'
              : hours > 0
                ? 'Logged'
                : 'No hours'
          return (
            <article
              className={`day-card ${isFuture ? 'is-future' : known && hours > 0 ? 'is-logged' : ''} ${isToday ? 'is-today' : ''}`}
              key={key}
              aria-label={`${formatDate(day)}, ${status}${known ? `, ${hours.toFixed(1)} hours` : ''}`}
            >
              <div className="day-card-top">
                <span className="day-name">
                  {formatDate(day, { weekday: 'short' })}
                </span>
                {isToday && <span className="today-badge">Today</span>}
              </div>
              <div className="day-date">
                {day.getUTCDate()}
                <span>{formatDate(day, { month: 'short' })}</span>
              </div>
              <div className="day-hours">
                {known ? hours.toFixed(1) : '—'}
                <span>{known ? 'h' : ''}</span>
              </div>
              <div className="day-track">
                <i
                  style={{
                    width: `${known ? Math.min((hours / dailyPace) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <span className="day-status">{status}</span>
            </article>
          )
        })}
      </div>
      {!visibleDays.length && (
        <p className="filter-empty">
          {ready
            ? 'No days match this filter.'
            : 'Load your hours or explore the demo to filter your activity.'}
        </p>
      )}
    </section>
  )
}
