# Tutoring Site Prototype — Implementation Plan

Prototype for Dana's tutoring service: a clean, friendly site where parents browse
tutors, see price and availability, and request a session without texting back and
forth — plus an analytics dashboard for Dana.

**Prototype scope (agreed):** plain HTML/CSS/JS, no build step, deployed to GitHub
Pages. All persistence is **client-side mock** (`localStorage`); notifications and
confirmation emails are simulated. The data layer is isolated behind one module so
it can be swapped for a real backend later without touching the UI.

---

## 1. Requirements traceability

Every requirement below comes from the conversation with Dana. The build is
organized so each maps to something concrete.

| #   | Requirement | Source (Dana's words) | Where it's built |
| --- | ----------- | --------------------- | ---------------- |
| R1  | Parents can browse tutors | "parents can look at our tutors" | Tutors page |
| R2  | See price and availability per tutor | "see the price and availability" | Tutor detail page |
| R3  | Request a time without back-and-forth | "request a time without texting back and forth" | Booking form |
| R4  | Dana is notified of a new request | "I'd get an email or text" | Simulated toast + Dashboard "Requests" list |
| R5  | Booked slot stops showing as available | "that time should no longer show as available" | `store.createBooking()` marks the slot |
| R6  | Parent receives a confirmation | "receive confirmation" | Confirmation page |
| R7  | Clean, friendly, light design | "clean and friendly, not dark or corporate" | Design system / `style.css` |
| R8  | Small site, 3–4 pages | "a home page, a page showing the tutors, and a straightforward booking path" | Home, Tutors, Tutor detail, Confirmation |
| R9  | Booking form fields | "parent's name and email, plus the student's first name, grade, and requested subject" | Booking form |
| R10 | No online payment | "I don't need online payment" | Out of scope (explicit) |
| R11 | Which tutors + subjects are viewed most | "which tutors and subjects people look at most" | Dashboard |
| R12 | Which channel brings people in | "whether the Facebook group is bringing people in" | Dashboard (UTM / referrer capture) |
| R13 | Do people book or just look around | "whether people actually book or just look" | Dashboard funnel / conversion |
| R14 | Storage left to us; Sheet is today's tool | "I keep my schedule in a Google Sheet now" | `store.js` seam; Sheets noted as phase-2 option |

---

## 2. Architecture

Static site. Every page is a plain `.html` file that pulls in shared CSS and a
few small JS modules.

```
/
  index.html            # Home (R8)
  tutors.html           # Tutor listings + subject filter (R1, R11)
  tutor.html            # ?id=…  Tutor detail: price, availability, booking form (R2, R3, R9)
  confirmation.html     # Booking summary shown to the parent (R6)
  dashboard.html        # Dana-facing analytics — not linked in the main nav (R4, R11–R13)
  css/
    style.css           # design tokens + components (R7)
  js/
    store.js            # THE SEAM: all data + event access over localStorage
    seed.js             # first-run: load data/tutors.json into localStorage
    analytics.js        # logEvent(), first-touch UTM/referrer capture (R12)
    page-home.js
    page-tutors.js
    page-tutor.js       # slot picker + booking submit (R3, R5)
    page-dashboard.js   # charts + requests list
  data/
    tutors.json         # seed tutors: name, subjects, bio, photo, hourly price, slots
  assets/               # placeholder avatar SVGs, favicon
  README.md             # how to run, how to make it real
```

### Data model (localStorage)

- `tutors` — array: `{ id, name, subjects[], bio, photoUrl, hourlyPrice }`
- `slots` — array: `{ id, tutorId, startsAt (ISO), status: 'available' | 'requested' }`
- `bookings` — array: `{ id, slotId, tutorId, createdAt, parentName, parentEmail,
  studentFirstName, studentGrade, subject }`
- `events` — array: `{ id, type, at, props{} }` (analytics)
- `firstTouch` — `{ source, medium, referrer, at }` set once on the first visit

### `store.js` — the one module that changes when the backend becomes real

```
getTutors()                 getTutor(id)
getAvailableSlots(tutorId)  // status === 'available', sorted by time
createBooking(payload)      // 1. write booking  2. slot.status = 'requested' (R5)
                            // 3. logEvent('booking_created', …) (R13)
                            // 4. notifyOwner(booking)  → simulated (R4)
getBookings()               // dashboard "Requests" list
logEvent(type, props)       getEvents()
```

`notifyOwner()` in the prototype: `console.info` + an on-screen toast
("Dana has been notified at dana@…") + the record shows up in the dashboard's
Requests list. In phase 2 this becomes an email/SMS call.

### Booking flow

1. Parent lands (optionally via `?utm_source=facebook-group`) → `analytics.js`
   records first-touch source (R12) and a `page_view`.
2. Home → Tutors → picks a tutor. `tutor_view` event fires (R11).
3. Tutor detail shows price + available slots (R2). Parent clicks a slot →
   `booking_started` event; booking form reveals with the slot pre-filled.
4. Form collects the R9 fields, validates (required, email format, grade range).
5. Submit → `store.createBooking()`:
   - booking saved
   - **slot flips to `requested` → disappears from availability (R5)**
   - `booking_created` event (R13)
   - owner notification simulated (R4)
6. Redirect to `confirmation.html?booking=…` showing tutor, date/time, student,
   subject, and "Dana will confirm by email shortly" (R6).

### Availability semantics — a decision to confirm with Dana

Dana said the requested time "should no longer show as available," so the
prototype removes the slot **on request** (no separate hold/accept step). If Dana
actually wants to review and accept requests first, that's a small change:
add a `confirmed` status and an accept action in the dashboard. Flagged in §5.

---

## 3. Analytics (R11–R13)

`analytics.js` writes events through `store.logEvent`. Events captured:

| Event | Fired when | Powers |
| ----- | ---------- | ------ |
| `page_view` | every page load (with path, referrer, utm params) | traffic + funnel top |
| `tutor_view` | tutor detail page load | most-viewed tutors (R11) |
| `subject_filter` | subject filter applied on Tutors page | most-viewed subjects (R11) |
| `booking_started` | slot selected / form opened | funnel middle |
| `booking_created` | form submitted successfully | conversion (R13) |

**Traffic source (R12):** on the first visit, read `?utm_source` / `?utm_medium`
and `document.referrer`, store as `firstTouch`. Dana shares links as
`…/?utm_source=facebook-group`. Fallback: classify `facebook.com` referrers as
Facebook. Everything else → "Direct / other."

**Dashboard (`dashboard.html`)** renders, from `events`:

- **Most-viewed tutors** — horizontal bars, `tutor_view` counts (R11)
- **Most-requested subjects** — bars from `subject_filter` + `booking_created` (R11)
- **Where visitors come from** — Facebook group vs. Direct/other, from `firstTouch` (R12)
- **Look-to-book funnel** — page views → tutor views → bookings started →
  bookings created, with the view-to-booking conversion rate called out (R13)
- **Recent requests** — the `bookings` list, newest first; this is Dana's
  working queue and stand-in for the email/text alert (R4)
- **"Load demo data"** button — seeds a realistic week of events so the dashboard
  is meaningful when showing Dana

Charts are hand-rolled CSS/inline-SVG bars — no dependency, palette per the
dataviz guidance (light, friendly, accessible contrast).

---

## 4. Design system (R7)

Light, warm, friendly — deliberately not corporate.

- **Ground:** warm off-white (`#FAFAF7`); text near-black, not pure black
- **Accent:** one friendly color (warm teal or coral) for buttons/links/active state
- **Type:** rounded, humanist sans (e.g. Nunito or Inter via Google Fonts) with a
  system-font fallback stack
- **Shape:** generous spacing, rounded corners (8–16px), soft shadows, no hard borders
- **Tokens:** CSS custom properties in `:root` (colors, spacing, radius, shadow)
- **Components:** header nav, tutor card, slot picker, form fields, primary button,
  toast, stat card, bar chart
- **Accessibility:** semantic landmarks, `<label>` per input, visible focus rings,
  alt text, AA contrast, keyboard-operable slot picker
- **Responsive:** single-column mobile → multi-column tutor grid on wider screens;
  no horizontal scroll

Parent-facing nav: **Home · Tutors**. Dashboard is reached by direct URL only.

---

## 5. Build milestones

| # | Milestone | Delivers | Requirements |
| - | --------- | -------- | ------------ |
| 1 | **Scaffold + design system** — repo layout, `style.css` tokens, shared header/footer, Home page; GitHub Pages deploy confirmed live | A styled Home page online | R7, R8 |
| 2 | **Seed data + `store.js`** — `data/tutors.json`, first-run seeding, full store API | Data layer with a console/manual test harness | R14 |
| 3 | **Tutors listing** — tutor cards, subject filter, links to detail; `tutor_view` / `subject_filter` events | Browsable tutor list | R1, R11 |
| 4 | **Tutor detail + booking path** — price display, availability slot picker, booking form with R9 fields + validation, `createBooking`, slot removal, confirmation page, simulated owner notification | End-to-end booking works | R2, R3, R4, R5, R6, R9 |
| 5 | **Analytics capture** — `analytics.js`: `page_view`, first-touch UTM/referrer, funnel events wired across all pages | Events accumulating in localStorage | R12, R13 |
| 6 | **Dashboard** — the five views in §3 + recent requests + "Load demo data" | Dana can see what's working | R4, R11, R12, R13 |
| 7 | **Polish** — responsive pass, a11y pass, empty states, microcopy, favicon, README (run instructions + "how to make it real") | Demo-ready prototype | R7 |

---

## 6. Out of scope for the prototype (explicit)

- **Online payment** — Dana confirmed it's not needed (R10)
- Real email/SMS delivery, real database, data shared across devices/browsers
- Authentication, tutor self-service, reschedule/cancel, timezone handling
- Multi-week recurring availability rules

The `store.js` seam is the upgrade path. Most likely phase-2 pick given Dana's
current workflow: **Google Sheet + Apps Script** — bookings append as rows, the
Sheet drives availability, Apps Script sends Dana the email. Alternative: Supabase
or Netlify/Cloudflare functions for a cleaner API.

---

## 7. Open questions for Dana

1. **Request vs. accept:** should a requested slot be auto-held (current plan), or
   do you want to review and accept each request first?
2. **Notification channel for the real version:** email, text, or both?
3. **Real datastore:** is keeping it in your Google Sheet the right call for phase 2?
4. **Tutor content:** who keeps the tutor list and availability up to date — and
   how far ahead do you set availability?
5. **Analytics privacy:** a public deploy that tracks visitors should carry a short
   privacy note — okay to add one?
