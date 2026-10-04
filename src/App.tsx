import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Icon from './components/Icon'
import Ruler from './components/Ruler'
import DailyGrid from './components/DailyGrid'
import { useLogs } from './hooks/useLogs'
import { useTween } from './hooks/useTween'
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

const THEME_COLORS = { dark: '#121211', light: '#f3f1ec' }

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
  const shownTotal = useTween(total)
  const remaining = Math.max(target - total, 0)
  const progress = Math.min((total / target) * 100, 100)
  const isCurrent = dateKey(month) === dateKey(currentMonth(today))
  const past = cycle.end < today
  const future = cycle.start > today
  const active = !past && !future
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
    const theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme])
    saveSetting('theme', theme)
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
  const expected = active
    ? (target * Math.max(elapsed - 0.5, 0)) / cycle.days.length
    : null
  const pace =
    hasData && expected !== null && remaining > 0 ? total - expected : null
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
    <div className="app-shell">
      {loading && (
        <div
          className="load-line"
          aria-hidden="true"
          style={
            {
              '--done': started ? result.completed / started : 0,
            } as CSSProperties
          }
        />
      )}
      <section className="controls" aria-label="Logtime controls">
        <h1 className="brand">
          <b>log</b>time
        </h1>
        <form className="login-form" onSubmit={submit}>
          <div className="field login-field">
            <label htmlFor="login">
              <span className="sr-only">Your campus </span>
              <span className="capitalize">login</span>
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
          </button>
        </form>
        <div className="cycle-control">
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous cycle"
            aria-keyshortcuts="ArrowLeft"
            title="Previous cycle (←)"
          >
            <Icon name="previous" size={18} />
          </button>
          <div className="cycle-text">
            <span className="cycle-label">
              {isCurrent
                ? 'Current cycle'
                : past
                  ? 'Past cycle'
                  : future
                    ? 'Upcoming cycle'
                    : 'Previous cycle'}
            </span>
            <strong>
              {formatDate(cycle.start)} — {formatDate(cycle.end)}
              <span className="cycle-year">, {cycle.end.getUTCFullYear()}</span>
            </strong>
          </div>
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next cycle"
            aria-keyshortcuts="ArrowRight"
            title="Next cycle (→)"
          >
            <Icon name="next" size={18} />
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
          <Icon name={dark ? 'sun' : 'moon'} size={18} />
        </button>
      </section>

      <main className="workspace">
        <section
          className="summary"
          aria-labelledby="summary-title"
          aria-busy={loading}
        >
          <div className="hero">
            <h2 id="summary-title">Hours logged</h2>
            <p className="hero-value">
              <span className="total-hours">
                {hasData ? shownTotal.toFixed(1) : '—'}
              </span>
              <span className="hero-goal">
                of{' '}
                <input
                  id="target"
                  className="goal-input"
                  aria-label="Required hours"
                  title="Edit required hours"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="999"
                  step="any"
                  value={targetInput}
                  style={
                    {
                      '--digits': Math.max(targetInput.length, 2),
                    } as CSSProperties
                  }
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
                &thinsp;h required
              </span>
            </p>
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
            </ul>
          </div>
          <div className="stats">
            <article className="stat-card">
              <h3>Remaining</h3>
              <p>
                <span className="remaining">
                  {hasData ? remaining.toFixed(1) : '—'}
                </span>
                <span className="unit">h</span>
              </p>
              <small>
                {past
                  ? 'Cycle ended'
                  : future
                    ? 'Not started'
                    : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
              </small>
            </article>
            <article className="stat-card">
              <h3>Needed per day</h3>
              <p>
                {hasData && active ? needed.toFixed(1) : '—'}
                <span className="unit">h</span>
              </p>
              <small>{neededNote}</small>
            </article>
            <article className="stat-card">
              <h3>Daily average</h3>
              <p>
                {hasData ? average.toFixed(1) : '—'}
                <span className="unit">h</span>
              </p>
              <small>
                {elapsed} started {elapsed === 1 ? 'day' : 'days'}
              </small>
            </article>
            <article className="stat-card">
              <h3>Best day</h3>
              <p>
                {best ? best.hours!.toFixed(1) : '—'}
                <span className="unit">h</span>
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
          <Ruler
            total={result.total}
            target={target}
            expected={expected}
            goalHeat={goalHeat}
            valueNow={hasData ? Math.round(progress) : undefined}
            valueText={
              hasData
                ? `${total.toFixed(1)} of ${target} hours`
                : 'No data loaded'
            }
          />
        </section>

        <section
          className="daily-panel"
          aria-labelledby="daily-title"
          aria-busy={loading}
        >
          <div className="daily-heading">
            <h2 id="daily-title">Daily hours</h2>
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
            <ul className="legend" aria-hidden="true">
              <li className="legend-logged">
                {hasDailyData ? loggedDays : '—'} of {cycle.days.length} days
                logged
              </li>
              {active && hasData && remaining > 0 && (
                <li className="legend-need">Needed per day</li>
              )}
              <li className="legend-heat">Over 12 h</li>
            </ul>
          </div>
          <DailyGrid
            days={days}
            needed={hasData && active && remaining > 0 ? needed : null}
          />
        </section>
      </main>

      <footer className="app-footer">
        <p className="shortcuts">
          <kbd>←</kbd>
          <kbd>→</kbd> cycles <kbd>T</kbd> today
          <span> · Cycles run from the 28th to the 27th, campus time</span>
        </p>
        <p className="signature">
          made with <span className="signature-love">love</span> by{' '}
          <span className="signature-name">Aymane Gimi</span>
        </p>
      </footer>
    </div>
  )
}
