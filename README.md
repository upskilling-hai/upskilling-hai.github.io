# Bright Paths Tutoring — prototype

A clean, friendly site where parents browse tutors, see price and availability,
and request a session without texting back and forth — plus an owner dashboard
and **PostHog** product analytics.

Built to the requirements in [`PLAN.md`](PLAN.md). Plain HTML/CSS/JS, no build
step, deploys as-is to GitHub Pages.

## Pages

| Page | File | What it does |
| ---- | ---- | ------------ |
| Home | `index.html` | Pitch + "how it works" |
| Our tutors | `tutors.html` | Tutor cards, filter by subject |
| Tutor detail | `tutor.html?id=…` | Rate, real availability, booking form |
| Request received | `confirmation.html?booking=…` | Confirmation + summary |
| Owner dashboard | `dashboard.html` | Views, sources, look-to-book, request queue |

## Run it locally

```bash
cd upskilling-hai.github.io
python3 -m http.server 8000
# open http://localhost:8000
```

Book a session from a tutor page, then open `dashboard.html`. Use **Load demo
data** on the dashboard to populate two weeks of realistic activity.

> Data (bookings, availability, analytics) lives in `localStorage` — it's per
> browser and resets with **Reset all data** on the dashboard.

## Turn on PostHog telemetry

The PostHog **Project API key** (`phc_…`) is safe to expose in the browser, but
it is **not** committed to this repo. Create a free project at
[posthog.com](https://posthog.com), then give the site the key one of these ways:

| Method | Use it for | Where the key lives |
| ------ | ---------- | ------------------- |
| **"Connect PostHog" box** on `dashboard.html` | quick local testing | your browser's `localStorage` only |
| **`?ph_key=phc_xxx`** in the URL, once | testing / sharing a preview link | your browser's `localStorage` only (`?ph_key=off` clears it) |
| **`js/config.local.js`** (git-ignored) — `window.CONFIG_LOCAL = { POSTHOG_KEY: 'phc_…' }` and add `<script src="js/config.local.js"></script>` before `config.js` | a local file you never commit | the file, ignored by git |
| **Deploy-time injection** (GitHub Actions) | production | a repo **secret**, written into `config.local.js` during the Pages build |

EU project? Add `POSTHOG_HOST: 'https://eu.i.posthog.com'` the same way, or
`?ph_host=…`.

Without a key the site works normally and the built-in dashboard still records
everything locally — it just doesn't forward to PostHog.

### Deploy-time injection (production)

Set Pages source to "GitHub Actions" and add a step before upload:

```yaml
- run: echo "window.CONFIG_LOCAL={POSTHOG_KEY:'${{ secrets.POSTHOG_KEY }}'};" > js/config.local.js
```

and add `<script src="js/config.local.js"></script>` just before
`<script src="js/config.js"></script>` in each HTML `<head>`.

### Events sent

| Event | When | Answers |
| ----- | ---- | ------- |
| `$pageview` (+ mirrored `page_view`) | every page load | traffic, funnel top |
| `subject_filtered` | subject filter clicked | which subjects draw interest |
| `tutor_viewed` | tutor detail opened | most-viewed tutors / subjects |
| `booking_started` | a time slot is selected | funnel middle |
| `booking_submitted` | request sent | **look-to-book conversion** |
| `booking_validation_failed` | form errors on submit | form friction |
| `cta_clicked`, `tutor_card_clicked`, `confirmation_viewed` | navigation | supporting |

First-touch attribution (`utm_source` / referrer) is captured once per browser
and attached to every event as `first_touch_source`, plus set as a PostHog
person property — so "is the Facebook group working?" is one breakdown.

## Simulate traffic (show the customer it works)

[`scripts/simulate-traffic.mjs`](scripts/simulate-traffic.mjs) generates a couple
of weeks of realistic parent sessions and sends them to PostHog.

```bash
# dry run — no account needed, prints the funnel it would send
node scripts/simulate-traffic.mjs --dry-run

# send to PostHog
POSTHOG_API_KEY=phc_xxx node scripts/simulate-traffic.mjs --visitors=250 --days=21
```

See [`scripts/README.md`](scripts/README.md) for the PostHog insights to build
from this data.

## Deploy

This repo is `upskilling-hai.github.io`, so GitHub Pages serves `main` at the
root automatically — push and it's live. `.nojekyll` keeps Pages from touching
the files.

## What's mocked (and how to make it real)

Everything data-related is behind one module, [`js/store.js`](js/store.js).
Replace it — keeping the method names — to go live:

- **Bookings + availability** → a database, a serverless function, or Dana's
  Google Sheet via Apps Script (bookings append as rows; the Sheet drives
  availability).
- **Owner notification** (`notifyOwner` in `store.js`) → send Dana an email or
  text.
- **Analytics** → already real once the PostHog key is set; the built-in
  dashboard becomes a convenience view.

Out of scope by request: online payment. Also not built: accounts,
reschedule/cancel, multi-device shared data. See `PLAN.md` §6–7.
