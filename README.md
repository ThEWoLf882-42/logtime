# Logtime dashboard

A small React dashboard for visualizing a logtime cycle that runs from the 29th through the 28th.

## Run

```bash
npm install
npm run dev
```

The dashboard requests `https://logtime-med.1337.ma/api/get_log`. If the endpoint is unavailable or returns an unsupported shape, it stays usable with preview data and clearly labels that state. Supported record fields include date/day/created_at and hours/hour/duration/logtime/time.
