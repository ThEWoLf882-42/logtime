# Logtime

A simple website for 1337 MED students to check their monthly logged hours against the required hours. Each person enters their own campus login.

## Run

Use Node.js 22.13+ (22.x), or 24+.

```sh
npm ci
npm run dev
```

Enter your login, set your required hours (100 by default), and select **Check hours**. The page shows every day in the selected cycle, alongside logged hours, hours remaining, progress, daily average, best day, and hours needed per day. Use the arrows to check another cycle. There is no header or collapsed breakdown; the daily grid is always visible.

Your login, required hours, and theme are remembered in this browser. A saved login is only sent after you select **Check hours**. Hour records are kept in memory.

The layout fills the viewport and fits without scrolling at common desktop sizes and portrait phone sizes of at least 740px height. Shorter viewports and increased browser zoom can scroll so content stays accessible. Light and dark backgrounds cover the entire page.

## Checks

```sh
npm run build         # Type check and build dist/
npm test              # Calendar, API, and UI tests
npm run format:check
npx playwright install chromium
npm run test:e2e       # Desktop/mobile flows with mocked API responses
```

Browser tests start the development server if needed. Screenshots are saved in the ignored `test-results/` directory. Deploy `dist/` to a static host to share the website.

## Cycle and data

Cycles run from the 28th through the following month's 27th, inclusive. Consecutive periods have no gaps or overlap; the current period switches on the 28th. Today follows the Casablanca calendar; browser time zones do not shift dates.

The default API is `https://logtime-med.1337.ma/api/get_log`. To use a compatible endpoint, set `VITE_LOGTIME_API_URL` in `.env` (see `.env.example`). The endpoint must allow browser CORS requests.

Each started day is requested by POST with `login`, `startDate`, and `endDate`. The date selectors preserve the original integration: both use the previous day at 23:00 UTC. For example, September 9 uses `2026-09-08T23:00:00.000Z`. This convention still needs verification against the service's specification, particularly during Ramadan; live account totals have not been independently verified.

The cycle total is requested separately using the cycle's 28th as `startDate` and the following month's 27th as `endDate`, with the same date-selector convention. Progress, remaining hours, daily average, and needed hours use this API total; the browser never sums daily cards to calculate or replace it. Failed daily requests do not affect the total. If the total request fails, daily cards remain available and progress shows unavailable until retry succeeds.

Responses may contain arrays or `data`, `logs`, or `hydra:member` wrappers. Hour fields include `hours`, `hour`, `duration`, `logtime`, `time`, and `totalHours`. Numeric values are interpreted as hours; decimal strings and `HH:MM[:SS]` durations are also supported. Empty arrays are zero hours. The cycle response must supply one aggregate value or record, with `totalHours` taking priority; multiple records without an aggregate are rejected instead of summed. Invalid responses and failed requests are marked unavailable.

Daily requests run four at a time alongside one cycle-total request. Each request times out after 15 seconds and cancels when the login or cycle changes. Complete results are cached in memory for one minute (up to 12 entries). **Refresh** bypasses the cache; **Retry** reloads the cycle. Future days are not requested individually, and upcoming cycles make no requests.

The UI is in `src/App.tsx`, request handling in `src/hooks/useLogs.ts`, and API/calendar helpers in `src/lib/`.
