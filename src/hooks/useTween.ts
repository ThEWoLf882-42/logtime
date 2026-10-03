import { useEffect, useRef, useState } from 'react'

/** Eases a displayed number toward `value`; jumps when motion is reduced. */
export function useTween(value: number, duration = 900) {
  const [display, setDisplay] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const from = current.current
    const reduced =
      typeof requestAnimationFrame !== 'function' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (from === value || reduced) {
      current.current = value
      setDisplay(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const next = from + (value - from) * (1 - (1 - progress) ** 3)
      current.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return display
}
