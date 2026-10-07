# Logtime

A simple website for 1337 MED students to check their monthly logged hours against the required hours. Each person enters their own campus login.

## Run

Use Node.js 22.13+ (22.x), or 24+.

```sh
npm ci
npm run dev
```

Enter your login, set your required hours (100 by default), and select **Check hours**. The page shows every day in the selected cycle, alongside logged hours, hours remaining, progress, daily average, best day, and hours needed per day. Use the arrows (or the ← and → keys, and T for today) to check another cycle. There is no header or collapsed breakdown; the daily grid is always visible.

The design is a quiet ledger: ink, paper, and hairline rules carry the interface, one typeface (Archivo, condensed for figures) sets everything, and color is reserved for data, with cobalt for logged hours and heat colors for overruns. The headline shows the cycle total against the required hours, which you can edit in place. Below it, a scale fills toward the goal and marks where an even pace would put you today; the caption states how far ahead or behind you are. Remaining, needed per day, daily average, and best day follow.

Daily hours form a column chart on one shared hour scale, with a dashed line at 12 hours. Future days (and today) show a dashed outline of the hours each remaining day needs. On narrow screens the chart becomes a ledger of rows in two or three columns. Days past 12 hours draw their extra hours in heat colors, from hot orange through red and crimson to violet at 18 hours or more (Overtime, Heavy overtime, Extreme overtime). Past the required hours, the goal scale extends and the overrun is drawn in the same heat colors, labeled Over goal, Well over goal, or Far over goal; the most extreme levels pulse.

To finish early, pick a day in the chart (or a row in the ledger): hovering or focusing a day previews how many hours each day would then need, and clicking it sets it as your finish date, shown as a removable chip in the headline. Needed per day, the even-pace mark, and the dashed outlines of needed hours all follow that date, and days after it are dimmed. With the keyboard, arrow keys move between days, Enter picks, and Escape clears. The date is remembered in this browser until it passes.

Plans are checked against physical time: campus is open around the clock, so a day holds at most 24 hours, and today only has what is left of it in campus time. A finish date that cannot fit the remaining hours is named as not possible, with one-click fixes for the earliest possible date (24 hours a day) and a realistic one (12 hours a day); plans needing more than 12 hours a day are flagged as overtime. A requirement larger than the cycle itself (24 hours times its days) is named under the goal. These checks apply to the plan, not to the hours the API reports.

Days fill in as their requests finish, and a thin line at the top of the page shows loading progress.

The dark theme is the default; your login, required hours, and theme are remembered in this browser. A saved login is only sent after you select **Check hours**. Hour records are kept in memory.

The layout fills the viewport and fits without scrolling at common desktop sizes and portrait phone sizes of at least 740px height. On screens larger than about 1680×945, such as Retina iMacs and 4K displays, the whole interface scales up evenly: sizes are in `rem`, and the root font size grows with the viewport. Shorter viewports and increased browser zoom can scroll so content stays accessible. Light and dark backgrounds cover the entire page.

## Checks

```sh
npm run build         # Type check and build dist/
npm test              # Calendar, API, and UI tests
npm run format:check
npx playwright install chromium
npm run test:e2e       # Desktop/mobile flows with mocked API responses
```

Browser tests start the development server if needed. Screenshots are saved in the ignored `test-results/` directory. Deploy `dist/` to a static host to share the website. Fonts are self-hosted from `@fontsource` packages, so no third-party stylesheet delays the first paint. `public/` provides `robots.txt` and `llms.txt`; configure the host to return 404 for missing files rather than rewriting every path to `index.html`, which crawlers and Lighthouse would misread.

## Cycle and data

Cycles run from the 28th through the following month's 27th, inclusive. Consecutive periods have no gaps or overlap; the current period switches on the 28th. Today follows the Casablanca calendar; browser time zones do not shift dates.

The default API is `https://logtime-med.1337.ma/api/get_log`. To use a compatible endpoint, set `VITE_LOGTIME_API_URL` in `.env` (see `.env.example`). The endpoint must allow browser CORS requests.

Each started day is requested by POST with `login`, `startDate`, and `endDate`. The date selectors preserve the original integration: both use the previous day at 23:00 UTC. For example, September 9 uses `2026-09-08T23:00:00.000Z`. This convention still needs verification against the service's specification, particularly during Ramadan; live account totals have not been independently verified.

The cycle total is requested separately using the cycle's 28th as `startDate` and the following month's 27th as `endDate`, with the same date-selector convention. Progress, remaining hours, daily average, and needed hours use this API total; the browser never sums daily cards to calculate or replace it. Failed daily requests do not affect the total. If the total request fails, daily cards remain available and progress shows unavailable until retry succeeds.

Responses may contain arrays or `data`, `logs`, or `hydra:member` wrappers. Hour fields include `hours`, `hour`, `duration`, `logtime`, `time`, and `totalHours`. Numeric values are interpreted as hours; decimal strings and `HH:MM[:SS]` durations are also supported. Empty arrays are zero hours. The cycle response must supply one aggregate value or record, with `totalHours` taking priority; multiple records without an aggregate are rejected instead of summed. Invalid responses and failed requests are marked unavailable.

Daily requests run four at a time alongside one cycle-total request. Each request times out after 15 seconds and cancels when the login or cycle changes. Complete results are cached in memory for one minute (up to 12 entries). **Refresh** bypasses the cache; **Retry** reloads the cycle. Future days are not requested individually, and upcoming cycles make no requests.

Finish-date math is in `src/lib/plan.ts`. The UI is in `src/App.tsx`, with the goal scale in `src/components/Ruler.tsx` and the daily chart in `src/components/DailyGrid.tsx`; day states come from `src/lib/days.ts` and overrun colors from `src/lib/heat.ts`. Request handling is in `src/hooks/useLogs.ts`, and API/calendar helpers are in `src/lib/`.
