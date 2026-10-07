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
  campusHoursElapsed,
  campusToday,
  currentMonth,
  dateKey,
  daysBetween,
  formatDate,
  getCycle,
  shiftMonth,
} from './lib/calendar'
import { describeDays, FULL_DAY_HOURS } from './lib/days'
import { clampHeat, GOAL_HEAT_LABELS, heatColor, heatTier } from './lib/heat'
import {
  capacityUntil,
  DAY_LIMIT_HOURS,
  DEAD,
  earliestFinish,
  finishPlan,
  LOAD_FACES,
  REALISTIC_HOURS,
  type Clock,
} from './lib/plan'
import { readSetting, saveSetting, validTarget } from './lib/storage'

const THEME_COLORS = { dark: '#121211', light: '#f3f1ec' }
const trim = (value: number) => String(Number(value.toFixed(1)))
const shortDate = (date: Date) =>
  formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })

export default function App() {
  const [today, setToday] = useState(campusToday)
  const [clockHours, setClockHours] = useState(campusHoursElapsed)
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
  // An optional day to finish the goal by, kept until it passes.
  const [finishBy, setFinishBy] = useState<string | null>(
    () => readSetting('finishBy') || null,
  )
  const [preview, setPreview] = useState<string | null>(null)
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
    const timer = window.setInterval(() => {
      setToday((previous) => {
        const next = campusToday()
        return dateKey(previous) === dateKey(next) ? previous : next
      })
      setClockHours(campusHoursElapsed())
    }, 60000)
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
    saveSetting('finishBy', finishBy ?? '')
  }, [finishBy])
  useEffect(() => {
    // Arrow keys move between cycles and T returns to today, outside fields.
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable], .day-pick',
        )
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
  const todayKey = dateKey(today)
  const clock: Clock = {
    today,
    hoursLeftToday: Math.max(DAY_LIMIT_HOURS - clockHours, 0),
    loggedToday: result.logs.find((log) => log.date === todayKey)?.hours ?? 0,
  }
  const cycleCapacity = DAY_LIMIT_HOURS * cycle.days.length
  // Finish dates are planned inside the current cycle, from today on, for
  // goals the cycle can hold at all.
  const canPlan = active && hasData && remaining > 0 && target <= cycleCapacity
  const finishDay =
    canPlan && finishBy
      ? (cycle.days.find((day) => dateKey(day) === finishBy && day >= today) ??
        null)
      : null
  const finishKey = finishDay ? dateKey(finishDay) : null
  const plans = canPlan
    ? new Map(
        cycle.days
          .filter((day) => day >= today)
          .map((day) => [dateKey(day), finishPlan(remaining, day, clock)]),
      )
    : null
  const plan = plans?.get(finishKey ?? dateKey(cycle.end)) ?? null
  const needed = plan?.perDay ?? (daysLeft ? remaining / daysLeft : 0)
  const earliest = canPlan ? earliestFinish(remaining, cycle.days, clock) : null
  const realistic = canPlan
    ? earliestFinish(remaining, cycle.days, clock, REALISTIC_HOURS)
    : null
  const loadHeat = clampHeat((needed - FULL_DAY_HOURS) / 6)
  // Plans that cannot fit in the hours left are named, with one-click fixes.
  let planAlert: {
    tone: 'impossible' | 'heavy'
    text: string
    fixes: Array<{ label: string; date: Date }>
  } | null = null
  // "No sleep" is the earliest date at 24 h a day; "Survivable" is 12 h a day.
  const fixes = [
    ...(earliest && plan && !plan.possible
      ? [{ label: 'No sleep', date: earliest }]
      : []),
    ...(realistic &&
    plan &&
    realistic > plan.date &&
    dateKey(realistic) !== (earliest && dateKey(earliest))
      ? [{ label: 'Survivable', date: realistic }]
      : []),
  ]
  // The jokes get darker as the load climbs, ending at what a day can't hold.
  const heavyJokes = [
    '',
    'Sleep is optional now.',
    'Zombie mode unlocked.',
    'Pick a coffin.',
  ]
  if (canPlan && !earliest)
    planAlert = {
      tone: 'impossible',
      text: `${DEAD} Only ${trim(capacityUntil(cycle.end, clock))} h left this cycle. ${trim(target)} h? Not in this life.`,
      fixes: [],
    }
  else if (plan && !plan.possible)
    planAlert = {
      tone: 'impossible',
      text:
        plan.perDay > DAY_LIMIT_HOURS
          ? `${DEAD} ${trim(plan.perDay)} h a day by ${shortDate(plan.date)}? Days have 24. RIP.`
          : `${DEAD} Only ${trim(plan.capacity)} h left before ${shortDate(plan.date)}, you need ${trim(remaining)}. RIP.`,
      fixes,
    }
  else if (plan && plan.perDay > REALISTIC_HOURS)
    planAlert = {
      tone: 'heavy',
      text: `${LOAD_FACES[heatTier(loadHeat)]} ${trim(plan.perDay)} h a day until ${shortDate(plan.date)}. ${heavyJokes[heatTier(loadHeat)]}`,
      fixes,
    }
  const best = result.logs
    .filter((day) => (day.hours ?? 0) > 0)
    .sort((a, b) => b.hours! - a.hours!)[0]
  const loggedDays = result.logs.filter((day) => (day.hours ?? 0) > 0).length
  // Pace compares the total with the goal spread evenly up to the finish
  // date, measured to mid-today.
  const planDays = finishDay
    ? daysBetween(cycle.start, finishDay) + 1
    : cycle.days.length
  const expected = active
    ? target * Math.min(Math.max(elapsed - 0.5, 0) / planDays, 1)
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
          : plan && !plan.possible
            ? 'Not humanly possible'
            : finishDay
              ? `Until ${shortDate(finishDay)}`
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
              {finishDay ? (
                <button
                  type="button"
                  className="finish-chip"
                  title="Finish with the cycle instead"
                  onClick={() => setFinishBy(null)}
                >
                  by {shortDate(finishDay)}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">, clear finish date</span>
                </button>
              ) : null}
            </p>
            {target > cycleCapacity && (
              <p className="goal-note">
                {DEAD} {cycleCapacity}&thinsp;h max. Afterlife hours don’t
                count.
              </p>
            )}
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
                  title={`Compared with your goal spread evenly until ${finishDay ? shortDate(finishDay) : 'the cycle ends'}`}
                >
                  {paceText}
                </li>
              )}
            </ul>
            {planAlert && (
              <div
                className={`plan-alert is-${planAlert.tone}`}
                style={
                  planAlert.tone === 'heavy'
                    ? ({ '--heat': heatColor(loadHeat) } as CSSProperties)
                    : undefined
                }
              >
                <p>{planAlert.text}</p>
                {planAlert.fixes.map((fix) => (
                  <button
                    key={fix.label}
                    type="button"
                    className="fix-button"
                    onClick={() => setFinishBy(dateKey(fix.date))}
                  >
                    {fix.label}: {shortDate(fix.date)}
                  </button>
                ))}
              </div>
            )}
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
                    : finishDay && plan
                      ? `${plan.days} ${plan.days === 1 ? 'day' : 'days'} to your date`
                      : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
              </small>
            </article>
            <article className="stat-card">
              <h3>Needed per day</h3>
              <p
                className={
                  plan && !plan.possible
                    ? 'is-impossible'
                    : needed > REALISTIC_HOURS
                      ? 'is-heavy'
                      : undefined
                }
                style={{ '--heat': heatColor(loadHeat) } as CSSProperties}
              >
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
            {canPlan && !finishDay && (
              <p className="finish-hint">Pick a day below to finish early</p>
            )}
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
            plans={plans}
            finishKey={finishKey}
            preview={preview}
            onPreview={setPreview}
            onPick={setFinishBy}
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
