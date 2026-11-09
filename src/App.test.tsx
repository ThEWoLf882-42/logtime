import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('dashboard', () => {
  it('starts without assumed hours and saves the requirement', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Enter your campus login',
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'No data loaded',
    )
    expect(fetchMock).not.toHaveBeenCalled()
    // 120 h by default, and nothing is saved until the goal is edited.
    expect(screen.getByLabelText('Required hours')).toHaveValue(120)
    expect(localStorage.getItem('logtime.target')).toBeNull()
    fireEvent.change(screen.getByLabelText('Required hours'), {
      target: { value: '150' },
    })
    expect(localStorage.getItem('logtime.target')).toBe('150')
    fireEvent.change(screen.getByLabelText('Required hours'), {
      target: { value: '' },
    })
    fireEvent.blur(screen.getByLabelText('Required hours'))
    expect(screen.getByLabelText('Required hours')).toHaveValue(150)
  })
  it('defaults to the dark theme and remembers a light choice', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { unmount } = render(<App />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('logtime.theme')).toBe('light')
    unmount()
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  it('links the signature to the author’s intra profile in a new tab', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<App />)
    const link = screen.getByRole('link', { name: /Aymane Gimi/ })
    expect(link).toHaveAttribute(
      'href',
      'https://profile-v3.intra.42.fr/users/agimi',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('shows failure without invented zero totals and supports retry', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Couldn’t load'),
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'No data loaded',
    )
    fetchMock.mockImplementation(async (_url, options) => ({
      ok: true,
      json: async () => ({
        totalHours:
          JSON.parse(options.body).startDate ===
          JSON.parse(options.body).endDate
            ? 2
            : 42,
      }),
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Loaded for student',
      ),
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '42.0 of 120 hours',
    )
  })
  it('prevents an old login response from overwriting a newer one', async () => {
    const delayed: Array<(value: unknown) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options) =>
        JSON.parse(options.body).login === 'first'
          ? new Promise((resolve) => delayed.push(resolve))
          : Promise.resolve({ ok: true, json: async () => ({ hours: 2 }) }),
      ),
    )
    render(<App />)
    const input = screen.getByLabelText('Your campus login')
    fireEvent.change(input, { target: { value: 'first' } })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    fireEvent.change(input, { target: { value: 'second' } })
    fireEvent.click(screen.getByRole('button', { name: /Load again/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Loaded for second'),
    )
    const before = screen
      .getByRole('progressbar')
      .getAttribute('aria-valuetext')
    for (const resolve of delayed)
      resolve({ ok: true, json: async () => ({ hours: 99 }) })
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuetext',
        before!,
      ),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loaded for second')
  })
  it('does not count unknown days as days with no hours', async () => {
    let count = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) =>
        JSON.parse(options.body).startDate !== JSON.parse(options.body).endDate
          ? { ok: true, json: async () => ({ totalHours: 42 }) }
          : ++count === 1
            ? { ok: false }
            : { ok: true, json: async () => ({ hours: 0 }) },
      ),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('1 day unavailable'),
    )
    expect(document.querySelectorAll('.day-card.is-unknown')).toHaveLength(1)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '42.0 of 120 hours',
    )
    expect(document.querySelector('.remaining')).toHaveTextContent('78.0')
    expect(document.querySelectorAll('.day-card.is-zero')).toHaveLength(
      count - 1,
    )
  })
  it('keeps daily hours when the total fails and never falls back to their sum', async () => {
    let failTotal = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        if (startDate !== endDate && failTotal) return { ok: false }
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 2 : 42 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cycle total unavailable',
      ),
    )
    expect(document.querySelectorAll('.day-card.is-logged')).toHaveLength(13)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'No data loaded',
    )
    expect(document.querySelector('.remaining')).toHaveTextContent('—')
    failTotal = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuetext',
        '42.0 of 120 hours',
      ),
    )
  })
  it('heats up days and the goal by how far they run over', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 17 : 180 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Loaded for student',
      ),
    )
    expect(screen.getByText('Requirement met', { exact: true })).toBeVisible()
    expect(document.querySelector('.overshoot')).toHaveTextContent(
      'Well over goal · +60.0 h',
    )
    expect(document.querySelectorAll('.day-card.is-over.heat-3')).toHaveLength(
      13,
    )
    expect(document.querySelector('.day-over')).toHaveTextContent('+5.0h')
  })
  it('plans a finish date picked from the chart and offers fixes when impossible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 2 : 42 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Loaded for student',
      ),
    )
    expect(screen.getByText('Pick a day below to finish early')).toBeVisible()
    // 13:00 on campus: 11 h are left today, so 78 h cannot fit by tomorrow.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Finish by Thursday, Sep 10: not possible',
      }),
    )
    expect(document.querySelector('.plan-alert')).toHaveTextContent(
      '💀 You’d need 67-hour days. RIP.',
    )
    expect(
      screen.getByRole('button', { name: 'No sleep: Sat, Sep 12' }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Survivable: Tue, Sep 15',
      }),
    )
    expect(screen.getByRole('button', { name: /by Tue, Sep 15/ })).toBeVisible()
    expect(document.querySelector('.plan-alert')).toBeNull()
    expect(localStorage.getItem('logtime.finishBy')).toBe('2026-09-15')
    expect(document.querySelector('.day-card.is-finish time')).toHaveAttribute(
      'datetime',
      '2026-09-15',
    )
    fireEvent.click(screen.getByRole('button', { name: /clear finish date/ }))
    expect(screen.getByText('Pick a day below to finish early')).toBeVisible()
    expect(localStorage.getItem('logtime.finishBy')).toBe('')
  })
  it('shows the actual workload for 24 h remaining, 9 h logged, finishing tomorrow at night', async () => {
    vi.setSystemTime(new Date('2026-11-09T23:04:00Z'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 9 : 96 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    const tomorrow = await screen.findByRole('button', {
      name: 'Finish by Tuesday, Nov 10: 23.1 hours a day, 0.9 more today',
    })
    fireEvent.click(tomorrow)
    const needed = screen
      .getByRole('heading', { name: 'Needed per day' })
      .closest('article')!
    expect(needed.querySelector('p')).toHaveTextContent('23.1')
    expect(needed).toHaveTextContent('+0.9 h today')
    expect(document.querySelector('.remaining')).toHaveTextContent('24.0')
    const todayCard = document.querySelector<HTMLElement>('.day-card.is-today')!
    const tomorrowCard = document.querySelector<HTMLElement>(
      '.day-card.is-finish',
    )!
    // The outline includes today's logged 9 h, rather than another 23.1 h today.
    expect(Number(todayCard.style.getPropertyValue('--need'))).toBeCloseTo(
      (9 + 56 / 60) / 24,
    )
    expect(Number(tomorrowCard.style.getPropertyValue('--need'))).toBeCloseTo(
      (24 - 56 / 60) / 24,
    )
    expect(document.querySelector('.plan-alert')).toHaveTextContent(
      'Pick a coffin.',
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Finish by Monday, Nov 9: not possible',
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Needed today' }).closest('article'),
    ).toHaveTextContent('24.0')
    expect(document.querySelector('.plan-alert')).toHaveTextContent(
      'You’d need 33-hour days',
    )
  })
  it('does not treat unavailable hours today as zero for planning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        if (startDate === endDate && startDate === '2026-09-08T23:00:00.000Z')
          return { ok: false }
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 2 : 96 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('1 day unavailable'),
    )
    const needed = screen
      .getByRole('heading', { name: 'Needed per day' })
      .closest('article')!
    expect(needed.querySelector('p')).toHaveTextContent('—')
    expect(needed).toHaveTextContent('Today’s hours unavailable')
    expect(screen.queryByRole('button', { name: /Finish by/ })).toBeNull()
    expect(document.querySelector('.remaining')).toHaveTextContent('24.0')
  })
  it('updates expected hours as campus time advances', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-09-09T00:00:00Z'))
    render(<App />)
    const expectedMark = () =>
      parseFloat(document.querySelector<HTMLElement>('.ruler-pace')!.style.left)
    const before = expectedMark()
    act(() => vi.advanceTimersByTime(6 * 3600000))
    expect(expectedMark() - before).toBeCloseTo((100 * 0.25) / 31)
  })
  it('keeps November 9 at 23:00 and rolls over only at campus midnight', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-09T22:59:30Z'))
    render(<App />)
    const todayDate = () =>
      document
        .querySelector('.day-card.is-today time')!
        .getAttribute('datetime')
    expect(todayDate()).toBe('2026-11-09')
    act(() => vi.advanceTimersByTime(60000))
    expect(todayDate()).toBe('2026-11-09')
    act(() => vi.advanceTimersByTime(60 * 60000))
    expect(todayDate()).toBe('2026-11-10')
  })
  it('clears needed hours and planning when the goal is reached', async () => {
    localStorage.setItem('logtime.finishBy', '2026-09-10')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 9 : 120 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await screen.findByText('Goal reached')
    const needed = screen
      .getByRole('heading', { name: 'Needed per day' })
      .closest('article')!
    expect(needed.querySelector('p')).toHaveTextContent('0.0')
    expect(screen.queryByRole('button', { name: /Finish by/ })).toBeNull()
    expect(document.querySelector('.plan-alert')).toBeNull()
  })
  it('names goals that cannot fit in the cycle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({ totalHours: startDate === endDate ? 2 : 42 }),
        }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Required hours'), {
      target: { value: '999' },
    })
    expect(document.querySelector('.goal-note')).toHaveTextContent(
      /999\s?h\? Afterlife hours don’t count\./,
    )
    fireEvent.change(screen.getByLabelText('Required hours'), {
      target: { value: '500' },
    })
    expect(document.querySelector('.goal-note')).toBeNull()
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(document.querySelector('.plan-alert')).toHaveTextContent(
        '💀 500 h? Not in this life.',
      ),
    )
  })
  it('shows the API total even when all daily requests fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const { startDate, endDate } = JSON.parse(options.body)
        return startDate === endDate
          ? { ok: false }
          : { ok: true, json: async () => ({ totalHours: 42 }) }
      }),
    )
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your campus login'), {
      target: { value: 'student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Check hours/ }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '13 days unavailable. Cycle total loaded.',
      ),
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '42.0 of 120 hours',
    )
    expect(document.querySelector('.remaining')).toHaveTextContent('78.0')
    expect(document.querySelectorAll('.day-card.is-unknown')).toHaveLength(13)
  })
})
