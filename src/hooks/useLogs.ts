import { useEffect, useRef, useState } from 'react'
import { loadCycle, loadCycleTotal, type DayLog } from '../lib/api'
import { dateKey, getCycle } from '../lib/calendar'

type Status = 'idle' | 'loading' | 'ready' | 'error'
type Result = {
  key: string
  logs: DayLog[]
  total: number | null
  totalStatus: Status
  status: Status
  completed: number
  updated: Date | null
}
const empty: Result = {
  key: '',
  logs: [],
  total: null,
  totalStatus: 'idle',
  status: 'idle',
  completed: 0,
  updated: null,
}

export function useLogs(login: string, month: Date, today: Date) {
  const key = `${login}:${dateKey(month)}:${dateKey(today)}`
  const cache = useRef(new Map<string, Result>())
  const latest = useRef<Result>(empty)
  const [result, setResult] = useState<Result>(empty)
  const [request, setRequest] = useState({ id: 0, mode: 'refresh' })
  const previousRequest = useRef(0)

  useEffect(() => {
    const requested = previousRequest.current !== request.id
    previousRequest.current = request.id
    const controller = new AbortController()
    let current: Result = empty
    function publish(next: Result) {
      if (controller.signal.aborted) return
      current = next
      latest.current = next
      setResult(next)
    }
    if (!login) {
      publish(empty)
      return () => controller.abort()
    }
    const cached = cache.current.get(key)
    if (
      !requested &&
      cached?.updated &&
      Date.now() - cached.updated.getTime() < 60000
    ) {
      publish(cached)
      return () => controller.abort()
    }
    cache.current.delete(key)
    const cycle = getCycle(month)
    const days = cycle.days.filter((day) => day <= today)
    const retry =
      requested && request.mode === 'retry' && latest.current.key === key
    const seed = retry ? latest.current : empty
    const logs = seed.logs.filter((day) => day.hours !== null)
    const known = new Set(logs.map((day) => day.date))
    const pending = days.filter((day) => !known.has(dateKey(day)))
    const needsTotal = days.length > 0 && seed.total === null
    publish({
      ...empty,
      key,
      logs,
      total: seed.total,
      totalStatus: needsTotal
        ? 'loading'
        : seed.total !== null
          ? 'ready'
          : 'idle',
      status: 'loading',
      completed: logs.length,
    })

    const totalRequest = needsTotal
      ? loadCycleTotal(login, cycle.start, cycle.end, controller.signal).then(
          (total) => {
            publish({
              ...current,
              total,
              totalStatus: total === null ? 'error' : 'ready',
            })
          },
        )
      : Promise.resolve()
    const dailyRequest = loadCycle(
      login,
      pending,
      controller.signal,
      (_count, log) => {
        publish({
          ...current,
          logs: [...current.logs, log],
          completed: current.completed + 1,
        })
      },
    )
    Promise.all([totalRequest, dailyRequest])
      .then(() => {
        if (controller.signal.aborted) return
        const next: Result = {
          ...current,
          status:
            current.total === null &&
            days.length > 0 &&
            current.logs.every((log) => log.hours === null)
              ? 'error'
              : 'ready',
          updated: new Date(),
        }
        if (
          (next.total !== null || days.length === 0) &&
          next.logs.every((log) => log.hours !== null)
        ) {
          if (cache.current.size >= 12)
            cache.current.delete(cache.current.keys().next().value!)
          cache.current.set(key, next)
        }
        publish(next)
      })
      .catch(() => {
        publish({ ...current, status: 'error' })
      })
    return () => controller.abort()
  }, [key, login, month, today, request])

  // Never show another login or cycle's data while the effect switches requests.
  const visible =
    result.key === key
      ? result
      : { ...empty, status: login ? ('loading' as const) : ('idle' as const) }
  return {
    ...visible,
    reload: (mode: 'refresh' | 'retry' = 'refresh') =>
      setRequest((previous) => ({ id: previous.id + 1, mode })),
  }
}
