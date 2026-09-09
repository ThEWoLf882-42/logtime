import type { DayLog } from '../lib/api'
import { formatDate, type getCycle } from '../lib/calendar'

type Props = {
  cycle: ReturnType<typeof getCycle>
  logs: DayLog[]
  target: number
  total: number
  complete: boolean
  hasData: boolean
  elapsed: number
  loading: boolean
  missing: number
}
export default function TrendChart({
  cycle,
  logs,
  target,
  total,
  complete,
  hasData,
  elapsed,
  loading,
  missing,
}: Props) {
  let cumulative = 0
  const maxChart = Math.max(target, total, 1) * 1.1
  const linePoints = logs
    .map((day, index) => {
      cumulative += day.hours ?? 0
      return `${40 + ((index + 1) / cycle.days.length) * 620},${160 - (cumulative / maxChart) * 130}`
    })
    .join(' ')
  return (
    <article className="panel trend-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h2>Building momentum</h2>
        </div>
        <div className="legend">
          <span>
            <i />
            Logged
          </span>
          <span>
            <i className="legend-target" />
            Target pace
          </span>
        </div>
      </div>
      <div className="chart">
        <svg
          viewBox="0 0 700 190"
          role="img"
          aria-label={
            complete && hasData
              ? `Cumulative hours: ${total.toFixed(1)} of ${target} target hours across ${elapsed} days.`
              : 'Cumulative chart awaiting complete data'
          }
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((level) => (
            <g key={level}>
              <line
                x1="40"
                x2="660"
                y1={160 - level * 130}
                y2={160 - level * 130}
                className="chart-grid"
              />
              <text x="0" y={164 - level * 130}>
                {Math.round(maxChart * level)}h
              </text>
            </g>
          ))}
          <line
            x1="40"
            y1="160"
            x2="660"
            y2={160 - (target / maxChart) * 130}
            className="target-line"
          />
          {complete && hasData && (
            <>
              <polygon
                points={`40,160 ${linePoints} ${40 + (logs.length / cycle.days.length) * 620},160`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={`40,160 ${linePoints}`}
                className="logged-line"
              />
            </>
          )}
          <text x="40" y="185">
            {formatDate(cycle.start)}
          </text>
          <text x="660" y="185" textAnchor="end">
            {formatDate(cycle.end)}
          </text>
        </svg>
        {(!complete || !hasData) && (
          <div className="chart-placeholder">
            {loading
              ? 'Finding your rhythm…'
              : missing
                ? 'Complete data needed for your trend'
                : 'Your progress will take shape here'}
          </div>
        )}
      </div>
      <p className="chart-caption">
        {hasData && complete
          ? 'Cumulative hours · target pace assumes an even daily schedule.'
          : 'Load your hours to follow your progress through the cycle.'}
      </p>
    </article>
  )
}
