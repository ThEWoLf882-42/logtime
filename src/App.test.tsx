import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      '42.0 of 100 hours',
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
      '42.0 of 100 hours',
    )
    expect(document.querySelector('.remaining')).toHaveTextContent('58.0')
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
        '42.0 of 100 hours',
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
      '42.0 of 100 hours',
    )
    expect(document.querySelector('.remaining')).toHaveTextContent('58.0')
    expect(document.querySelectorAll('.day-card.is-unknown')).toHaveLength(13)
  })
})
