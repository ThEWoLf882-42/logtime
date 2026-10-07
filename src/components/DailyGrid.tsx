import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { formatDate } from '../lib/calendar'
import { FULL_DAY_HOURS, type DayInfo } from '../lib/days'
import { clampHeat, DAY_HEAT_LABELS, heatColor, heatTier } from '../lib/heat'
import { DAY_LIMIT_HOURS, DEAD, LOAD_FACES, type FinishPlan } from '../lib/plan'

type Props = {
  days: DayInfo[]
  /** The plan for finishing on each day that can still be picked, by date key. */
  plans: Map<string, FinishPlan> | null
  /** The chosen finish day, or null to finish with the cycle. */
  finishKey: string | null
  preview: string | null
  onPreview: (key: string | null) => void
  onPick: (key: string | null) => void
}

// Gridlines every four hours, or every eight once the scale passes a day.
const AXIS_STEP = 4
// Needed hours past a full day are drawn up to just above it, not to scale.
const NEED_CAP_HOURS = DAY_LIMIT_HOURS + AXIS_STEP

const longDate = (date: Date) =>
  formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })

/**
 * One column per day on wide screens, one row per day in a ledger on narrow
 * ones. Bars share a single hour scale, overtime is drawn in heat colors
 * above the twelve-hour line, and the days left before the finish date show
 * the hours each still needs. Those days double as the finish-date picker.
 */
export default function DailyGrid({
  days,
  plans,
  finishKey,
  preview,
  onPreview,
  onPick,
}: Props) {
  const grid = useRef<HTMLDivElement>(null)
  const lastKey = days[days.length - 1]?.key
  // Hovering or focusing a day previews it before it is picked.
  const shownKey = preview ?? finishKey ?? lastKey
  const shown = plans?.get(shownKey) ?? null
  const shownIndex = days.findIndex((day) => day.key === shownKey)
  const needed = shown?.perDay ?? 0
  const drawnNeed = Math.min(needed, NEED_CAP_HOURS)
  const peak = Math.max(
    FULL_DAY_HOURS,
    drawnNeed,
    ...days.map((day) => day.hours ?? 0),
  )
  const scale = Math.ceil(peak / AXIS_STEP) * AXIS_STEP
  const step = scale > DAY_LIMIT_HOURS ? AXIS_STEP * 2 : AXIS_STEP
  // The full-day and 24-hour lines always show; other lines follow the step.
  const ticks = Array.from({ length: scale }, (_, index) => index + 1).filter(
    (hours) =>
      hours % step === 0 ||
      hours === FULL_DAY_HOURS ||
      hours === DAY_LIMIT_HOURS,
  )
  const load = !shown
    ? 'none'
    : !shown.possible
      ? 'impossible'
      : needed > FULL_DAY_HOURS
        ? 'heavy'
        : 'normal'
  const tabKey = finishKey ?? days.find((day) => plans?.has(day.key))?.key

  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = [
      ...(grid.current?.querySelectorAll<HTMLButtonElement>('.day-pick') ?? []),
    ]
    const at = buttons.indexOf(event.currentTarget)
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? at + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? at - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : null
    if (event.key === 'Escape') onPick(null)
    else if (next === null) return
    else buttons[Math.min(Math.max(next, 0), buttons.length - 1)]?.focus()
    event.preventDefault()
  }

  return (
    <div
      className={`day-chart load-${load} ${plans ? 'is-pickable' : ''}`}
      style={
        {
          '--count': days.length,
          '--rows-2': Math.ceil(days.length / 2),
          '--rows-3': Math.ceil(days.length / 3),
          '--need': Math.min(drawnNeed / scale, 1),
          ...(load === 'heavy' && {
            '--need-color': heatColor(clampHeat((needed - FULL_DAY_HOURS) / 6)),
          }),
        } as CSSProperties
      }
    >
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((hours) => (
          <span
            key={hours}
            className={
              hours === FULL_DAY_HOURS
                ? 'is-full-day'
                : hours === DAY_LIMIT_HOURS
                  ? 'is-day-limit'
                  : undefined
            }
            style={{ '--at': hours / scale } as CSSProperties}
          >
            {(hours % step === 0 || hours === DAY_LIMIT_HOURS) && (
              <em>{hours === DAY_LIMIT_HOURS ? '24h max' : `${hours}h`}</em>
            )}
          </span>
        ))}
      </div>
      <div className="day-grid" ref={grid} onMouseLeave={() => onPreview(null)}>
        {days.map((day, index) => {
          const tier = heatTier(day.heat)
          const hours = day.hours ?? 0
          const monthStart = index === 0 || day.date.getUTCDate() === 1
          const weekend = day.date.getUTCDay() % 6 === 0
          const plan = plans?.get(day.key)
          const ahead = day.state === 'future' || day.isToday
          const showNeed = shown !== null && ahead && index <= shownIndex
          const after = shown !== null && index > shownIndex
          return (
            <article
              className={`day-card is-${day.state} ${day.label === 'Unavailable' ? 'is-unavailable' : ''} ${day.label === 'Loading' ? 'is-pending' : ''} ${day.isToday ? 'is-today' : ''} ${weekend ? 'is-weekend' : ''} ${monthStart && index > 0 ? 'is-month-start' : ''} ${tier ? `is-over heat-${tier}` : ''} ${day.key === finishKey ? 'is-finish' : ''} ${day.key === preview ? 'is-preview' : ''} ${after ? 'is-after' : ''}`}
              key={day.key}
              style={
                {
                  '--h': hours / scale,
                  '--base': Math.min(hours, FULL_DAY_HOURS) / scale,
                  '--index': index,
                  ...(tier && { '--heat': heatColor(day.heat) }),
                } as CSSProperties
              }
              aria-label={`${longDate(day.date)}, ${day.label}${day.hours !== null ? `, ${day.hours.toFixed(1)} hours` : ''}${tier ? `, ${DAY_HEAT_LABELS[tier]}` : ''}`}
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
              {day.key === finishKey && (
                <span className="finish-flag" aria-hidden="true">
                  Finish
                </span>
              )}
              {day.isToday && <span className="today-badge">Today</span>}
              <span className="day-status">{day.label}</span>
              {plan && (
                <button
                  type="button"
                  className="day-pick"
                  tabIndex={day.key === tabKey ? 0 : -1}
                  aria-pressed={day.key === finishKey}
                  aria-label={`Finish by ${longDate(day.date)}: ${plan.possible ? `${plan.perDay.toFixed(1)} hours a day` : 'not possible'}`}
                  onMouseEnter={() => onPreview(day.key)}
                  onFocus={() => onPreview(day.key)}
                  onBlur={() => onPreview(null)}
                  onClick={() => onPick(day.key === finishKey ? null : day.key)}
                  onKeyDown={move}
                />
              )}
            </article>
          )
        })}
        {preview && shown && (
          <div
            className={`chart-tip ${shownIndex < 3 ? 'is-start' : shownIndex > days.length - 4 ? 'is-end' : ''}`}
            style={
              {
                '--at': (shownIndex + 0.5) / days.length,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <span>
              {preview === finishKey ? 'Your finish date' : 'Finish by'}{' '}
              {formatDate(shown.date, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <strong>
              {shown.possible
                ? `${load === 'heavy' ? `${LOAD_FACES[heatTier(clampHeat((needed - FULL_DAY_HOURS) / 6))]} ` : ''}${shown.perDay.toFixed(1)} h a day`
                : `${DEAD} RIP`}
            </strong>
            {!shown.possible && (
              <span>Only {shown.capacity.toFixed(1)} h left by then</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
