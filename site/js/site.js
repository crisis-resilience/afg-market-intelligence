// Behaviour shared by every page: the phone menu, the home page's see-through
// header, and highlighting the menu item for the section in view. The pages
// work without this file; it only adds polish.
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  if (!header) return;

  // ── Phone menu ─────────────────────────────────────────────────────────────
  var toggle = header.querySelector('.nav-toggle');
  function setOpen(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-open'));
    });
    header.querySelectorAll('.site-nav a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ── "Our Services" dropdown: click to open/close; on wide screens hovering
  // also opens it (CSS). Escape or a click elsewhere closes it.
  header.querySelectorAll('.site-nav__has-sub').forEach(function (item) {
    var button = item.querySelector('.site-nav__sub-toggle');
    function setSub(open) {
      item.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    }
    button.addEventListener('click', function () { setSub(!item.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (!item.contains(e.target)) setSub(false); });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && item.classList.contains('is-open')) {
        e.stopPropagation();
        setSub(false);
        button.focus();
      }
    });
  });

  if (!('IntersectionObserver' in window)) return;

  // ── See-through header over the hero photo, solid once it scrolls away ────
  var overlayUntil = header.getAttribute('data-overlay-until');
  var hero = overlayUntil && document.querySelector(overlayUntil);
  if (hero) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-solid', !entries[0].isIntersecting);
    }, { rootMargin: '-' + header.offsetHeight + 'px 0px 0px 0px' }).observe(hero);
  }

  // ── Menu highlight follows the section in the middle of the screen ────────
  // Links with data-section-link="#id" take turns being current; when none of
  // their sections is in view, the first one (Home) is current.
  var sectionLinks = Array.prototype.slice.call(header.querySelectorAll('[data-section-link]'));
  if (sectionLinks.length > 1) {
    var visible = {};
    var update = function () {
      var current = sectionLinks[0];
      sectionLinks.forEach(function (link) {
        if (visible[link.getAttribute('data-section-link')]) current = link;
      });
      sectionLinks.forEach(function (link) {
        var on = link === current;
        link.classList.toggle('is-current', on);
        if (on) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible['#' + entry.target.id] = entry.isIntersecting;
      });
      update();
    }, { rootMargin: '-50% 0px -50% 0px' });
    sectionLinks.forEach(function (link) {
      var target = document.querySelector(link.getAttribute('data-section-link'));
      if (target) io.observe(target);
    });
  }
})();

// ── Back to top ──────────────────────────────────────────────────────────────
// A round button in the bottom corner that appears once the reader has
// scrolled down a screen. Built here so every page gets it without HTML edits.
(function () {
  'use strict';

  var labels = { fa: 'بازگشت به بالا', ps: 'بېرته پورته' };
  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var label = labels[lang] || 'Back to top';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(btn);

  function update() {
    btn.classList.toggle('is-visible', window.scrollY > window.innerHeight);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();

  btn.addEventListener('click', function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
