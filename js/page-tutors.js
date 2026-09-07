(function () {
  var grid = document.getElementById('grid');
  var filters = document.getElementById('filters');
  var tutors = Store.getTutors();
  var subjects = Store.getSubjects();
  var active = UI.param('subject') || 'All';

  function chip(label) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(label === active));
    b.addEventListener('click', function () {
      active = label;
      render();
      if (label !== 'All') track('subject_filtered', { subject: label });
    });
    return b;
  }

  function card(t) {
    var open = Store.getAvailableSlots(t.id).length;
    var el = document.createElement('a');
    el.className = 'card tutor-card';
    el.href = 'tutor.html?id=' + encodeURIComponent(t.id);
    el.innerHTML =
      '<div class="top">' + UI.avatar(t.name, 56) +
        '<div><h3>' + UI.escapeHtml(t.name) + '</h3>' +
        '<div class="price">' + UI.money(t.hourlyPrice) + '/hour · ' +
        (open ? open + ' times open' : 'no times open') + '</div></div>' +
      '</div>' +
      '<div class="headline">' + UI.escapeHtml(t.headline) + '</div>' +
      '<div class="tag-row">' + t.subjects.map(function (s) {
        return '<span class="tag">' + UI.escapeHtml(s) + '</span>';
      }).join('') + '</div>';
    el.addEventListener('click', function () {
      track('tutor_card_clicked', { tutor_id: t.id, tutor_name: t.name });
    });
    return el;
  }

  function render() {
    filters.innerHTML = '';
    ['All'].concat(subjects).forEach(function (s) { filters.appendChild(chip(s)); });

    var list = active === 'All'
      ? tutors
      : tutors.filter(function (t) { return t.subjects.indexOf(active) > -1; });

    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<p>No tutors for that subject yet.</p>';
      return;
    }
    list.forEach(function (t) { grid.appendChild(card(t)); });
  }

  render();
})();
