// Sized in rem so icons scale with the interface on large displays.
const remBox = (size: number) => ({
  width: `${size / 16}rem`,
  height: `${size / 16}rem`,
})

type IconName = 'sun' | 'moon' | 'previous' | 'next' | 'refresh'

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
    refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />,
  }
  return (
    <svg
      style={remBox(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
