(function () {
  var FUNNEL_COLORS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab']; // ordinal blue ramp

  function bySession(events) {
    var map = {};
    events.forEach(function (e) {
      var sid = (e.props && e.props.session_id) || 'anon';
      if (!map[sid]) map[sid] = { types: {}, source: null, first: e.at };
      map[sid].types[e.type] = true;
      if (!map[sid].source && e.props && e.props.first_touch_source) {
        map[sid].source = e.props.first_touch_source;
      }
    });
    return map;
  }

  function countBy(events, type, keyFn) {
    var out = {};
    events.forEach(function (e) {
      if (e.type !== type) return;
      var k = keyFn(e);
      if (!k) return;
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  function toSorted(obj) {
    return Object.keys(obj)
      .map(function (k) { return { label: k, value: obj[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function renderBars(el, rows) {
    if (!rows.length) { el.innerHTML = '<p class="req-empty">No data yet.</p>'; return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }));
    el.innerHTML = rows.map(function (r) {
      var pct = Math.max(2, Math.round((r.value / max) * 100));
      return '<div class="bar-row">' +
        '<span class="bar-label" title="' + UI.escapeHtml(r.label) + '">' + UI.escapeHtml(r.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%" title="' + UI.escapeHtml(r.label) + ': ' + r.value + '"></span></span>' +
        '<span class="bar-value">' + r.value + '</span>' +
      '</div>';
    }).join('');
  }

  function render() {
    var events = Store.getEvents();
    var sessions = bySession(events);
    var sids = Object.keys(sessions);

    var visited = sids.length;
    var viewedTutor = sids.filter(function (s) { return sessions[s].types['tutor_viewed']; }).length;
    var started = sids.filter(function (s) { return sessions[s].types['booking_started']; }).length;
    var sent = sids.filter(function (s) { return sessions[s].types['booking_submitted']; }).length;
    var rate = visited ? Math.round((sent / visited) * 1000) / 10 : 0;

    // KPIs
    document.getElementById('kpis').innerHTML = [
      kpi('Visitors', visited, 'unique sessions'),
      kpi('Tutor page views', events.filter(function (e) { return e.type === 'tutor_viewed'; }).length, 'all opens'),
      kpi('Requests sent', sent, 'booking requests'),
      kpi('Look-to-book', rate + '%', 'visitors who requested'),
    ].join('');

    // Funnel
    var steps = [
      ['Visited the site', visited],
      ['Viewed a tutor', viewedTutor],
      ['Started a request', started],
      ['Sent a request', sent],
    ];
    var fmax = visited || 1;
    document.getElementById('funnel').innerHTML = steps.map(function (s, i) {
      var w = Math.max(6, Math.round((s[1] / fmax) * 100));
      return '<div class="funnel-step">' +
        '<span class="fl">' + s[0] + '</span>' +
        '<span class="funnel-bar" style="width:' + w + '%;background:' + FUNNEL_COLORS[i] + '">' + s[1] + '</span>' +
      '</div>';
    }).join('');

    // Tutor views
    renderBars(document.getElementById('tutorBars'),
      toSorted(countBy(events, 'tutor_viewed', function (e) { return e.props.tutor_name; })));

    // Subjects: subject_filtered + tutor_viewed.subject
    var subj = {};
    events.forEach(function (e) {
      var s = null;
      if (e.type === 'subject_filtered') s = e.props.subject;
      else if (e.type === 'tutor_viewed') s = e.props.subject;
      if (s) subj[s] = (subj[s] || 0) + 1;
    });
    renderBars(document.getElementById('subjectBars'), toSorted(subj));

    // Sources: one per session (first touch)
    var src = {};
    sids.forEach(function (s) {
      var k = sessions[s].source || 'direct';
      src[k] = (src[k] || 0) + 1;
    });
    renderBars(document.getElementById('sourceBars'), toSorted(src));

    // Requests table
    var bookings = Store.getBookings();
    var table = document.getElementById('requests');
    if (!bookings.length) {
      table.innerHTML = '<tbody><tr><td class="req-empty">No requests yet. Book one from a tutor page, or load demo data.</td></tr></tbody>';
    } else {
      table.innerHTML =
        '<thead><tr><th>Received</th><th>Student</th><th>Grade</th><th>Subject</th><th>Tutor</th><th>Time</th><th>Parent email</th></tr></thead><tbody>' +
        bookings.slice(0, 30).map(function (b) {
          var t = Store.getTutor(b.tutorId);
          return '<tr>' +
            '<td>' + new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</td>' +
            '<td>' + UI.escapeHtml(b.studentFirstName) + '</td>' +
            '<td>' + UI.escapeHtml(b.studentGrade) + '</td>' +
            '<td>' + UI.escapeHtml(b.subject) + '</td>' +
            '<td>' + UI.escapeHtml(t ? t.name : b.tutorId) + '</td>' +
            '<td>' + UI.slotLabel(b.startsAt) + '</td>' +
            '<td>' + UI.escapeHtml(b.parentEmail) + '</td>' +
          '</tr>';
        }).join('') + '</tbody>';
    }

    // Telemetry note
    document.getElementById('tele').innerHTML = CONFIG.POSTHOG_ENABLED
      ? 'PostHog telemetry is <strong>on</strong> — every event on this page also flows to your PostHog project (<code>' + UI.escapeHtml(CONFIG.POSTHOG_HOST) + '</code>). This dashboard reads a local copy so it works offline too.'
      : 'PostHog is <strong>not configured yet</strong>. This dashboard runs on locally-recorded events. Add your project key in <code>js/config.js</code> to forward events to PostHog and use its dashboards.';
  }

  function kpi(label, value, sub) {
    return '<div class="card kpi"><div class="label">' + label + '</div>' +
      '<div class="value">' + value + '</div><div class="sub">' + sub + '</div></div>';
  }

  // ---- PostHog connect box (key saved to this browser only) ----
  (function () {
    var box = document.getElementById('phConnect');
    var input = document.getElementById('phKey');
    var saved = null;
    try { saved = localStorage.getItem('bp_posthog_key'); } catch (e) {}
    if (saved) {
      box.open = false;
      input.placeholder = 'phc_…' + saved.slice(-4) + '  (connected)';
    } else {
      box.open = true;
    }
    document.getElementById('phSave').addEventListener('click', function () {
      var v = input.value.trim();
      if (v.indexOf('phc_') !== 0) { UI.toast('That doesn\'t look like a phc_ key.'); return; }
      try { localStorage.setItem('bp_posthog_key', v); } catch (e) {}
      UI.toast('PostHog connected — reloading.');
      setTimeout(function () { location.reload(); }, 600);
    });
    document.getElementById('phClear').addEventListener('click', function () {
      try { localStorage.removeItem('bp_posthog_key'); } catch (e) {}
      UI.toast('Disconnected — reloading.');
      setTimeout(function () { location.reload(); }, 600);
    });
  })();

  document.getElementById('demo').addEventListener('click', function () {
    Store.loadDemoData();
    UI.toast('Demo data loaded.');
    render();
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!confirm('Clear all bookings and analytics on this device?')) return;
    Store.resetAll();
    try { sessionStorage.removeItem('bp_session_id'); } catch (e) {}
    UI.toast('Data reset.');
    render();
  });

  render();
})();
