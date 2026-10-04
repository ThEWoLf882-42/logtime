import { heatColor } from '../lib/heat'

type Props = {
  total: number | null
  target: number
  /** Hours expected by now if the goal were spread evenly; null outside an active cycle. */
  expected: number | null
  goalHeat: number
  valueText: string
  valueNow: number | undefined
}

const trim = (value: number) => String(Number(value.toFixed(1)))

/** A linear scale of the goal: logged hours, the even-pace mark, and any overrun. */
export default function Ruler({
  total,
  target,
  expected,
  goalHeat,
  valueText,
  valueNow,
}: Props) {
  const logged = total ?? 0
  // Past the goal, the scale stretches so the overrun stays in proportion.
  const scale = Math.max(target, logged)
  const at = (hours: number) => `${(Math.min(hours, scale) / scale) * 100}%`
  const ticks = Array.from({ length: 11 }, (_, index) => (target * index) / 10)
  // Labels near either end align inward so they never spill past the scale.
  const edge = (share: number) =>
    share <= 0.08 ? 'is-start' : share >= 0.92 ? 'is-end' : ''

  return (
    <div
      className="ruler"
      role="progressbar"
      aria-label="Monthly hours progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
    >
      <div className="ruler-track" aria-hidden="true">
        <span
          className="ruler-fill"
          style={{ width: at(Math.min(logged, target)) }}
        />
        <span
          className="ruler-over"
          style={{
            left: at(target),
            width: logged > target ? at(logged - target) : 0,
            background: heatColor(goalHeat),
          }}
        />
        {expected !== null && (
          <span
            className={`ruler-pace ${edge(expected / scale)}`}
            style={{ left: at(expected) }}
          >
            <em>Even pace</em>
          </span>
        )}
      </div>
      <div className="ruler-scale" aria-hidden="true">
        {ticks.map((value, index) => (
          <span
            key={index}
            className={`${index % 5 === 0 ? 'is-major' : ''} ${index === 0 || value === scale ? edge(value / scale) : ''}`}
            style={{ left: at(value) }}
          >
            {index === 10
              ? `${trim(target)} h`
              : index % 5 === 0
                ? trim(value)
                : null}
          </span>
        ))}
      </div>
    </div>
  )
}
