import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Icon from './components/Icon'
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
  const [dark, setDark] = useState(
    () => readSetting('theme', 'dark') === 'dark',
  )
  const cycle = useMemo(() => getCycle(month), [month])
  const result = useLogs(submittedLogin, month, today)
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
  const totalFailed = result.totalStatus === 'error'
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
      ?.setAttribute('content', dark ? '#111716' : '#eff1e9')
    saveSetting('theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    saveSetting('target', String(target))
  }, [target])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = login.trim()
    if (!next) return
    saveSetting('lastLogin', next)
    setSubmittedLogin(next)
    result.reload()
  }

  let status = 'Enter your campus login to check your hours.'
  if (loading)
    status = `Loading ${result.completed} of ${cycle.days.filter((day) => day <= today).length} days…`
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

  const elapsed = cycle.days.filter((day) => day <= today).length
  const average = elapsed ? total / elapsed : 0
  const needed = daysLeft ? remaining / daysLeft : 0
  const best = result.logs
    .filter((day) => (day.hours ?? 0) > 0)
    .sort((a, b) => b.hours! - a.hours!)[0]
  const loggedDays = result.logs.filter((day) => (day.hours ?? 0) > 0).length

  return (
    <main className="app-shell">
      <section className="controls" aria-label="Logtime controls">
        <form className="login-form" onSubmit={submit}>
          <div className="field login-field">
            <label htmlFor="login">Your campus login</label>
            <input
              id="login"
              required
              maxLength={64}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Your login"
            />
          </div>
          <button className="primary-button" type="submit">
            {loading ? 'Load again' : 'Check hours'}
          </button>
        </form>
        <div className="field required-field">
          <label htmlFor="target">Required hours</label>
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
        </div>
        <div className="cycle-control">
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous cycle"
          >
            ←
          </button>
          <div>
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
              {formatDate(cycle.start)} — {formatDate(cycle.end)},{' '}
              {cycle.end.getUTCFullYear()}
            </strong>
          </div>
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next cycle"
          >
            →
          </button>
          <button
            className="current-button"
            disabled={isCurrent}
            onClick={() => setMonth(currentMonth(today))}
            aria-label="Back to current cycle"
          >
            Today
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

      <section className="stats-grid" aria-label="Monthly progress">
        <article className="progress-card">
          <div
            className={`progress-ring ${result.totalStatus === 'loading' ? 'is-loading' : ''}`}
            role="progressbar"
            aria-label="Monthly hours progress"
            aria-busy={result.totalStatus === 'loading'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasData ? Math.round(progress) : undefined}
            aria-valuetext={
              hasData
                ? `${total.toFixed(1)} of ${target} hours`
                : 'No data loaded'
            }
          >
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle className="ring-guide" cx="100" cy="100" r="97" />
              <circle className="ring-track" cx="100" cy="100" r="86" />
              <circle
                className="ring-fill"
                cx="100"
                cy="100"
                r="86"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - (hasData ? progress : 0)}
              />
            </svg>
            <div className="ring-content">
              <span className="ring-label">Hours logged</span>
              <p className="total-hours">{hasData ? total.toFixed(1) : '—'}</p>
              <span className="ring-target">of {target} h</span>
            </div>
          </div>
          <div className="progress-details">
            <p className="eyebrow">Your monthly progress</p>
            <div className="remaining">
              <strong>
                {hasData ? remaining.toFixed(1) : '—'}
                <small> h</small>
              </strong>
              <span>Hours remaining</span>
            </div>
            <div
              className={`completion-badge ${hasData && remaining === 0 ? 'is-complete' : ''}`}
            >
              <i aria-hidden="true" />
              {hasData
                ? remaining === 0
                  ? 'Requirement met'
                  : `${Math.round((total / target) * 100)}% complete`
                : totalFailed
                  ? 'Total unavailable'
                  : 'No hours loaded yet'}
            </div>
            <span className="days-left">
              <Icon name="clock" />
              {past
                ? 'Cycle ended'
                : future
                  ? 'Not started'
                  : `${daysLeft} days left`}
            </span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-symbol" aria-hidden="true">
            <Icon name="average" />
          </span>
          <h2>Daily average</h2>
          <p>
            {hasData ? average.toFixed(1) : '—'}
            <span> h</span>
          </p>
          <small>{elapsed} started days</small>
        </article>
        <article className="stat-card">
          <span className="stat-symbol" aria-hidden="true">
            <Icon name="spark" />
          </span>
          <h2>Best day</h2>
          <p>
            {best ? best.hours!.toFixed(1) : '—'}
            <span> h</span>
          </p>
          <small>
            {best
              ? `${formatDate(new Date(best.date))}${missing || loading ? ' · loaded days' : ''}`
              : 'No logged hours yet'}
          </small>
        </article>
        <article className="stat-card">
          <span className="stat-symbol" aria-hidden="true">
            <Icon name="target" />
          </span>
          <h2>Needed per day</h2>
          <p>
            {hasData && !past && !future ? needed.toFixed(1) : '—'}
            <span> h</span>
          </p>
          <small>
            {past
              ? 'Cycle ended'
              : future
                ? 'Cycle not started'
                : 'Including today'}
          </small>
        </article>
      </section>

      <section
        className="daily-panel"
        aria-labelledby="daily-title"
        aria-busy={loading}
      >
        <div className="daily-heading">
          <h1 id="daily-title">Daily hours</h1>
          <div className={`status-row ${hasError ? 'has-error' : ''}`}>
            <p role="status">{status}</p>
            {submittedLogin && !loading && (
              <button
                className="text-button"
                onClick={() => result.reload(hasError ? 'retry' : 'refresh')}
              >
                {hasError ? 'Retry' : 'Refresh'}
              </button>
            )}
          </div>

          <p>
            <span className="logged-count">
              <i aria-hidden="true" />
              {hasDailyData ? loggedDays : '—'} days logged
            </span>
            <span className="cycle-count">
              {cycle.days.length} days in cycle
            </span>
          </p>
        </div>
        <DailyGrid
          key={dateKey(month)}
          days={cycle.days}
          today={today}
          logs={result.logs}
          status={result.status}
        />
      </section>
    </main>
  )
}
