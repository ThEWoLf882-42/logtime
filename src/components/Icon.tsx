type IconName = 'sun' | 'moon' | 'previous' | 'next' | 'enter' | 'refresh'

export default function Icon({
  name,
  size = 20,
}: {
  name: IconName
  size?: number
}) {
  const paths = {
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
      </>
    ),
    moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />,
    previous: <path d="m14.5 6-6 6 6 6" />,
    next: <path d="m9.5 6 6 6-6 6" />,
    enter: <path d="M5 12h13m-5-5 5 5-5 5" />,
    refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/** The sundial mark: a ring of rays around a lit core. */
export function Mark({ size = 26 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, index) => index * 30)
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="5" className="mark-core" />
      {rays.map((angle, index) => (
        <line
          key={angle}
          x1="16"
          y1={index % 3 === 0 ? 2.5 : 5}
          x2="16"
          y2="9"
          transform={`rotate(${angle} 16 16)`}
          className="mark-ray"
        />
      ))}
    </svg>
  )
}
