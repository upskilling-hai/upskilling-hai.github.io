/* Site + telemetry configuration.
 *
 * The PostHog key is intentionally NOT stored here (this file is committed and
 * the site is public). Provide it one of these ways — checked in this order:
 *
 *   1. window.CONFIG_LOCAL from js/config.local.js  — git-ignored; good for a
 *      local file you never commit, or for a deploy step that writes it.
 *   2. ?ph_key=phc_xxx in the URL, once             — saved to this browser only.
 *   3. The "Connect PostHog" box on the dashboard   — saved to this browser only.
 *
 * With no key the site works normally and the built-in dashboard still records
 * everything locally; it just doesn't forward to PostHog.
 */
window.CONFIG = {
  SITE_NAME: 'Bright Paths Tutoring',
  OWNER_NAME: 'Dana',
  OWNER_EMAIL: 'dana@brightpaths.example',

  POSTHOG_HOST: 'https://us.i.posthog.com',
  POSTHOG_KEY: '', // do not hardcode — see the note above
};

(function () {
  var C = window.CONFIG;

  // 1. local override file (js/config.local.js) — may set POSTHOG_KEY / _HOST
  if (window.CONFIG_LOCAL) {
    if (window.CONFIG_LOCAL.POSTHOG_KEY) C.POSTHOG_KEY = window.CONFIG_LOCAL.POSTHOG_KEY;
    if (window.CONFIG_LOCAL.POSTHOG_HOST) C.POSTHOG_HOST = window.CONFIG_LOCAL.POSTHOG_HOST;
  }

  // 2. ?ph_key=... in the URL — persist to this browser, then it behaves like (3)
  try {
    var params = new URLSearchParams(location.search);
    var fromUrl = params.get('ph_key');
    if (fromUrl != null) {
      if (fromUrl === '' || fromUrl === 'off') localStorage.removeItem('bp_posthog_key');
      else localStorage.setItem('bp_posthog_key', fromUrl);
    }
    var fromHost = params.get('ph_host');
    if (fromHost) localStorage.setItem('bp_posthog_host', fromHost);
  } catch (e) {}

  // 3. key saved in this browser (URL param above, or the dashboard box)
  try {
    if (!C.POSTHOG_KEY) {
      var saved = localStorage.getItem('bp_posthog_key');
      if (saved) C.POSTHOG_KEY = saved;
    }
    var savedHost = localStorage.getItem('bp_posthog_host');
    if (savedHost) C.POSTHOG_HOST = savedHost;
  } catch (e) {}

  C.POSTHOG_ENABLED =
    typeof C.POSTHOG_KEY === 'string' && C.POSTHOG_KEY.indexOf('phc_') === 0;
})();
