import { describe, expect, it, vi } from 'vitest'
import { extractHours, loadCycle } from './api'

describe('API normalization', () => {
  it.each([
    [{ 'hydra:member': [{ totalHours: '2.5' }, { totalHours: 3 }] }, 5.5],
    [{ data: [{ hours: 0, duration: 10 }, { hours: '1,5' }] }, 1.5],
    [{ logs: [{ duration: '02:30:00' }] }, 2.5],
    [{ hours: '00:00:30' }, 1 / 120],
    [[], 0],
    [{ 'hydra:member': [] }, 0],
  ])(
    'reads supported responses without losing zero values',
    (payload, expected) => {
      expect(extractHours(payload)).toBeCloseTo(expected)
    },
  )
  it.each([
    null,
    {},
    { error: 'not found' },
    { hours: -1 },
    { hours: Infinity },
    { hours: '2 hours' },
    { hours: '01:90' },
    { hours: '' },
    [null],
  ])('rejects unknown or corrupt data instead of reporting zero', (payload) => {
    expect(() => extractHours(payload)).toThrow()
  })
})

describe('daily requests', () => {
  it('retains successful days and marks failed ones unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hours: 3 }) })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    const progress = vi.fn()
    const result = await loadCycle(
      'student',
      [new Date('2026-09-01'), new Date('2026-09-02'), new Date('2026-09-03')],
      new AbortController().signal,
      progress,
    )
    expect(result.map((row) => row.hours)).toEqual([3, null, 0])
    expect(progress).toHaveBeenLastCalledWith(3)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      login: 'student',
      startDate: '2026-08-31T23:00:00.000Z',
      endDate: '2026-08-31T23:00:00.000Z',
    })
  })
  it('limits concurrency to four and stops scheduling after cancellation', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const request = loadCycle(
      'student',
      Array.from({ length: 12 }, () => new Date('2026-09-01')),
      controller.signal,
      vi.fn(),
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
    controller.abort()
    await expect(request).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
  it('times out hanging requests', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () =>
              reject(new Error('timeout')),
            ),
          ),
      ),
    )
    const request = loadCycle(
      'student',
      [new Date('2026-09-01')],
      new AbortController().signal,
      vi.fn(),
    )
    await vi.advanceTimersByTimeAsync(15000)
    expect(await request).toEqual([{ date: '2026-09-01', hours: null }])
  })
})
