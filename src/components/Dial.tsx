import type { CSSProperties } from 'react'
import { useTween } from '../hooks/useTween'
import { formatDate } from '../lib/calendar'
import type { DayInfo } from '../lib/days'
import { clampHeat, DAY_HEAT_LABELS, heatColor, heatTier } from '../lib/heat'

type Props = {
  days: DayInfo[]
  total: number | null
  target: number
  loading: boolean
  /** Marks today on the ring while the cycle is in progress. */
  showToday: boolean
  active: string | null
  onActive: (key: string | null) => void
  valueText: string
  valueNow: number | undefined
}

// Geometry in viewBox units: day rays sit between the core and the goal ring.
const CENTER = 200
const RAY_IN = 94
const RAY_OUT = 164
const RAY_LENGTH = RAY_OUT - RAY_IN
const RING = 183
const RING_LENGTH = 2 * Math.PI * RING
// Overtime rays reach past a full day toward the ring as they get hotter.
const OVERTIME_REACH = 10

function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  }
}

export default function Dial({
  days,
  total,
  target,
  loading,
  showToday,
  active,
  onActive,
  valueText,
  valueNow,
}: Props) {
  const slot = 360 / Math.max(days.length, 1)
  const width = Math.min(10, ((2 * Math.PI * RAY_IN) / days.length) * 0.52)
  const shown = useTween(total ?? 0)
  const fraction = total === null ? 0 : Math.min(total / target, 1)
  // Past the goal, a second lap shows the overrun (a full lap is double).
  const excess = total === null ? 0 : Math.max(total / target - 1, 0)
  const overflow = Math.min(excess, 1)
  const goalColor = heatColor(clampHeat(excess))
  const sunTurn = fraction < 1 ? fraction : overflow
  const todayIndex = days.findIndex((day) => day.isToday)
  const activeDay = days.find((day) => day.key === active)

  return (
    <div
      className={`dial ${loading ? 'is-loading' : ''} ${activeDay ? 'has-active' : ''} ${fraction >= 1 ? 'is-complete' : ''}`}
      role="progressbar"
      aria-label="Monthly hours progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
    >
      <div className="dial-sweep" aria-hidden="true" />
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        onMouseLeave={() => onActive(null)}
      >
        <defs>
          <radialGradient
            id="dial-ray-gradient"
            gradientUnits="userSpaceOnUse"
            cx={CENTER}
            cy={CENTER}
            r={RAY_OUT}
          >
            <stop offset={RAY_IN / RAY_OUT} className="stop-ember" />
            <stop offset="1" className="stop-sun" />
          </radialGradient>
          <radialGradient id="dial-core-gradient">
            <stop offset="0" className="stop-core" />
            <stop offset="1" className="stop-core-edge" />
          </radialGradient>
          <filter id="dial-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle className="dial-core" cx={CENTER} cy={CENTER} r={RAY_IN - 6} />
        <circle className="dial-ring-track" cx={CENTER} cy={CENTER} r={RING} />
        <circle
          className="dial-ring"
          cx={CENTER}
          cy={CENTER}
          r={RING}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{
            strokeDasharray: `${fraction * RING_LENGTH} ${RING_LENGTH}`,
            opacity: fraction > 0 ? 1 : 0,
          }}
        />
        <circle
          className={`dial-overflow heat-${heatTier(clampHeat(excess))}`}
          cx={CENTER}
          cy={CENTER}
          r={RING}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{
            strokeDasharray: `${overflow * RING_LENGTH} ${RING_LENGTH}`,
            stroke: goalColor,
            opacity: excess > 0 ? 1 : 0,
          }}
        />
        {sunTurn > 0 && (fraction < 1 || overflow < 1) && (
          <circle
            className="dial-sun"
            cx={CENTER}
            cy={CENTER - RING}
            r="5.5"
            style={{
              transform: `rotate(${sunTurn * 360}deg)`,
              ...(excess > 0 && { fill: goalColor }),
            }}
          />
        )}
        {showToday && todayIndex >= 0 && (
          <path
            className="dial-today"
            d={`M${CENTER} ${CENTER - RING - 4} l-5 -10 h10 Z`}
            transform={`rotate(${(todayIndex + 0.5) * slot} ${CENTER} ${CENTER})`}
          />
        )}

        <g className="dial-days">
          {days.map((day, index) => {
            const angle = (index + 0.5) * slot
            const inner = polar(RAY_IN, angle)
            const outer = polar(RAY_OUT, angle)
            const line = { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y }
            return (
              <g
                key={day.key}
                className={`dial-day is-${day.state} ${day.label === 'Loading' ? 'is-pending' : ''} ${day.isToday ? 'is-today' : ''} ${day.key === active ? 'is-active' : ''}`}
                style={{ '--index': index } as CSSProperties}
              >
                <line className="dial-slot" {...line} strokeWidth={width} />
                {day.state === 'logged' && day.overtime === 0 && (
                  <line
                    className="dial-ray"
                    {...line}
                    strokeWidth={width}
                    style={{
                      strokeDasharray: `${day.level * RAY_LENGTH} ${RAY_LENGTH * 2}`,
                    }}
                  />
                )}
                {day.overtime > 0 && (
                  <OvertimeRay angle={angle} heat={day.heat} width={width} />
                )}
                {day.state === 'zero' && (
                  <circle
                    className="dial-zero"
                    cx={inner.x}
                    cy={inner.y}
                    r="2.8"
                  />
                )}
                {day.label === 'Unavailable' && (
                  <circle
                    className="dial-missing"
                    cx={inner.x}
                    cy={inner.y}
                    r="3.4"
                  />
                )}
                {index % 7 === 0 && index < days.length - 3 && (
                  <text
                    className="dial-week"
                    {...polar(RAY_IN - 16, angle)}
                    dy="0.35em"
                  >
                    {day.date.getUTCDate()}
                  </text>
                )}
                <line
                  className="dial-hit"
                  {...line}
                  strokeWidth={(2 * Math.PI * RAY_OUT) / days.length}
                  onMouseEnter={() => onActive(day.key)}
                />
              </g>
            )
          })}
        </g>

        <g className="dial-readout">
          <text
            className="dial-kicker"
            x={CENTER}
            y="160"
            style={!activeDay && excess > 0 ? { fill: goalColor } : {}}
          >
            {activeDay
              ? formatDate(activeDay.date, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              : excess > 0
                ? `+${(total! - target).toFixed(1)} h over`
                : 'Logged'}
          </text>
          <text className="dial-value" x={CENTER} y="218">
            {activeDay
              ? activeDay.hours !== null
                ? activeDay.hours.toFixed(1)
                : '—'
              : total !== null
                ? shown.toFixed(1)
                : '—'}
          </text>
          <text
            className="dial-sub"
            x={CENTER}
            y="248"
            style={activeDay?.heat ? { fill: heatColor(activeDay.heat) } : {}}
          >
            {activeDay
              ? activeDay.overtime > 0
                ? DAY_HEAT_LABELS[heatTier(activeDay.heat)]
                : activeDay.label
              : `of ${target} h`}
          </text>
        </g>
      </svg>
    </div>
  )
}

/** A day past twelve hours: a full ray, extended and recolored by its heat. */
function OvertimeRay({
  angle,
  heat,
  width,
}: {
  angle: number
  heat: number
  width: number
}) {
  const inner = polar(RAY_IN, angle)
  const reach = RAY_OUT + OVERTIME_REACH * heat
  const outer = polar(reach, angle)
  const length = reach - RAY_IN
  return (
    <line
      className={`dial-ray is-over heat-${heatTier(heat)}`}
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      strokeWidth={width}
      style={{
        stroke: heatColor(heat),
        strokeDasharray: `${length} ${length * 2}`,
      }}
    />
  )
}
