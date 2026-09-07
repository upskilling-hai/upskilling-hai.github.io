(function () {
  var content = document.getElementById('content');
  var id = UI.param('id');
  var tutor = id && Store.getTutor(id);

  if (!tutor) {
    content.innerHTML = '<h1>Tutor not found</h1><p>That tutor link doesn\'t match anyone. <a href="tutors.html">See all tutors</a>.</p>';
    return;
  }

  document.title = tutor.name + ' · Bright Paths Tutoring';
  var slots = Store.getAvailableSlots(tutor.id);
  var selectedSlot = null;

  track('tutor_viewed', {
    tutor_id: tutor.id,
    tutor_name: tutor.name,
    subjects: tutor.subjects.join(', '),
    hourly_price: tutor.hourlyPrice,
    open_slots: slots.length,
  });

  var gradeOptions = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    .map(function (g) { return '<option value="' + g + '">' + (/\d/.test(g) ? 'Grade ' + g : g) + '</option>'; })
    .join('');
  var subjectOptions = tutor.subjects
    .map(function (s) { return '<option value="' + UI.escapeHtml(s) + '">' + UI.escapeHtml(s) + '</option>'; })
    .join('');

  content.innerHTML =
    '<div class="detail-head">' + UI.avatar(tutor.name, 84) +
      '<div><h1 style="margin-bottom:6px">' + UI.escapeHtml(tutor.name) + '</h1>' +
      '<div class="tag-row">' + tutor.subjects.map(function (s) {
        return '<span class="tag">' + UI.escapeHtml(s) + '</span>';
      }).join('') + '</div></div>' +
    '</div>' +
    '<p class="price-big">' + UI.money(tutor.hourlyPrice) + ' <span>per hour</span></p>' +
    '<p>' + UI.escapeHtml(tutor.bio) + '</p>' +

    '<h2 style="margin-top:32px">Pick a time</h2>' +
    (slots.length
      ? '<div class="slot-grid" id="slots" role="group" aria-label="Available times"></div>'
      : '<p class="slot-empty">No open times right now. Check back soon, or try another tutor.</p>') +

    '<div id="form-area"></div>';

  if (!slots.length) return;

  var slotGrid = document.getElementById('slots');
  slots.forEach(function (slot) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.textContent = UI.slotLabel(slot.startsAt);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      selectedSlot = slot;
      slotGrid.querySelectorAll('.slot').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      showForm();
      track('booking_started', {
        tutor_id: tutor.id, tutor_name: tutor.name, slot_id: slot.id, starts_at: slot.startsAt,
      });
    });
    slotGrid.appendChild(b);
  });

  var formArea = document.getElementById('form-area');
  var formShown = false;

  function showForm() {
    if (formShown) {
      document.getElementById('slot-echo').textContent = UI.slotLabel(selectedSlot.startsAt);
      return;
    }
    formShown = true;
    formArea.innerHTML =
      '<h2 style="margin-top:32px">Your request</h2>' +
      '<p>Requesting <strong id="slot-echo">' + UI.slotLabel(selectedSlot.startsAt) + '</strong> with ' + UI.escapeHtml(tutor.name) + '.</p>' +
      '<div id="err" hidden></div>' +
      '<form class="booking" id="booking" novalidate>' +
        '<div class="field"><label for="parentName">Your name</label>' +
          '<input id="parentName" name="parentName" autocomplete="name" required></div>' +
        '<div class="field"><label for="parentEmail">Your email</label>' +
          '<input id="parentEmail" name="parentEmail" type="email" autocomplete="email" required></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="studentFirstName">Student\'s first name</label>' +
            '<input id="studentFirstName" name="studentFirstName" autocomplete="off" required></div>' +
          '<div class="field"><label for="studentGrade">Student\'s grade</label>' +
            '<select id="studentGrade" name="studentGrade" required>' +
              '<option value="">Choose…</option>' + gradeOptions + '</select></div>' +
        '</div>' +
        '<div class="field"><label for="subject">Requested subject</label>' +
          '<select id="subject" name="subject" required>' +
            '<option value="">Choose…</option>' + subjectOptions + '</select></div>' +
        '<button class="btn" type="submit">Send request</button>' +
      '</form>';

    formArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('booking').addEventListener('submit', onSubmit);
  }

  function onSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var payload = {
      slotId: selectedSlot.id,
      parentName: f.parentName.value,
      parentEmail: f.parentEmail.value,
      studentFirstName: f.studentFirstName.value,
      studentGrade: f.studentGrade.value,
      subject: f.subject.value,
    };
    var res = Store.createBooking(payload);
    var errBox = document.getElementById('err');

    if (!res.ok) {
      errBox.hidden = false;
      errBox.className = 'form-error';
      errBox.innerHTML = 'Please check the form:<ul>' +
        res.errors.map(function (m) { return '<li>' + UI.escapeHtml(m) + '</li>'; }).join('') + '</ul>';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      track('booking_validation_failed', { tutor_id: tutor.id, reasons: res.errors.join('; ') });
      return;
    }

    track('booking_submitted', {
      booking_id: res.booking.id,
      tutor_id: tutor.id,
      tutor_name: tutor.name,
      subject: res.booking.subject,
      student_grade: res.booking.studentGrade,
      starts_at: res.booking.startsAt,
    });
    if (window.posthog && CONFIG.POSTHOG_ENABLED) {
      try { posthog.identify(res.booking.parentEmail, { name: res.booking.parentName }); } catch (e2) {}
    }

    UI.toast('Request sent — ' + CONFIG.OWNER_NAME + ' has been notified by email.');
    setTimeout(function () {
      location.href = 'confirmation.html?booking=' + encodeURIComponent(res.booking.id);
    }, 700);
  }
})();
