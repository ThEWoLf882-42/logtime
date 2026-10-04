import type { CSSProperties } from 'react'
import { formatDate } from '../lib/calendar'
import { FULL_DAY_HOURS, type DayInfo } from '../lib/days'
import { DAY_HEAT_LABELS, heatColor, heatTier } from '../lib/heat'

type Props = {
  days: DayInfo[]
  /** Hours each remaining day needs to reach the goal, when that applies. */
  needed: number | null
}

// Gridlines every four hours; the scale grows past a full day only when needed.
const AXIS_STEP = 4

/**
 * One column per day on wide screens, one row per day in a ledger on narrow
 * ones. Bars share a single hour scale, overtime is drawn in heat colors
 * above the twelve-hour line, and future days show the hours still needed.
 */
export default function DailyGrid({ days, needed }: Props) {
  const peak = Math.max(
    FULL_DAY_HOURS,
    needed ?? 0,
    ...days.map((day) => day.hours ?? 0),
  )
  const scale = Math.ceil(peak / AXIS_STEP) * AXIS_STEP
  const ticks = Array.from(
    { length: scale / AXIS_STEP },
    (_, index) => (index + 1) * AXIS_STEP,
  )
  const need = needed ? Math.min(needed / scale, 1) : 0

  return (
    <div
      className="day-chart"
      style={
        {
          '--count': days.length,
          '--rows-2': Math.ceil(days.length / 2),
          '--rows-3': Math.ceil(days.length / 3),
        } as CSSProperties
      }
    >
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((hours) => (
          <span
            key={hours}
            className={hours === FULL_DAY_HOURS ? 'is-full-day' : undefined}
            style={{ '--at': hours / scale } as CSSProperties}
          >
            <em>{hours}h</em>
          </span>
        ))}
      </div>
      <div className="day-grid">
        {days.map((day, index) => {
          const tier = heatTier(day.heat)
          const hours = day.hours ?? 0
          const monthStart = index === 0 || day.date.getUTCDate() === 1
          const weekend = day.date.getUTCDay() % 6 === 0
          const showNeed = need > 0 && (day.state === 'future' || day.isToday)
          return (
            <article
              className={`day-card is-${day.state} ${day.label === 'Unavailable' ? 'is-unavailable' : ''} ${day.label === 'Loading' ? 'is-pending' : ''} ${day.isToday ? 'is-today' : ''} ${weekend ? 'is-weekend' : ''} ${monthStart && index > 0 ? 'is-month-start' : ''} ${tier ? `is-over heat-${tier}` : ''}`}
              key={day.key}
              style={
                {
                  '--h': hours / scale,
                  '--base': Math.min(hours, FULL_DAY_HOURS) / scale,
                  '--need': need,
                  '--index': index,
                  ...(tier && { '--heat': heatColor(day.heat) }),
                } as CSSProperties
              }
              aria-label={`${formatDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}, ${day.label}${day.hours !== null ? `, ${day.hours.toFixed(1)} hours` : ''}${tier ? `, ${DAY_HEAT_LABELS[tier]}` : ''}`}
            >
              <div className="day-plot">
                {showNeed && <span className="day-need" />}
                {hours > 0 && (
                  <span className="day-bar">
                    {tier > 0 && <span className="day-bar-over" />}
                  </span>
                )}
                {day.label === 'Unavailable' && (
                  <span className="day-missing" />
                )}
                <p className="day-hours">
                  {day.hours !== null
                    ? day.hours > 0
                      ? day.hours.toFixed(1)
                      : '0'
                    : day.label === 'Unavailable'
                      ? '—'
                      : ''}
                </p>
                {tier > 0 && (
                  <span className="day-over">+{day.overtime.toFixed(1)}h</span>
                )}
              </div>
              <div className="day-date">
                <time
                  dateTime={day.key}
                  aria-current={day.isToday ? 'date' : undefined}
                >
                  <b>{day.date.getUTCDate()}</b>
                  <span className="weekday-narrow">
                    {formatDate(day.date, { weekday: 'narrow' })}
                  </span>
                  <span className="weekday-short">
                    {formatDate(day.date, { weekday: 'short' })}
                  </span>
                </time>
                {monthStart && (
                  <span className="day-month">
                    {formatDate(day.date, { month: 'short' })}
                  </span>
                )}
              </div>
              {day.isToday && <span className="today-badge">Today</span>}
              <span className="day-status">{day.label}</span>
            </article>
          )
        })}
      </div>
    </div>
  )
}
