(function () {
  var content = document.getElementById('content');
  var booking = Store.getBooking(UI.param('booking'));

  if (!booking) {
    content.innerHTML =
      '<h1>Nothing to show</h1><p>We couldn\'t find that request. <a href="tutors.html">Browse tutors</a>.</p>';
    return;
  }

  var tutor = Store.getTutor(booking.tutorId);

  content.innerHTML =
    '<div class="card confirm-card">' +
      '<div class="check" aria-hidden="true">✓</div>' +
      '<h1>Request received</h1>' +
      '<p>Thanks, ' + UI.escapeHtml(booking.parentName.split(' ')[0]) + '. ' +
        CONFIG.OWNER_NAME + ' has been notified and will confirm by email at ' +
        '<strong>' + UI.escapeHtml(booking.parentEmail) + '</strong> shortly. ' +
        'That time is now held and no longer shows as available.</p>' +
      '<dl class="summary">' +
        row('Tutor', tutor ? tutor.name : booking.tutorId) +
        row('Time', UI.slotLabel(booking.startsAt)) +
        row('Student', booking.studentFirstName + ' · Grade ' + booking.studentGrade) +
        row('Subject', booking.subject) +
      '</dl>' +
      '<p style="margin-top:24px"><a class="btn ghost" href="tutors.html">Back to tutors</a></p>' +
    '</div>';

  function row(k, v) {
    return '<div><dt>' + k + '</dt><dd>' + UI.escapeHtml(v) + '</dd></div>';
  }

  track('confirmation_viewed', { booking_id: booking.id, tutor_id: booking.tutorId });
})();
