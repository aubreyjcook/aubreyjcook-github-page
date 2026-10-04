(function () {
  var btn = document.getElementById('nav-toggle');
  var panel = document.getElementById('mobile-nav');
  if (!btn || !panel) return;

  btn.addEventListener('click', function () {
    var hidden = panel.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(!hidden));
  });
})();
