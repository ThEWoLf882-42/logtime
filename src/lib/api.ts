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
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal.addEventListener('abort', abort, { once: true })
      const timeout = window.setTimeout(abort, 15000)
      try {
        const apiDate = formatApiDate(date)
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ login, startDate: apiDate, endDate: apiDate }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        results[index] = {
          date: dateKey(date),
          hours: extractHours(await response.json()),
        }
      } catch {
        signal.throwIfAborted()
        results[index] = { date: dateKey(date), hours: null }
      } finally {
        window.clearTimeout(timeout)
        signal.removeEventListener('abort', abort)
      }
      onProgress(++completed)
    }
  }
  // Avoid issuing a whole month's requests simultaneously.
  await Promise.all(Array.from({ length: Math.min(4, days.length) }, worker))
  return results
}
