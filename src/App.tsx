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
    () =>
      readSetting(
        'theme',
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      ) === 'dark',
  )
  const [refresh, setRefresh] = useState(0)
  const cycle = useMemo(() => getCycle(month), [month])
  const result = useLogs(submittedLogin, month, today, refresh)
  const loading = result.status === 'loading'
  const missing = result.logs.filter((day) => day.hours === null).length
  const hasData =
    result.status === 'ready' && result.logs.some((day) => day.hours !== null)
  const complete = hasData && missing === 0
  const total = result.logs.reduce((sum, day) => sum + (day.hours ?? 0), 0)
  const remaining = Math.max(target - total, 0)
  const progress = Math.min((total / target) * 100, 100)
  const isCurrent = dateKey(month) === dateKey(currentMonth(today))
  const past = cycle.end < today
  const future = cycle.start > today
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
    setRefresh((value) => value + 1)
  }

  let status = 'Enter your campus login to check your hours.'
  if (loading)
    status = `Loading ${result.completed} of ${cycle.days.filter((day) => day <= today).length} days…`
  else if (result.status === 'error')
    status =
      'Couldn’t load your hours. Check your login and connection, then retry.'
  else if (missing)
    status = `${missing} ${missing === 1 ? 'day' : 'days'} unavailable. The total is incomplete.`
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
                  : 'Upcoming cycle'}
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

      <section
        className="stats-grid"
        aria-label="Monthly progress"
        aria-busy={loading}
      >
        <article className="progress-card">
          <div className="total-heading">
            <h2>
              {missing && hasData ? 'Hours loaded so far' : 'Hours logged'}
            </h2>
            <span className="remaining">
              {complete ? `${remaining.toFixed(1)} h remaining` : 'Remaining —'}
            </span>
          </div>
          <p className="total-hours">
            {hasData ? total.toFixed(1) : '—'}
            <span> / {target} h</span>
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Monthly hours progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasData ? Math.round(progress) : undefined}
            aria-valuetext={
              hasData
                ? `${total.toFixed(1)} of ${target} hours${missing ? ', partial data' : ''}`
                : 'No data loaded'
            }
          >
            <span style={{ width: `${hasData ? progress : 0}%` }} />
          </div>
          <div className="progress-caption">
            <span>
              {complete
                ? remaining === 0
                  ? 'Requirement met'
                  : `${Math.round((total / target) * 100)}% complete`
                : hasData
                  ? 'Partial total'
                  : 'No hours loaded yet'}
            </span>
            <span>
              {past
                ? 'Cycle ended'
                : future
                  ? 'Not started'
                  : `${daysLeft} days left`}
            </span>
          </div>
        </article>
        <article className="stat-card">
          <h2>Daily average</h2>
          <p>
            {complete ? average.toFixed(1) : '—'}
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
            {best ? formatDate(new Date(best.date)) : 'No logged hours yet'}
          </small>
        </article>
        <article className="stat-card">
          <h2>Needed per day</h2>
          <p>
            {complete && !past && !future ? needed.toFixed(1) : '—'}
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

      <div
        className={`status-row ${result.status === 'error' || missing ? 'has-error' : ''}`}
      >
        <p role="status">{status}</p>
        {submittedLogin && !loading && (
          <button
            className="text-button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            {result.status === 'error' || missing ? 'Retry' : 'Refresh'}
          </button>
        )}
      </div>

      <section
        className="daily-panel"
        aria-labelledby="daily-title"
        aria-busy={loading}
      >
        <div className="daily-heading">
          <h1 id="daily-title">Daily hours</h1>
          <p>
            <span>{hasData ? loggedDays : '—'} days logged</span>
            <span>{cycle.days.length} days in cycle</span>
          </p>
        </div>
        <DailyGrid
          days={cycle.days}
          today={today}
          logs={result.logs}
          status={result.status}
        />
      </section>
    </main>
  )
}
