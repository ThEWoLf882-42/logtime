# Logtime

A responsive React dashboard for the 1337 MED logtime cycle. Track daily hours, cumulative progress, target pace, and past cycles in light or dark mode.

## Development

Use Node.js 22.13+ (22.x), or 24+. Install the locked dependencies and start Vite:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Enter a campus login and select **Load hours**, or choose **Explore a demo** to view clearly labeled sample data without API requests. A saved login is prefilled; it is only sent after submission.

```sh
npm run build          # TypeScript check and production build in dist/
npm run preview        # Serve the production build locally
npm test               # Calendar, API, cancellation, and UI regression tests
npm run test:watch     # Watch unit and integration tests
npm run typecheck      # TypeScript validation
npm run format:check   # Check formatting
npm run format         # Apply formatting
npx playwright install chromium
npm run test:e2e       # Desktop/mobile browser flows, CSV, and mocked API recovery
```

Browser tests start a local development server automatically. They use controlled API responses and never submit a real campus login. Screenshots and failure traces are written to the ignored `test-results/` directory.

## Features

- Navigate cycles and return to the current cycle with **Today**.
- Save a target between 1 and 999 hours and a light/dark preference locally.
- See logged hours, daily average, projected total (or the final result for past cycles), best day, and the daily hours needed to reach the target.
- Follow a cumulative chart and filter daily activity by logged days or confirmed days with no hours.
- Export the selected cycle to CSV. Unknown and upcoming hours remain blank; demo filenames are explicitly marked.
- Recover from partial failures without discarding successful days. Failed days remain **Unavailable**, and projections wait for complete data.

## Calendar and calculations

The normal cycle is the 29th through the following month's 28th, inclusive. In a non-leap year, the cycle after January 29–February 28 is March 1–March 28. In a leap year, it begins February 29. A separate month anchor makes these cycles contiguous and keeps navigation reversible.

“Today” follows `Africa/Casablanca`, including seasonal clock changes. Internal dates are UTC calendar dates, so browser time zones do not shift records or day counts. The date is checked every minute while the page is open.

The daily average includes every started day, including today. Projection multiplies that average by the cycle length; it is an estimate and may be lower early in the day. Required daily hours divide the remaining target by available days **including today**. The chart's target line assumes evenly distributed daily hours. Incomplete API results show a partial total and suppress averages, projections, and the trend line.

## API integration

The default service is `https://logtime-med.1337.ma/api/get_log`. Set `VITE_LOGTIME_API_URL` in a local `.env` file to use a compatible endpoint (see `.env.example`). Vite exposes this URL in the browser bundle; do not put secrets in it.

Each started day is requested using POST with JSON:

```json
{
  "login": "your-login",
  "startDate": "2026-09-08T23:00:00.000Z",
  "endDate": "2026-09-08T23:00:00.000Z"
}
```

This example selects September 9. The **previous day at 23:00 UTC** and identical start/end selectors preserve the original project's API convention. That convention is separate from the Casablanca calendar and still needs confirmation against an authoritative endpoint specification, particularly during Ramadan. This repository has no backend contract or authenticated fixture for verifying live account totals.

Supported responses include arrays, wrappers named `data`, `logs`, or `hydra:member`, and hour fields `hours`, `hour`, `duration`, `logtime`, `time`, or `totalHours`. Values may be nonnegative finite numbers, decimal strings (dot or comma), or `HH:MM[:SS]` durations. Numeric durations are treated as hours, as in the original integration; seconds or milliseconds require an explicit adapter. Empty arrays mean confirmed zero hours. Unknown shapes, malformed values, and request failures are unavailable data, never invented zeroes.

Requests are limited to four concurrently, time out after 15 seconds each, and are cancelled when the login or cycle changes. Successful complete responses are cached in memory for up to one minute, with at most 12 entries. **Refresh** bypasses the cache. A failed day can be retried by refreshing the cycle. Future days are never requested. The service must allow browser CORS requests from the dashboard origin; no proxy or credentials are bundled.

Only the last submitted login, target, and theme are stored in browser local storage. Hour records remain in memory. If storage is disabled, the dashboard still works without saved preferences. Fonts use Google Fonts with local/system fallbacks.

## Project structure

```text
src/App.tsx            Dashboard state and presentation
src/components/       Daily activity, cumulative chart, and icons
src/hooks/useLogs.ts   Request lifecycle and bounded cache
src/lib/api.ts         Request pool and response validation
src/lib/calendar.ts    Cycle arithmetic and campus calendar
src/lib/storage.ts     Safe preference persistence
src/index.css         Responsive layout and theme tokens
src/**/*.test.*        Unit and integration tests
e2e/                  Browser regression tests
```

Deploy the generated `dist/` directory to a static host. Set the API URL before building if required. Hosting infrastructure and the external API are not included in this repository.
