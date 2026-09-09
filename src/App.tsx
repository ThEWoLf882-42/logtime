import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

type LogEntry = {
  date: string
  hours: number
}

type ApiRecord = Record<string, unknown>

const API_URL = 'https://logtime-med.1337.ma/api/get_log'
const LOGIN_STORAGE_KEY = 'logtime.lastLogin'
const THEME_STORAGE_KEY = 'logtime.theme'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value.replace(',', '.')) || 0
  return 0
}

function normalizeRecords(payload: unknown, fallbackDate: Date): LogEntry[] {
  const response = payload as ApiRecord
  const records = Array.isArray(payload) ? payload : (response?.data || response?.logs || response?.['hydra:member'] || [])
  if (!Array.isArray(records)) return []
  return records.map((item, index) => {
    if (typeof item === 'number' || typeof item === 'string') {
      const date = new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate() + index).toISOString().slice(0, 10)
      return { date, hours: toNumber(item) }
    }
    const row = item as ApiRecord
    const rawDate = row.date || row.day || row.created_at || row.createdAt
    const rawHours = row.hours || row.hour || row.duration || row.logtime || row.time || row.totalHours
    if (!rawDate && row.totalHours !== undefined) return null
    return { date: String(rawDate || new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate() + index).toISOString().slice(0, 10)), hours: toNumber(rawHours) }
  }).filter((entry): entry is LogEntry => entry !== null && entry.hours >= 0)
}

function extractHours(payload: unknown, fallbackDate: Date) {
  const normalized = normalizeRecords(payload, fallbackDate)
  if (normalized.length) return normalized.reduce((sum, entry) => sum + entry.hours, 0)
  const response = payload as ApiRecord
  const members = Array.isArray(response?.['hydra:member']) ? response['hydra:member'] as ApiRecord[] : []
  return members.reduce((sum, member) => sum + toNumber(member.totalHours), 0)
}

function getCycleStart() {
  const today = new Date()
  return today.getDate() <= 28 ? new Date(today.getFullYear(), today.getMonth() - 1, 29) : new Date(today.getFullYear(), today.getMonth(), 29)
}

function shiftCycleStart(start: Date, amount: number) {
  const direction = amount >= 0 ? 1 : -1
  let targetMonth = new Date(start.getFullYear(), start.getMonth() + amount, 1)
  while (new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate() < 29) {
    targetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + direction, 1)
  }
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 29)
}

function formatCycleDate(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

function formatApiDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - 1, 23)).toISOString()
}

function App() {
  const [cycleStart, setCycleStart] = useState(() => getCycleStart())
  const [login, setLogin] = useState(() => localStorage.getItem(LOGIN_STORAGE_KEY) || '')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [submittedLogin, setSubmittedLogin] = useState('')
  const [target, setTarget] = useState(100)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [apiState, setApiState] = useState<'idle' | 'live' | 'error'>('idle')
  const [loadRequest, setLoadRequest] = useState(0)
  const cycleCache = useRef(new Map<string, LogEntry[]>())
  const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 28)
  const daysInCycle = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1

  useEffect(() => {
    const loadLogs = async () => {
      if (!submittedLogin) {
        setLogs([])
        setApiState('idle')
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const elapsedDays = Math.min(daysInCycle, Math.max(0, Math.floor((todayStart.getTime() - cycleStart.getTime()) / 86400000) + 1))
        const dayLogs = await Promise.all(Array.from({ length: elapsedDays }, async (_, index) => {
          const date = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate() + index)
          const apiDate = formatApiDate(date)
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              login: submittedLogin,
              startDate: apiDate,
              endDate: apiDate,
            }),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return { date: date.toISOString().slice(0, 10), hours: extractHours(await response.json(), date) }
        }))
        setLogs(dayLogs)
        cycleCache.current.set(`${submittedLogin}:${formatApiDate(cycleStart)}`, dayLogs)
        setApiState('live')
      } catch {
        setLogs([])
        setApiState('error')
      } finally {
        setIsLoading(false)
      }
    }
    loadLogs()
  }, [loadRequest])

  const cycleLogs = useMemo(() => Array.from({ length: daysInCycle }, (_, index) => {
    const date = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    const match = logs.find((entry) => entry.date.slice(0, 10) === key)
    return { date, hours: match?.hours ?? 0 }
  }), [cycleStart, daysInCycle, logs])

  const total = cycleLogs.reduce((sum, day) => sum + day.hours, 0)
  const progress = Math.min((total / target) * 100, 100)
  const elapsed = cycleLogs.filter((day) => day.date <= new Date()).length
  const average = elapsed ? total / elapsed : 0
  const projected = Math.round(average * daysInCycle)
  const remaining = Math.max(target - total, 0)
  const daysLeft = Math.max(daysInCycle - elapsed, 0)
  const neededPerDay = daysLeft ? remaining / daysLeft : 0
  const peak = cycleLogs.reduce((best, day) => day.hours > best.hours ? day : best, cycleLogs[0])
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const startedDays = cycleLogs.filter((day) => day.date <= todayStart)
  const loggedDays = startedDays.filter((day) => day.hours > 0).length
  const noLogDays = startedDays.filter((day) => day.hours === 0).length

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const shiftCycle = (amount: number) => {
    const nextStart = shiftCycleStart(cycleStart, amount)
    const cached = cycleCache.current.get(`${submittedLogin}:${formatApiDate(nextStart)}`)
    setCycleStart(nextStart)
    setLogs(cached || [])
    setApiState(cached ? 'live' : 'idle')
    if (submittedLogin && !cached) setLoadRequest((request) => request + 1)
  }

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextLogin = login.trim()
    if (nextLogin) localStorage.setItem(LOGIN_STORAGE_KEY, nextLogin)
    else localStorage.removeItem(LOGIN_STORAGE_KEY)
    setSubmittedLogin(nextLogin)
    setLoadRequest((request) => request + 1)
  }

  return (
    <main className="app-shell">
      <section className="hero compact-hero">
        <div><p className="eyebrow">Logtime</p><h1>Cycle overview</h1></div>
        <div className="header-controls">
          <form className="login-form" onSubmit={submitLogin}><label htmlFor="login">Login</label><input id="login" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="your login" /><button type="submit">Load</button></form>
          <label className="target-inline" htmlFor="target"><span>Target</span><input id="target" type="number" min="1" max="999" value={target} onChange={(event) => setTarget(Math.max(1, Number(event.target.value)))} /><b>h</b></label>
          <button className="theme-toggle" type="button" onClick={() => setIsDarkMode((dark) => !dark)} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{isDarkMode ? '☀' : '☾'}</button>
        <div className="cycle-control">
          <button onClick={() => shiftCycle(-1)} aria-label="Previous cycle">←</button>
          <div><span className="control-label">Current cycle</span><strong>{formatCycleDate(cycleStart)} — {formatCycleDate(cycleEnd)}</strong></div>
          <button onClick={() => shiftCycle(1)} aria-label="Next cycle">→</button>
        </div>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card stat-primary">
          <div className="stat-heading"><span>Total logged</span><span className="mini-label">of {target}h target</span></div>
          <div className="big-number">{total.toFixed(1)}<span>h</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="stat-foot"><span>{Math.round(progress)}% complete</span><span>{remaining.toFixed(1)}h to go</span></div>
        </article>
        <article className="stat-card"><span className="stat-heading">Projected finish</span><div className="metric-number">{projected}<span>h</span></div><p className={projected >= target ? 'positive' : 'warning'}>{projected >= target ? 'On track to clear target' : 'A little more pace needed'}</p></article>
        <article className="stat-card"><span className="stat-heading">Daily average</span><div className="metric-number">{average.toFixed(1)}<span>h</span></div><p>Across {elapsed || 0} elapsed days</p></article>
        <article className="stat-card"><span className="stat-heading">Best day</span><div className="metric-number">{peak?.hours.toFixed(1) || '0'}<span>h</span></div><p>{peak ? peak.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No data yet'}</p></article>
      </section>

      <section className="content-grid">
        <article className="panel daily-panel">
          <div className="panel-header"><div><p className="eyebrow">Day by day</p><h2>Your month, in days</h2></div><span className="day-count">{startedDays.length} started / {daysInCycle} total</span></div>
          <div className="day-summary"><div><b>{loggedDays}</b><span>days logged</span></div><div><b>{noLogDays}</b><span>days with no log</span></div><div><b>{neededPerDay.toFixed(1)}h</b><span>needed per day</span></div></div>
          {!submittedLogin && <div className="board-empty">Enter your login above and press Load to see your real days.</div>}
          {submittedLogin && isLoading && <div className="board-empty">Loading each day from the API...</div>}
          {submittedLogin && !isLoading && apiState === 'error' && <div className="board-empty">The API request failed for this login.</div>}
          <div className="day-board">{cycleLogs.map((day) => {
            const isFuture = day.date > todayStart
            const status = isFuture ? 'Upcoming' : day.hours ? 'Logged' : 'No log'
              return <div className={`day-card ${isFuture ? 'is-future' : day.hours ? day.hours >= neededPerDay ? 'is-above' : 'is-below' : 'is-no-log'}`} key={`day-${day.date.toISOString()}`}><div className="day-card-top"><div><span className="day-number">{day.date.getDate()}</span><span className="day-name">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</span></div><span className="day-status">{status}</span></div><div className="day-hours">{isFuture ? '—' : day.hours.toFixed(1)}<span>{isFuture ? '' : 'h'}</span></div><div className="day-track"><i style={{ width: `${isFuture ? 0 : Math.min((day.hours / 8) * 100, 100)}%` }} /></div><div className="day-card-foot"><span>{day.date.toLocaleDateString('en-US', { month: 'short' })}</span><span>{isFuture ? 'Not requested' : day.hours ? day.hours >= neededPerDay ? 'Above pace' : 'Below pace' : 'Add time'}</span></div></div>
          })}</div>
        </article>

      </section>

      <footer className="footer"><span>Source: logtime-med API</span><span>{apiState === 'error' ? 'Request unavailable' : apiState === 'live' ? 'Live response loaded' : 'Waiting for Load'}</span></footer>
    </main>
  )
}

export default App
