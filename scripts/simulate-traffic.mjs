#!/usr/bin/env node
/*
 * Simulates parent traffic against the Bright Paths site and sends the events
 * to PostHog, so the customer can see the analytics working with realistic
 * numbers before any real visitors arrive.
 *
 * Usage:
 *   POSTHOG_API_KEY=phc_xxx node scripts/simulate-traffic.mjs
 *   POSTHOG_API_KEY=phc_xxx node scripts/simulate-traffic.mjs --visitors=300 --days=21
 *   node scripts/simulate-traffic.mjs --dry-run        # no key needed; prints the plan
 *
 * Env / flags:
 *   POSTHOG_API_KEY   PostHog *project* API key (phc_...). Omit for a dry run.
 *   POSTHOG_HOST      default https://us.i.posthog.com  (EU: https://eu.i.posthog.com)
 *   SITE_URL          default https://upskilling-hai.github.io
 *   --visitors=N      number of simulated sessions (default 220)
 *   --days=N          spread events over the last N days (default 14)
 *   --dry-run         don't send; print a summary
 */

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};

const HOST = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
const KEY = process.env.POSTHOG_API_KEY || process.env.POSTHOG_KEY || '';
const SITE = (process.env.SITE_URL || 'https://upskilling-hai.github.io').replace(/\/$/, '');
const VISITORS = Number(flag('visitors', 220));
const DAYS = Number(flag('days', 14));
const DRY = Boolean(flag('dry-run', false)) || !KEY;

// Kept in sync with js/seed-data.js (prototype — small enough to duplicate).
const TUTORS = [
  { id: 't-amara', name: 'Amara Okafor', subjects: ['Math', 'SAT Prep'], price: 45 },
  { id: 't-ben', name: 'Ben Halvorsen', subjects: ['English', 'SAT Prep'], price: 40 },
  { id: 't-chen', name: 'Chen Wei', subjects: ['Science', 'Math'], price: 50 },
  { id: 't-dalia', name: 'Dalia Rivera', subjects: ['Spanish', 'English'], price: 38 },
  { id: 't-eli', name: 'Eli Berg', subjects: ['Coding', 'Math'], price: 55 },
  { id: 't-fatima', name: 'Fatima Noor', subjects: ['Science', 'SAT Prep'], price: 48 },
];
const SUBJECTS = [...new Set(TUTORS.flatMap((t) => t.subjects))];
const GRADES = ['3', '4', '5', '6', '7', '8', '9', '10', '11'];

const CHANNELS = [
  {
    key: 'facebook-group', weight: 0.42,
    referrer: 'https://www.facebook.com/',
    utm: { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'fb-group' },
  },
  {
    key: 'instagram', weight: 0.12,
    referrer: 'https://l.instagram.com/',
    utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'ig-bio' },
  },
  { key: 'google', weight: 0.18, referrer: 'https://www.google.com/', utm: null },
  { key: 'direct', weight: 0.22, referrer: '', utm: null },
  { key: 'other', weight: 0.06, referrer: 'https://nextdoor.com/', utm: null },
];

const rnd = (n) => Math.floor(Math.random() * n);
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[rnd(arr.length)];
function weighted(list) {
  let r = Math.random(), acc = 0;
  for (const item of list) { acc += item.weight; if (r <= acc) return item; }
  return list[list.length - 1];
}
function popularTutor() {
  // front of the list is more popular (power curve)
  return TUTORS[Math.min(TUTORS.length - 1, Math.floor(Math.pow(Math.random(), 1.8) * TUTORS.length))];
}

const batch = [];
const tally = { byEvent: {}, byChannel: {}, funnel: { visited: 0, tutor: 0, started: 0, sent: 0 } };

for (let i = 0; i < VISITORS; i++) {
  const channel = weighted(CHANNELS);
  const distinctId = `sim_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`;
  let clock = Date.now() - rnd(DAYS) * 864e5 - rnd(864e5);
  let firstEvent = true;

  const emit = (event, props = {}) => {
    clock += 20000 + rnd(90000);
    const isPageview = event === '$pageview';
    const entry = {
      event,
      distinct_id: distinctId,
      timestamp: new Date(clock).toISOString(),
      properties: {
        $lib: 'bright-paths-sim',
        $current_url: `${SITE}${props.path || '/'}`,
        $pathname: props.path || '/',
        $referrer: channel.referrer || '$direct',
        $referring_domain: channel.referrer ? new URL(channel.referrer).hostname : '$direct',
        first_touch_source: channel.key,
        ...(channel.utm || {}),
        ...props,
      },
    };
    delete entry.properties.path;
    if (firstEvent) {
      entry.properties.$set_once = {
        first_touch_source: channel.key,
        first_touch_medium: channel.utm ? channel.utm.utm_medium : 'referral',
        first_touch_campaign: channel.utm ? channel.utm.utm_campaign : null,
      };
      firstEvent = false;
    }
    batch.push(entry);
    tally.byEvent[event] = (tally.byEvent[event] || 0) + 1;
    if (isPageview) return;
  };

  // ---- the funnel ----
  tally.byChannel[channel.key] = (tally.byChannel[channel.key] || 0) + 1;
  tally.funnel.visited++;
  emit('$pageview', { path: '/', title: 'Home' });

  if (!chance(0.87)) continue;
  emit('$pageview', { path: '/tutors.html', title: 'Our tutors' });

  let subject = null;
  if (chance(0.55)) {
    subject = pick(SUBJECTS);
    emit('subject_filtered', { subject });
  }

  if (!chance(0.62)) continue;
  const tutor = popularTutor();
  const subj = subject && tutor.subjects.includes(subject) ? subject : pick(tutor.subjects);
  tally.funnel.tutor++;
  emit('$pageview', { path: '/tutor.html', title: tutor.name });
  emit('tutor_viewed', {
    tutor_id: tutor.id, tutor_name: tutor.name, subject: subj, hourly_price: tutor.price,
  });

  if (!chance(0.34)) continue;
  tally.funnel.started++;
  emit('booking_started', { tutor_id: tutor.id, tutor_name: tutor.name, subject: subj });

  if (chance(0.25)) {
    emit('booking_validation_failed', { tutor_id: tutor.id, reasons: 'A valid email address is required.' });
  }

  if (!chance(0.58)) continue;
  const grade = pick(GRADES);
  tally.funnel.sent++;
  emit('booking_submitted', {
    tutor_id: tutor.id, tutor_name: tutor.name, subject: subj,
    student_grade: grade, starts_at: new Date(clock + 6 * 864e5).toISOString(),
  });
  emit('$pageview', { path: '/confirmation.html', title: 'Request received' });
}

// ---------------------------------------------------------------------------

function printSummary() {
  const f = tally.funnel;
  const pct = (n) => (f.visited ? ((n / f.visited) * 100).toFixed(1) : '0.0') + '%';
  console.log(`\nSimulated ${VISITORS} visitors over ${DAYS} days → ${batch.length} events\n`);
  console.log('Channels (first touch):');
  for (const [k, v] of Object.entries(tally.byChannel).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${v}`);
  }
  console.log('\nLook-to-book funnel:');
  console.log(`  Visited the site   ${String(f.visited).padStart(4)}   ${pct(f.visited)}`);
  console.log(`  Viewed a tutor     ${String(f.tutor).padStart(4)}   ${pct(f.tutor)}`);
  console.log(`  Started a request  ${String(f.started).padStart(4)}   ${pct(f.started)}`);
  console.log(`  Sent a request     ${String(f.sent).padStart(4)}   ${pct(f.sent)}`);
  console.log('\nEvents by type:');
  for (const [k, v] of Object.entries(tally.byEvent).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
}

async function send() {
  const chunks = [];
  for (let i = 0; i < batch.length; i += 100) chunks.push(batch.slice(i, i + 100));
  let sent = 0;
  for (const [idx, chunk] of chunks.entries()) {
    const res = await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, historical_migration: false, batch: chunk }),
    });
    if (!res.ok) {
      console.error(`Batch ${idx + 1}/${chunks.length} failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    sent += chunk.length;
    process.stdout.write(`\rSent ${sent}/${batch.length} events…`);
  }
  console.log('');
}

if (DRY) {
  if (!KEY) console.log('No POSTHOG_API_KEY set — running as --dry-run.');
  printSummary();
  console.log('\nSample event payload:');
  console.log(JSON.stringify(batch[Math.min(3, batch.length - 1)], null, 2));
  console.log('\nSet POSTHOG_API_KEY and re-run to send these to PostHog.');
} else {
  console.log(`Sending to ${HOST} …`);
  await send();
  printSummary();
  console.log(`\nDone. Open PostHog → Activity to see the events, or build insights per scripts/README.md.`);
}
