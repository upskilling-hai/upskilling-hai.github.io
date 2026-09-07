/* store.js — the whole data layer for the prototype.
 *
 * Everything lives in localStorage so the prototype needs no backend. This is
 * the ONE module to replace when the booking store becomes real (a database,
 * a serverless function, or Dana's Google Sheet via Apps Script): keep the
 * method names and the UI keeps working.
 */
window.Store = (function () {
  var K = {
    tutors: 'bp_tutors',
    slots: 'bp_slots',
    bookings: 'bp_bookings',
    events: 'bp_events',
    firstTouch: 'bp_first_touch',
    seeded: 'bp_seeded_v1',
  };

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
  }

  function buildSlots(tutors) {
    var slots = [];
    var now = new Date();
    var times = [[15, 0], [16, 30], [18, 0]];
    tutors.forEach(function (t) {
      var added = 0;
      for (var d = 1; d <= 21 && added < 9; d++) {
        var day = new Date(now);
        day.setDate(now.getDate() + d);
        day.setHours(0, 0, 0, 0);
        var dow = day.getDay();
        if (dow === 0 || dow === 6) continue; // weekdays only
        times.forEach(function (hm) {
          if (added >= 9) return;
          var start = new Date(day);
          start.setHours(hm[0], hm[1], 0, 0);
          // Deterministic pseudo-availability so the demo looks stable.
          var taken = (d + hm[0] + t.id.length) % 3 === 0;
          slots.push({
            id: uid('slot'),
            tutorId: t.id,
            startsAt: start.toISOString(),
            status: taken ? 'requested' : 'available',
          });
          added++;
        });
      }
    });
    return slots;
  }

  function seed() {
    if (localStorage.getItem(K.seeded)) return;
    var tutors = (window.SEED && window.SEED.tutors) || [];
    write(K.tutors, tutors);
    write(K.slots, buildSlots(tutors));
    write(K.bookings, []);
    if (!localStorage.getItem(K.events)) write(K.events, []);
    localStorage.setItem(K.seeded, '1');
  }
  seed();

  function validateBooking(p) {
    var errors = [];
    if (!p.parentName || !p.parentName.trim()) errors.push('Your name is required.');
    if (!p.parentEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.parentEmail.trim()))
      errors.push('A valid email address is required.');
    if (!p.studentFirstName || !p.studentFirstName.trim())
      errors.push("The student's first name is required.");
    if (!p.studentGrade) errors.push("The student's grade is required.");
    if (!p.subject) errors.push('A requested subject is required.');
    if (!p.slotId) errors.push('Please choose a time.');
    return errors;
  }

  function notifyOwner(booking) {
    var cfg = window.CONFIG || {};
    // Prototype: log + surface in the dashboard "Requests" queue + a toast.
    // Production: send Dana an email or text here.
    console.info(
      '[notify] New session request for ' + (cfg.OWNER_NAME || 'the owner') +
      ' (' + (cfg.OWNER_EMAIL || 'owner') + ')', booking
    );
  }

  var Store = {
    KEYS: K,

    getTutors: function () { return read(K.tutors, []); },
    getTutor: function (id) {
      return Store.getTutors().filter(function (t) { return t.id === id; })[0] || null;
    },
    getSubjects: function () {
      var set = {};
      Store.getTutors().forEach(function (t) {
        (t.subjects || []).forEach(function (s) { set[s] = true; });
      });
      return Object.keys(set).sort();
    },

    getAllSlots: function () { return read(K.slots, []); },
    getAvailableSlots: function (tutorId) {
      var nowIso = new Date().toISOString();
      return read(K.slots, [])
        .filter(function (s) {
          return s.tutorId === tutorId && s.status === 'available' && s.startsAt > nowIso;
        })
        .sort(function (a, b) { return a.startsAt.localeCompare(b.startsAt); });
    },
    getSlot: function (id) {
      return read(K.slots, []).filter(function (s) { return s.id === id; })[0] || null;
    },

    /* Create a booking request. Returns { ok, booking } or { ok:false, errors }. */
    createBooking: function (payload) {
      var errors = validateBooking(payload);
      if (errors.length) return { ok: false, errors: errors };

      var slots = read(K.slots, []);
      var slot = slots.filter(function (s) { return s.id === payload.slotId; })[0];
      if (!slot || slot.status !== 'available') {
        return { ok: false, errors: ['That time was just taken — please pick another.'] };
      }
      slot.status = 'requested'; // <- the slot stops showing as available
      write(K.slots, slots);

      var booking = {
        id: uid('bk'),
        slotId: slot.id,
        tutorId: slot.tutorId,
        startsAt: slot.startsAt,
        createdAt: new Date().toISOString(),
        parentName: payload.parentName.trim(),
        parentEmail: payload.parentEmail.trim(),
        studentFirstName: payload.studentFirstName.trim(),
        studentGrade: payload.studentGrade,
        subject: payload.subject,
        status: 'requested',
      };
      var bookings = read(K.bookings, []);
      bookings.push(booking);
      write(K.bookings, bookings);

      notifyOwner(booking);
      return { ok: true, booking: booking };
    },

    getBooking: function (id) {
      return read(K.bookings, []).filter(function (b) { return b.id === id; })[0] || null;
    },
    getBookings: function () {
      return read(K.bookings, []).slice().sort(function (a, b) {
        return b.createdAt.localeCompare(a.createdAt);
      });
    },

    /* Local mirror of every tracked event, so the built-in dashboard works
     * without querying PostHog. `at` lets demo data backdate events. */
    mirrorEvent: function (type, props, at) {
      var events = read(K.events, []);
      events.push({
        id: uid('ev'),
        type: type,
        at: at || new Date().toISOString(),
        props: props || {},
      });
      if (events.length > 8000) events.splice(0, events.length - 8000);
      write(K.events, events);
    },
    getEvents: function () { return read(K.events, []); },

    getFirstTouch: function () { return read(K.firstTouch, null); },
    setFirstTouch: function (v) { write(K.firstTouch, v); },

    resetAll: function () {
      Object.keys(K).forEach(function (name) { localStorage.removeItem(K[name]); });
      seed();
    },

    /* Fill the dashboard with a realistic couple of weeks of activity. */
    loadDemoData: function () {
      var tutors = Store.getTutors();
      if (!tutors.length) return;

      var sources = [
        ['facebook-group', 0.42],
        ['direct', 0.22],
        ['google', 0.18],
        ['instagram', 0.12],
        ['other', 0.06],
      ];
      var grades = ['3', '5', '6', '7', '8', '9', '10', '11'];
      function weighted(pairs) {
        var r = Math.random(), acc = 0;
        for (var i = 0; i < pairs.length; i++) {
          acc += pairs[i][1];
          if (r <= acc) return pairs[i][0];
        }
        return pairs[pairs.length - 1][0];
      }
      function randInt(n) { return Math.floor(Math.random() * n); }
      function pickTutor() {
        // front of the list is more popular
        var r = Math.random();
        var idx = Math.floor(Math.pow(r, 1.8) * tutors.length);
        return tutors[Math.min(idx, tutors.length - 1)];
      }

      var now = Date.now();
      var DAY = 86400000;
      var sessions = 170;

      for (var s = 0; s < sessions; s++) {
        var source = weighted(sources);
        var t0 = now - randInt(14) * DAY - randInt(DAY);
        var sid = 'demo-' + s + '-' + Math.random().toString(36).slice(2, 7);
        var step = 0;
        function at() { return new Date(t0 + (step++) * 45000).toISOString(); }
        var common = {
          first_touch_source: source,
          session_id: sid,
          demo: true,
        };
        function ev(type, extra) {
          var props = Object.assign({}, common, extra || {});
          Store.mirrorEvent(type, props, at());
        }

        ev('page_view', { path: '/', title: 'Home' });
        if (Math.random() < 0.86) ev('page_view', { path: '/tutors.html', title: 'Tutors' });
        else continue;

        var subject = null;
        if (Math.random() < 0.55) {
          subject = Store.getSubjects()[randInt(Store.getSubjects().length)];
          ev('subject_filtered', { subject: subject });
        }

        if (Math.random() < 0.6) {
          var tut = pickTutor();
          var subj = subject && tut.subjects.indexOf(subject) > -1
            ? subject : tut.subjects[randInt(tut.subjects.length)];
          ev('page_view', { path: '/tutor.html', title: tut.name });
          ev('tutor_viewed', {
            tutor_id: tut.id, tutor_name: tut.name, subject: subj,
            hourly_price: tut.hourlyPrice,
          });

          if (Math.random() < 0.34) {
            ev('booking_started', { tutor_id: tut.id, tutor_name: tut.name, subject: subj });

            if (Math.random() < 0.56) {
              var grade = grades[randInt(grades.length)];
              ev('booking_submitted', {
                tutor_id: tut.id, tutor_name: tut.name, subject: subj,
                student_grade: grade,
              });
              ev('page_view', { path: '/confirmation.html', title: 'Request received' });

              // Reflect a few of these as real booking rows in the queue.
              if (Math.random() < 0.5) {
                var slots = read(K.slots, []);
                var open = slots.filter(function (sl) {
                  return sl.tutorId === tut.id && sl.status === 'available';
                });
                if (open.length) {
                  var slot = open[randInt(open.length)];
                  slot.status = 'requested';
                  write(K.slots, slots);
                  var bookings = read(K.bookings, []);
                  bookings.push({
                    id: uid('bk'),
                    slotId: slot.id, tutorId: tut.id, startsAt: slot.startsAt,
                    createdAt: new Date(t0 + step * 45000).toISOString(),
                    parentName: 'Demo Parent ' + (s + 1),
                    parentEmail: 'parent' + (s + 1) + '@example.com',
                    studentFirstName: ['Sam', 'Alex', 'Jo', 'Riya', 'Noah', 'Mia'][randInt(6)],
                    studentGrade: grade,
                    subject: subj,
                    status: 'requested',
                    demo: true,
                  });
                  write(K.bookings, bookings);
                }
              }
            }
          }
        }
      }
    },
  };

  return Store;
})();
