import type { CSSProperties } from 'react'
import { formatDate } from '../lib/calendar'
import type { DayInfo } from '../lib/days'
import { DAY_HEAT_LABELS, heatColor, heatTier } from '../lib/heat'

type Props = {
  days: DayInfo[]
  active: string | null
  onActive: (key: string | null) => void
}

export default function DailyGrid({ days, active, onActive }: Props) {
  return (
    <div
      className="day-grid"
      style={{ '--rows': Math.ceil(days.length / 7) } as CSSProperties}
      onMouseLeave={() => onActive(null)}
    >
      {days.map((day, index) => {
        // Name the month only where it starts, like a printed calendar.
        const showMonth = index === 0 || day.date.getUTCDate() === 1
        const tier = heatTier(day.heat)
        return (
          <article
            className={`day-card is-${day.state} ${day.label === 'Unavailable' ? 'is-unavailable' : ''} ${day.label === 'Loading' ? 'is-pending' : ''} ${day.isToday ? 'is-today' : ''} ${day.key === active ? 'is-active' : ''} ${tier ? `is-over heat-${tier}` : ''}`}
            key={day.key}
            style={
              {
                '--level': day.level,
                '--index': index,
                ...(tier && {
                  '--heat': heatColor(day.heat),
                  '--over': day.heat,
                }),
              } as CSSProperties
            }
            aria-label={`${formatDate(day.date)}, ${day.label}${day.hours !== null ? `, ${day.hours.toFixed(1)} hours` : ''}${tier ? `, ${DAY_HEAT_LABELS[tier]}` : ''}`}
            onMouseEnter={() => onActive(day.key)}
          >
            <div className="day-date">
              <time
                dateTime={day.key}
                aria-current={day.isToday ? 'date' : undefined}
              >
                <b>{day.date.getUTCDate()}</b>
                {showMonth && (
                  <span>{formatDate(day.date, { month: 'short' })}</span>
                )}
              </time>
              {day.isToday && <span className="today-badge">Today</span>}
            </div>
            <div className="day-bottom">
              <p className="day-hours">
                {day.hours !== null ? day.hours.toFixed(1) : '—'}
                {day.hours !== null && <span>h</span>}
              </p>
              {tier > 0 && (
                <span className="day-over" title={DAY_HEAT_LABELS[tier]}>
                  +{day.overtime.toFixed(1)}h
                </span>
              )}
              <span className="day-status">
                <i aria-hidden="true" />
                {day.label}
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
