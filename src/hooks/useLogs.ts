import { useEffect, useRef, useState } from 'react'
import { loadCycle, loadCycleTotal, type DayLog } from '../lib/api'
import { dateKey, getCycle } from '../lib/calendar'

type Result = {
  key: string
  logs: DayLog[]
  total: number | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  completed: number
  updated: Date | null
}
const empty: Result = {
  key: '',
  logs: [],
  total: null,
  status: 'idle',
  completed: 0,
  updated: null,
}

export function useLogs(
  login: string,
  month: Date,
  today: Date,
  refresh: number,
) {
  const key = `${login}:${dateKey(month)}:${dateKey(today)}:${refresh}`
  const cache = useRef(new Map<string, Result>())
  const [result, setResult] = useState<Result>(empty)
  useEffect(() => {
    if (!login) {
      setResult(empty)
      return
    }
    const cached = cache.current.get(key)
    if (
      cached &&
      cached.updated &&
      Date.now() - cached.updated.getTime() < 60000
    ) {
      setResult(cached)
      return
    }
    const controller = new AbortController()
    const cycle = getCycle(month)
    const days = cycle.days.filter((day) => day <= today)
    setResult({ ...empty, key, status: 'loading' })
    const totalRequest = days.length
      ? loadCycleTotal(login, cycle.start, cycle.end, controller.signal)
      : Promise.resolve(null)
    Promise.all([
      loadCycle(login, days, controller.signal, (completed) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({ ...previous, completed }))
      }),
      totalRequest,
    ])
      .then(([logs, total]) => {
        if (controller.signal.aborted) return
        const next: Result = {
          key,
          logs,
          total,
          status:
            logs.length > 0 && logs.every((log) => log.hours === null)
              ? 'error'
              : 'ready',
          completed: days.length,
          updated: new Date(),
        }
        if (total !== null && logs.every((log) => log.hours !== null)) {
          if (cache.current.size >= 12)
            cache.current.delete(cache.current.keys().next().value!)
          cache.current.set(key, next)
        }
        setResult(next)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ ...empty, key, status: 'error' })
      })
    return () => controller.abort()
  }, [key, login, month, today])
  // Hide previous results during the render before the effect switches cycles.
  return result.key === key
    ? result
    : { ...empty, status: login ? ('loading' as const) : ('idle' as const) }
}
