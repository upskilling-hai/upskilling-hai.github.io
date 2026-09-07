/* analytics.js — one tracking call that fans out to PostHog and the local mirror.
 *
 *   track('tutor_viewed', { tutor_id, tutor_name, subject })
 *
 * Also captures first-touch attribution (which channel sent this visitor) once
 * per browser, so the dashboard can answer "is the Facebook group working?".
 */
(function () {
  var cfg = window.CONFIG || {};

  function classifyReferrer(ref) {
    if (!ref) return 'direct';
    try {
      var host = new URL(ref).hostname.replace(/^www\./, '');
      if (host === location.hostname) return 'internal';
      if (/facebook\.com|fb\.com|m\.facebook/.test(host)) return 'facebook-group';
      if (/instagram\.com/.test(host)) return 'instagram';
      if (/google\./.test(host)) return 'google';
      if (/bing\.com|duckduckgo\.com|search\.yahoo/.test(host)) return 'search';
      if (/t\.co|twitter\.com|x\.com/.test(host)) return 'twitter';
      return host;
    } catch (e) {
      return 'other';
    }
  }

  // --- session id (for funnel/unique-visitor math in the local dashboard) ---
  var sessionId;
  try {
    sessionId = sessionStorage.getItem('bp_session_id');
    if (!sessionId) {
      sessionId = 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('bp_session_id', sessionId);
    }
  } catch (e) {
    sessionId = 's-' + Math.random().toString(36).slice(2, 10);
  }

  // --- first-touch attribution ---
  var params = new URLSearchParams(location.search);
  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
    var v = params.get(k);
    if (v) utm[k] = v;
  });

  var firstTouch = Store.getFirstTouch();
  if (!firstTouch) {
    firstTouch = {
      source: utm.utm_source || classifyReferrer(document.referrer),
      medium: utm.utm_medium || (utm.utm_source ? 'campaign' : 'referral'),
      campaign: utm.utm_campaign || null,
      referrer: document.referrer || '',
      landing_path: location.pathname,
      at: new Date().toISOString(),
    };
    Store.setFirstTouch(firstTouch);
    if (window.posthog && cfg.POSTHOG_ENABLED) {
      try {
        // set-once person properties: first channel that ever sent this visitor
        posthog.setPersonProperties({}, {
          first_touch_source: firstTouch.source,
          first_touch_medium: firstTouch.medium,
          first_touch_campaign: firstTouch.campaign,
        });
        posthog.register({ first_touch_source: firstTouch.source });
      } catch (e) {}
    }
  }

  window.track = function track(event, props) {
    props = props || {};
    var enriched = Object.assign({}, props, {
      path: location.pathname,
      session_id: sessionId,
      first_touch_source: firstTouch.source,
      first_touch_medium: firstTouch.medium,
    });
    if (window.posthog && cfg.POSTHOG_ENABLED) {
      try { posthog.capture(event, enriched); } catch (e) {}
    }
    Store.mirrorEvent(event, enriched);
  };

  window.trackFirstTouch = firstTouch;

  // Every page load is a page_view in the local mirror (PostHog captures its
  // own $pageview automatically when enabled).
  window.track('page_view', { title: document.title.replace(/ · .*/, '') });
})();
