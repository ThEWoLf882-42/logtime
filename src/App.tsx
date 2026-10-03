import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Icon, { Mark } from './components/Icon'
import Dial from './components/Dial'
import DailyGrid from './components/DailyGrid'
import { useLogs } from './hooks/useLogs'
import {
  campusToday,
  currentMonth,
  dateKey,
  formatDate,
  getCycle,
  shiftMonth,
} from './lib/calendar'
import { describeDays } from './lib/days'
import { clampHeat, GOAL_HEAT_LABELS, heatColor, heatTier } from './lib/heat'
import { readSetting, saveSetting, validTarget } from './lib/storage'

export default function App() {
  const [today, setToday] = useState(campusToday)
  const [month, setMonth] = useState(() => currentMonth(today))
  const [login, setLogin] = useState(() => readSetting('lastLogin'))
  const [submittedLogin, setSubmittedLogin] = useState('')
  const [target, setTarget] = useState(() =>
    validTarget(readSetting('target', '100')),
  )
  const [targetInput, setTargetInput] = useState(String(target))
  // Dark is the default; a theme chosen with the toggle is remembered.
  const [dark, setDark] = useState(() => readSetting('theme') !== 'light')
  const [refresh, setRefresh] = useState(0)
  // The day under the pointer, shared by the dial and the grid.
  const [active, setActive] = useState<string | null>(null)
  const cycle = useMemo(() => getCycle(month), [month])
  const result = useLogs(submittedLogin, month, today, refresh)
  const days = useMemo(
    () => describeDays(cycle.days, today, result.logs, result.status),
    [cycle.days, today, result.logs, result.status],
  )
  const loading = result.status === 'loading'
  const missing = result.logs.filter((day) => day.hours === null).length
  const hasData = result.total !== null
  const hasDailyData = result.logs.some((day) => day.hours !== null)
  const total = result.total ?? 0
  const remaining = Math.max(target - total, 0)
  const progress = Math.min((total / target) * 100, 100)
  const isCurrent = dateKey(month) === dateKey(currentMonth(today))
  const past = cycle.end < today
  const future = cycle.start > today
  const totalFailed =
    !future &&
    !hasData &&
    (result.status === 'ready' || result.status === 'error')
  const hasError = totalFailed || missing > 0 || result.status === 'error'
  const daysLeft = cycle.days.filter((day) => day >= today).length

  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setToday((previous) => {
          const next = campusToday()
          return dateKey(previous) === dateKey(next) ? previous : next
        }),
      60000,
    )
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0d0c12' : '#f5f0e7')
    saveSetting('theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    saveSetting('target', String(target))
  }, [target])
  useEffect(() => {
    // Arrow keys move between cycles and T returns to today, outside fields.
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable]')
      )
        return
      if (event.key === 'ArrowLeft') setMonth((value) => shiftMonth(value, -1))
      else if (event.key === 'ArrowRight')
        setMonth((value) => shiftMonth(value, 1))
      else if (event.key === 't' || event.key === 'T')
        setMonth(currentMonth(today))
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [today])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = login.trim()
    if (!next) return
    saveSetting('lastLogin', next)
    setSubmittedLogin(next)
    setRefresh((value) => value + 1)
  }

  const started = cycle.days.filter((day) => day <= today).length
  let status = 'Enter your campus login to check your hours.'
  if (loading) status = `Loading ${result.completed} of ${started} days…`
  else if (totalFailed && !hasDailyData)
    status =
      'Couldn’t load your hours. Check your login and connection, then retry.'
  else if (totalFailed)
    status = 'Cycle total unavailable. Retry to load your progress.'
  else if (missing)
    status = `${missing} ${missing === 1 ? 'day' : 'days'} unavailable. Cycle total loaded.`
  else if (result.status === 'ready')
    status = future
      ? 'This cycle hasn’t started.'
      : `Loaded for ${submittedLogin}`

  const elapsed = started
  const average = elapsed ? total / elapsed : 0
  const needed = daysLeft ? remaining / daysLeft : 0
  const best = result.logs
    .filter((day) => (day.hours ?? 0) > 0)
    .sort((a, b) => b.hours! - a.hours!)[0]
  const loggedDays = result.logs.filter((day) => (day.hours ?? 0) > 0).length
  // Pace compares the total with the goal spread evenly, up to mid-today.
  const pace =
    hasData && !past && !future && remaining > 0
      ? total - (target * (elapsed - 0.5)) / cycle.days.length
      : null
  const paceText =
    pace === null
      ? null
      : Math.abs(pace) < 0.5
        ? 'On pace'
        : `${Math.abs(pace).toFixed(1)} h ${pace > 0 ? 'ahead of' : 'behind'} pace`
  // Hours past the goal heat up to the most drastic level at double the goal.
  const overGoal = hasData ? Math.max(total - target, 0) : 0
  const goalHeat = clampHeat(overGoal / target)
  const goalTier = heatTier(goalHeat)
  const neededNote = past
    ? 'Cycle ended'
    : future
      ? 'Cycle not started'
      : !hasData
        ? 'Including today'
        : remaining === 0
          ? 'Goal reached'
          : needed > average
            ? `${(needed - average).toFixed(1)} h above average`
            : 'Under your average'

  return (
    <main className="app-shell">
      <section className="controls" aria-label="Logtime controls">
        <div className="brand" aria-hidden="true">
          <Mark />
          <span>logtime</span>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="field login-field">
            <label htmlFor="login">
              <span className="sr-only">Your campus </span>login
            </label>
            <input
              id="login"
              required
              maxLength={64}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="your-login"
            />
          </div>
          <button className="primary-button" type="submit">
            {loading ? 'Load again' : 'Check hours'}
            <Icon name="enter" size={16} />
          </button>
        </form>
        <div className="field required-field">
          <label htmlFor="target">
            Required<span className="sr-only"> hours</span>
          </label>
          <input
            id="target"
            type="number"
            min="1"
            max="999"
            step="any"
            value={targetInput}
            onChange={(event) => {
              const value = event.target.value
              setTargetInput(value)
              if (
                value &&
                Number.isFinite(Number(value)) &&
                Number(value) >= 1 &&
                Number(value) <= 999
              )
                setTarget(Number(value))
            }}
            onBlur={() => setTargetInput(String(target))}
          />
          <span className="field-unit" aria-hidden="true">
            h
          </span>
        </div>
        <div className="cycle-control">
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous cycle"
            aria-keyshortcuts="ArrowLeft"
            title="Previous cycle (←)"
          >
            <Icon name="previous" />
          </button>
          <div className="cycle-text">
            <span className="cycle-label">
              {isCurrent
                ? 'Current'
                : past
                  ? 'Past'
                  : future
                    ? 'Upcoming'
                    : 'Previous'}
              <span className="wide-only"> cycle</span>
              <span className="narrow-only">
                {' '}
                · {cycle.end.getUTCFullYear()}
              </span>
            </span>
            <strong>
              {formatDate(cycle.start)} — {formatDate(cycle.end)}
              <span className="wide-only">, {cycle.end.getUTCFullYear()}</span>
            </strong>
          </div>
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next cycle"
            aria-keyshortcuts="ArrowRight"
            title="Next cycle (→)"
          >
            <Icon name="next" />
          </button>
          <button
            className="current-button"
            disabled={isCurrent}
            onClick={() => setMonth(currentMonth(today))}
            aria-keyshortcuts="T"
            title="Back to current cycle (T)"
          >
            Today<span className="sr-only">: back to current cycle</span>
          </button>
        </div>
        <button
          className="icon-button theme-button"
          onClick={() => setDark(!dark)}
          aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
        >
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
      </section>

      <section
        className="instrument"
        aria-label="Monthly progress"
        aria-busy={loading}
      >
        <article className="progress-card">
          <div className="progress-head">
            <h2>Hours logged</h2>
            <span className="day-chip">
              {past
                ? 'Cycle ended'
                : future
                  ? `Starts ${formatDate(cycle.start)}`
                  : `Day ${elapsed} of ${cycle.days.length}`}
            </span>
          </div>
          <div className="dial-stage">
            <Dial
              days={days}
              total={result.total}
              target={target}
              loading={loading}
              showToday={!past && !future}
              active={active}
              onActive={setActive}
              valueNow={hasData ? Math.round(progress) : undefined}
              valueText={
                hasData
                  ? `${total.toFixed(1)} of ${target} hours`
                  : 'No data loaded'
              }
            />
          </div>
          <div className="progress-info">
            <div className="remaining-block">
              <span>Hours remaining</span>
              <strong className="remaining">
                {hasData ? remaining.toFixed(1) : '—'}
                <small> h</small>
              </strong>
            </div>
            <ul className="progress-caption">
              <li className={hasData && remaining === 0 ? 'is-met' : ''}>
                {hasData
                  ? remaining === 0
                    ? 'Requirement met'
                    : `${Math.round((total / target) * 100)}% complete`
                  : totalFailed
                    ? 'Total unavailable'
                    : 'No hours loaded yet'}
              </li>
              {goalTier > 0 && (
                <li
                  className={`overshoot heat-${goalTier}`}
                  style={{ '--heat': heatColor(goalHeat) } as CSSProperties}
                >
                  {GOAL_HEAT_LABELS[goalTier]} · +{overGoal.toFixed(1)} h
                </li>
              )}
              {paceText && (
                <li
                  className={`pace ${pace! >= -0.5 ? 'is-ahead' : 'is-behind'}`}
                  title="Compared with your goal spread evenly across the cycle"
                >
                  {paceText}
                </li>
              )}
              <li>
                {past
                  ? 'Cycle ended'
                  : future
                    ? 'Not started'
                    : `${daysLeft} days left`}
              </li>
            </ul>
          </div>
        </article>
        <div className="readouts">
          <article className="stat-card">
            <h2>Needed per day</h2>
            <p>
              {hasData && !past && !future ? needed.toFixed(1) : '—'}
              <span> h</span>
            </p>
            <small>{neededNote}</small>
          </article>
          <article className="stat-card">
            <h2>Daily average</h2>
            <p>
              {hasData ? average.toFixed(1) : '—'}
              <span> h</span>
            </p>
            <small>{elapsed} started days</small>
          </article>
          <article className="stat-card">
            <h2>Best day</h2>
            <p>
              {best ? best.hours!.toFixed(1) : '—'}
              <span> h</span>
            </p>
            <small>
              {best
                ? formatDate(new Date(best.date), {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'No logged hours yet'}
            </small>
          </article>
        </div>
      </section>

      <section
        className="daily-panel"
        aria-labelledby="daily-title"
        aria-busy={loading}
      >
        <div className="daily-heading">
          <h1 id="daily-title">Daily hours</h1>
          <div
            className={`status-row ${hasError ? 'has-error' : ''} ${loading ? 'is-loading' : ''}`}
          >
            <p role="status">{status}</p>
            {submittedLogin && !loading && (
              <button
                className="text-button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                <Icon name="refresh" size={14} />
                {hasError ? 'Retry' : 'Refresh'}
              </button>
            )}
          </div>
          <p className="daily-meta">
            <span className="logged-count">
              <i aria-hidden="true" />
              {hasDailyData ? loggedDays : '—'}{' '}
              {loggedDays === 1 ? 'day' : 'days'} logged
            </span>
            <span className="cycle-count">
              {cycle.days.length} days in cycle
            </span>
            <span
              className="legend"
              aria-hidden="true"
              title="Each day fills toward 12 hours; longer days heat up to 18 hours and beyond"
            >
              0<i />
              12
              <i className="legend-heat" />
              18h+
            </span>
          </p>
        </div>
        <div className="weekdays" aria-hidden="true">
          {days.slice(0, 7).map((day) => (
            <span
              key={day.key}
              className={
                day.date.getUTCDay() % 6 === 0 ? 'is-weekend' : undefined
              }
            >
              {formatDate(day.date, { weekday: 'short' })}
            </span>
          ))}
        </div>
        <DailyGrid days={days} active={active} onActive={setActive} />
      </section>
      <p className="signature">
        made with <span className="signature-love">love</span> by{' '}
        <span className="signature-name">Aymane Gimi</span>
      </p>
    </main>
  )
}
