# Traffic simulator

`simulate-traffic.mjs` sends realistic parent sessions to PostHog so the
analytics are populated before real visitors arrive. Node 18+ (uses global
`fetch`); no dependencies.

```bash
node simulate-traffic.mjs --dry-run                       # print, don't send
POSTHOG_API_KEY=phc_xxx node simulate-traffic.mjs         # send 220 visitors / 14 days
POSTHOG_API_KEY=phc_xxx node simulate-traffic.mjs --visitors=400 --days=30
```

| Env / flag | Default | Meaning |
| ---------- | ------- | ------- |
| `POSTHOG_API_KEY` | — | PostHog **project** key (`phc_…`). Omit → dry run. |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | Use `https://eu.i.posthog.com` for EU. |
| `SITE_URL` | `https://upskilling-hai.github.io` | Used in `$current_url`. |
| `--visitors=N` | `220` | Number of sessions. |
| `--days=N` | `14` | Spread over the last N days. |

The simulated funnel: every visitor lands on Home; ~87% go to the tutor list;
~55% filter a subject; ~62% open a tutor; ~34% of those start a request; ~58% of
those send it. Channels are weighted toward `facebook-group` (~42%).

## Insights to build in PostHog

1. **Most-viewed tutors** — Trends → event `tutor_viewed`, count, breakdown by
   `tutor_name`.
2. **Most-looked-at subjects** — Trends → `tutor_viewed` + `subject_filtered`,
   breakdown by `subject`.
3. **Where visitors come from** — Trends → `$pageview`, unique users, breakdown
   by person property `first_touch_source` (or `utm_source`).
4. **Look-to-book** — Funnel → `$pageview` → `tutor_viewed` → `booking_started`
   → `booking_submitted`. Add a breakdown by `first_touch_source` to see which
   channel actually books.
5. **Requests over time** — Trends → `booking_submitted`, count per day.

Put 1–5 on one dashboard and share it with Dana.
