import { dateKey, formatApiDate } from './calendar'

export type DayLog = { date: string; hours: number | null }
export const API_URL =
  import.meta.env.VITE_LOGTIME_API_URL ||
  'https://logtime-med.1337.ma/api/get_log'

function parseHours(value: unknown): number {
  let hours: number
  if (typeof value === 'number') hours = value
  else if (typeof value === 'string' && /^\d+(?:[.,]\d+)?$/.test(value.trim()))
    hours = Number(value.trim().replace(',', '.'))
  else if (
    typeof value === 'string' &&
    /^\d+:\d{2}(?::\d{2})?$/.test(value.trim())
  ) {
    const [h, m, s = 0] = value.trim().split(':').map(Number)
    if (m >= 60 || s >= 60) throw new Error('Invalid duration')
    hours = h + m / 60 + s / 3600
  } else throw new Error('Unsupported hours value')
  if (!Number.isFinite(hours) || hours < 0)
    throw new Error('Invalid hours value')
  return hours
}

export function extractHours(payload: unknown): number {
  if (typeof payload === 'number' || typeof payload === 'string')
    return parseHours(payload)
  if (Array.isArray(payload))
    return payload.reduce<number>((sum, row) => sum + extractHours(row), 0)
  if (!payload || typeof payload !== 'object')
    throw new Error('Unsupported API response')
  const row = payload as Record<string, unknown>
  for (const key of ['data', 'logs', 'hydra:member']) {
    if (row[key] !== undefined) return extractHours(row[key])
  }
  for (const key of [
    'hours',
    'hour',
    'duration',
    'logtime',
    'time',
    'totalHours',
  ]) {
    if (row[key] !== undefined) return parseHours(row[key])
  }
  throw new Error('Unsupported API response')
}

// A range response must contain an aggregate, never a list we sum locally.
export function extractTotalHours(payload: unknown): number {
  if (typeof payload === 'number' || typeof payload === 'string')
    return parseHours(payload)
  if (Array.isArray(payload)) {
    if (payload.length === 0) return 0
    if (payload.length === 1) return extractTotalHours(payload[0])
    throw new Error('Expected a single cycle total')
  }
  if (!payload || typeof payload !== 'object')
    throw new Error('Unsupported API response')
  const row = payload as Record<string, unknown>
  for (const key of [
    'totalHours',
    'hours',
    'hour',
    'duration',
    'logtime',
    'time',
  ]) {
    if (row[key] !== undefined) return parseHours(row[key])
  }
  for (const key of ['data', 'logs', 'hydra:member']) {
    if (row[key] !== undefined) return extractTotalHours(row[key])
  }
  throw new Error('Unsupported API response')
}

async function requestHours(
  login: string,
  start: Date,
  end: Date,
  signal: AbortSignal,
  extract: (payload: unknown) => number,
): Promise<number | null> {
  signal.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(abort, 15000)
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        login,
        startDate: formatApiDate(start),
        endDate: formatApiDate(end),
      }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return extract(await response.json())
  } catch {
    signal.throwIfAborted()
    return null
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

export function loadCycleTotal(
  login: string,
  start: Date,
  end: Date,
  signal: AbortSignal,
) {
  return requestHours(login, start, end, signal, extractTotalHours)
}

export async function loadCycle(
  login: string,
  days: Date[],
  signal: AbortSignal,
  onProgress: (count: number) => void,
): Promise<DayLog[]> {
  const results: DayLog[] = new Array(days.length)
  let cursor = 0
  let completed = 0
  async function worker() {
    while (cursor < days.length) {
      signal.throwIfAborted()
      const index = cursor++
      const date = days[index]
      results[index] = {
        date: dateKey(date),
        hours: await requestHours(login, date, date, signal, extractHours),
      }
      onProgress(++completed)
    }
  }
  // Avoid issuing a whole month's requests simultaneously.
  await Promise.all(Array.from({ length: Math.min(4, days.length) }, worker))
  return results
}
