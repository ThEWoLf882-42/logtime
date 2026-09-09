import Icon from './components/Icon'
import DailyActivity from './components/DailyActivity'
import TrendChart from './components/TrendChart'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLogs } from './hooks/useLogs'
import {
  dateKey,
  campusToday,
  currentMonth,
  formatDate,
  getCycle,
  shiftMonth,
} from './lib/calendar'
import { readSetting, saveSetting, validTarget } from './lib/storage'
import type { DayLog } from './lib/api'

function App() {
  const [today, setToday] = useState(campusToday)
  const [month, setMonth] = useState(() => currentMonth(today))
  const [login, setLogin] = useState(() => readSetting('lastLogin'))
  const [submittedLogin, setSubmittedLogin] = useState('')
  const [demo, setDemo] = useState(false)
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
  const result = useLogs(demo ? '' : submittedLogin, month, today, refresh)
  const started = cycle.days.filter((day) => day <= today)
  const demoLogs = useMemo<DayLog[]>(
    () =>
      cycle.days
        .filter((day) => day <= today)
        .map((day, index) => ({
          date: dateKey(day),
          hours: [5.5, 7.2, 0, 4.8, 6.3, 8.1, 0, 3.5, 7.6, 5.2][index % 10],
        })),
    [cycle, today],
  )
  const logs = demo ? demoLogs : result.logs
  const ready = demo || result.status === 'ready'
  const loading = !demo && result.status === 'loading'
  const missing = logs.filter((day) => day.hours === null).length
  const complete = ready && missing === 0
  const hasData = ready && logs.some((day) => day.hours !== null)
  const total = logs.reduce((sum, day) => sum + (day.hours ?? 0), 0)
  const elapsed = started.length
  const average = elapsed ? total / elapsed : 0
  const remaining = Math.max(target - total, 0)
  const availableDays = cycle.days.filter((day) => day >= today).length
  const needed = availableDays ? remaining / availableDays : 0
  const projected = average * cycle.days.length
  const best = logs
    .filter((day) => (day.hours ?? 0) > 0)
    .sort((a, b) => b.hours! - a.hours!)[0]
  const progress = Math.min((total / target) * 100, 100)
  const past = cycle.end < today
  const future = cycle.start > today
  const isCurrent = dateKey(month) === dateKey(currentMonth(today))
  const dailyPace = target / cycle.days.length
  const hourMap = new Map(logs.map((day) => [day.date, day.hours]))

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
    setDemo(false)
    setRefresh((value) => value + 1)
  }
  function exportCsv() {
    const csv = [
      'date,hours,status',
      ...cycle.days.map((day) => {
        const hours = hourMap.get(dateKey(day))
        return `${dateKey(day)},${hours ?? ''},${day > today ? 'upcoming' : hours == null ? 'unavailable' : 'recorded'}`
      }),
    ].join('\r\n')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `logtime-${demo ? 'demo-' : ''}${dateKey(cycle.start)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const statusText = demo
    ? 'Demo data · sample hours'
    : loading
      ? `Loading ${result.completed} of ${elapsed} days…`
      : result.status === 'error'
        ? 'Couldn’t load this cycle'
        : ready
          ? missing
            ? `${missing} ${missing === 1 ? 'day' : 'days'} unavailable · totals are partial`
            : future
              ? 'This cycle hasn’t started'
              : `Loaded for ${submittedLogin}`
          : 'Ready when you are'
  const insight =
    !complete || !hasData
      ? 'A little clarity for your next session.'
      : remaining === 0
        ? 'Target reached. Nicely done.'
        : past
          ? 'One cycle closed. A fresh start ahead.'
          : projected >= target
            ? 'Keep going. You’re on pace.'
            : 'Small sessions add up.'

  return (
    <main className="app-shell">
      <a className="skip-link" href="#day-board">
        Skip to daily activity
      </a>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Logtime home">
          <span className="brand-mark">
            <Icon name="clock" />
          </span>
          logtime
          <span className="brand-divider" />
          <span className="brand-subtitle">Make time count.</span>
        </a>
        <div className="topbar-right">
          <span className="campus-label">1337 · MED</span>
          <button
            className="icon-button"
            onClick={() => setDark(!dark)}
            aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
          >
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">YOUR TIME, AT A GLANCE</p>
          <h1>
            Every hour counts<span>.</span>
          </h1>
          <p className="hero-copy">
            A clearer view of your progress, one cycle at a time.
          </p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="login">Your campus login</label>
          <div className="input-group">
            <span aria-hidden="true">@</span>
            <input
              id="login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Enter your login"
            />
            <button className="primary-button" type="submit">
              {loading ? 'Load again' : 'Load hours'}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      </section>

      <section className="toolbar" aria-label="Cycle settings">
        <div className="cycle-control">
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous cycle"
          >
            ←
          </button>
          <div>
            <span className="control-label">
              {isCurrent
                ? 'Current cycle'
                : past
                  ? 'Past cycle'
                  : 'Upcoming cycle'}
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
          >
            →
          </button>
          {!isCurrent && (
            <button
              className="text-button"
              onClick={() => setMonth(currentMonth(today))}
            >
              Today
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <label className="target-input" htmlFor="target">
            Cycle target
            <div>
              <input
                id="target"
                aria-label="Cycle target"
                type="number"
                min="1"
                max="999"
                step="1"
                value={targetInput}
                onChange={(event) => {
                  const value = event.target.value
                  setTargetInput(value)
                  if (value && Number(value) >= 1 && Number(value) <= 999)
                    setTarget(Number(value))
                }}
                onBlur={() => setTargetInput(String(target))}
              />
              <span>h</span>
            </div>
          </label>
          <button
            className="secondary-button export-button"
            onClick={exportCsv}
            disabled={!hasData}
          >
            <Icon name="download" />
            Export CSV
          </button>
        </div>
      </section>

      <div
        className={`status-bar ${!demo && (missing || result.status === 'error') ? 'status-warning' : ''}`}
        role="status"
      >
        <span
          className={`status-dot ${ready ? 'is-live' : ''} ${loading ? 'is-loading' : ''}`}
        />
        <span>{statusText}</span>
        {demo ? (
          <button className="text-button" onClick={() => setDemo(false)}>
            Exit demo
          </button>
        ) : submittedLogin && !loading ? (
          <button
            className="text-button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            <Icon name="refresh" />
            {result.status === 'error' || missing ? 'Retry' : 'Refresh'}
          </button>
        ) : null}
      </div>

      <section
        className="stats-grid"
        aria-label="Cycle statistics"
        aria-busy={loading}
      >
        <article className="stat-card stat-primary">
          <div className="stat-heading">
            Total logged
            <Icon name="clock" />
          </div>
          <div className="big-number">
            {hasData ? total.toFixed(1) : '—'}
            <span> / {target} h</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Cycle target progress"
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
          <div className="stat-foot">
            <span>
              {hasData
                ? `${Math.round((total / target) * 100)}% ${missing ? 'recorded' : 'complete'}`
                : 'Your next hour starts here'}
            </span>
            <span>{hasData && `${remaining.toFixed(1)} h to go`}</span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-heading">
            Daily average<span className="stat-symbol">↗</span>
          </span>
          <div className="metric-number">
            {hasData && complete ? average.toFixed(1) : '—'}
            <span>h / day</span>
          </div>
          <p>
            {hasData && complete
              ? `Across ${elapsed} started days`
              : 'Waiting for complete data'}
          </p>
        </article>
        <article className="stat-card">
          <span className="stat-heading">
            {past ? 'Cycle result' : 'Projected total'}
            <span className="stat-symbol">◎</span>
          </span>
          <div className="metric-number">
            {hasData && complete ? (past ? total : projected).toFixed(1) : '—'}
            <span>h</span>
          </div>
          <p
            className={
              hasData && complete
                ? projected >= target
                  ? 'positive'
                  : 'warning'
                : ''
            }
          >
            {hasData && complete
              ? past
                ? remaining === 0
                  ? 'Target achieved'
                  : `${remaining.toFixed(1)} h short of target`
                : projected >= target
                  ? 'On pace for your target'
                  : 'Room to pick up the pace'
              : 'Your pace will appear here'}
          </p>
        </article>
        <article className="stat-card">
          <span className="stat-heading">
            Best day<span className="stat-symbol">✧</span>
          </span>
          <div className="metric-number">
            {best ? best.hours!.toFixed(1) : '—'}
            <span>h</span>
          </div>
          <p>
            {best
              ? `${formatDate(new Date(best.date), { weekday: 'short', month: 'short', day: 'numeric' })}${missing ? ' · so far' : ''}`
              : 'A new personal best awaits'}
          </p>
        </article>
      </section>

      {!submittedLogin && !demo && (
        <section className="welcome-panel">
          <div className="welcome-icon">
            <Icon name="clock" />
          </div>
          <div>
            <h2>Your time. Your rhythm.</h2>
            <p>
              Enter your campus login to see your hours, spot patterns, and plan
              your next session.
            </p>
          </div>
          <button className="secondary-button" onClick={() => setDemo(true)}>
            Explore a demo <span aria-hidden="true">→</span>
          </button>
        </section>
      )}
      {result.status === 'error' && !demo && (
        <div className="error-panel">
          <strong>Your hours couldn’t be reached.</strong>
          <p>
            Check your login and connection, then retry. The service may be
            temporarily unavailable. No hours have been assumed.
          </p>
        </div>
      )}

      <section className="overview-grid">
        <TrendChart
          cycle={cycle}
          logs={logs}
          target={target}
          total={total}
          complete={complete}
          hasData={hasData}
          elapsed={elapsed}
          loading={loading}
          missing={missing}
        />
        <article className="pace-panel">
          <div className="pace-heading">
            <p className="eyebrow">A LITTLE DIRECTION</p>
            <span aria-hidden="true">↗</span>
          </div>
          <h2>{insight}</h2>
          <div className="pace-number">
            {complete && hasData && !past && !future ? needed.toFixed(1) : '—'}
            <span>h / day</span>
          </div>
          <p>
            {past
              ? 'This cycle has ended. Head to the current cycle to plan ahead.'
              : future
                ? 'Your plan starts when this cycle begins.'
                : `${availableDays} days left, including today, to work toward your ${target} hour target.`}
          </p>
          <div className="pace-footer">
            <span className="little-spark">✳</span> Consistency makes the
            difference.
          </div>
        </article>
      </section>

      <DailyActivity
        days={cycle.days}
        today={today}
        logs={logs}
        ready={ready}
        loading={loading}
        error={result.status === 'error'}
        hasData={hasData}
        dailyPace={dailyPace}
      />
      <footer className="footer">
        <span>
          <strong>logtime</strong> A little more intentional, every day.
        </span>
        <span>
          {demo
            ? 'Sample data · not your real hours'
            : result.updated
              ? `Last loaded ${result.updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Source: logtime-med API'}
          <span className="footer-separator">·</span>Casablanca calendar
        </span>
      </footer>
    </main>
  )
}

export default App
