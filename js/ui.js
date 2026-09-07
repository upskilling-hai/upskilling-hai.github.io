/* Small shared UI helpers. */
window.UI = (function () {
  var AVATAR_COLORS = ['#e8f0e6', '#fdeee6', '#e7eef7', '#f3e9f6', '#eaf3f2', '#fbf0e0'];

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase();
  }

  function avatar(name, size) {
    size = size || 64;
    var bg = AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];
    return (
      '<span class="avatar" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + ';font-size:' + Math.round(size * 0.36) + 'px" aria-hidden="true">' +
      initials(name) + '</span>'
    );
  }

  function money(n) {
    return '$' + Number(n).toFixed(0);
  }

  function slotLabel(iso) {
    var d = new Date(iso);
    var day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    var time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return day + ' · ' + time;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(message) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 400);
    }, 4200);
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  return {
    avatar: avatar, money: money, slotLabel: slotLabel,
    escapeHtml: escapeHtml, toast: toast, param: param,
  };
})();
