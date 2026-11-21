(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- mobile menu ---------- */

  var toggle = $('.nav__toggle');
  var menu = $('#menu');
  var menuLinks = menu ? $$('a', menu) : [];
  var pageMain = $('#main');
  var pageFooter = $('.closing');

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    menu.hidden = !open;

    if (pageMain) pageMain.inert = open;
    if (pageFooter) pageFooter.inert = open;

    if (open) {
      var first = $('.menu__links a', menu);
      if (first) first.focus();
    } else if (document.activeElement && menu.contains(document.activeElement)) {
      toggle.focus();
    }
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menuLinks.forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
      }
    });
  }

  /* ---------- scroll progress & nav state ---------- */

  var navBar = $('.nav');
  var progressBar = $('.progress span');
  var uiTick = false;

  function updateScrollUI() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var value = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    if (progressBar) progressBar.style.transform = 'scaleX(' + value.toFixed(4) + ')';
    if (navBar) navBar.classList.toggle('is-scrolled', y > 10);
  }

  function onUIScroll() {
    if (uiTick) return;
    uiTick = true;
    window.requestAnimationFrame(function () {
      uiTick = false;
      updateScrollUI();
    });
  }

  window.addEventListener('scroll', onUIScroll, { passive: true });
  window.addEventListener('resize', onUIScroll);
  updateScrollUI();

  /* ---------- scroll reveal ---------- */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var revealEls = $$([
    '.section__head',
    '.section__lead',
    '.signal',
    '.tool-frame',
    '.feature-list',
    '.use',
    '.steps',
    '.diagram',
    '.toolchain',
    '.scope-card',
    '.service-list',
    '.portrait',
    '.about__body',
    '.cred',
    '.close__head',
    '.close__lead',
    '.close__row'
  ].join(', '));

  if (revealEls.length) {
    document.documentElement.classList.add('m-anim');

    revealEls.forEach(function (el) {
      el.classList.add('is-reveal');

      var index = 0;
      var sibling = el.previousElementSibling;

      while (sibling) {
        if (sibling.classList && sibling.classList.contains('is-reveal')) index += 1;
        sibling = sibling.previousElementSibling;
      }

      if (index) el.style.setProperty('--rd', Math.min(index, 6) * 55 + 'ms');
    });

    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      var revealObserver = new IntersectionObserver(function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          row.target.classList.add('is-in');
          revealObserver.unobserve(row.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

      revealEls.forEach(function (el) { revealObserver.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* ---------- count-up ---------- */

  var counters = $$('[data-count]');

  function formatCount(value) {
    return Math.round(value).toLocaleString('en-US');
  }

  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;

    if (reduceMotion.matches) {
      el.textContent = formatCount(target);
      return;
    }

    var start = null;

    function step(now) {
      if (start === null) start = now;
      var progress = Math.min(1, (now - start) / 900);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCount(target * eased);
      if (progress < 1) window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
  }

  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var counterObserver = new IntersectionObserver(function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          counterObserver.unobserve(row.target);
          runCounter(row.target);
        });
      }, { threshold: 0.5 });

      counters.forEach(function (el) { counterObserver.observe(el); });
    } else {
      counters.forEach(runCounter);
    }
  }

  /* ---------- pointer tilt ---------- */

  var tiltEls = $$('[data-tilt]');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (tiltEls.length && finePointer.matches && !reduceMotion.matches) {
    tiltEls.forEach(function (el) {
      var rect = null;
      var tiltTick = 0;
      var targetX = 0;
      var targetY = 0;

      function apply() {
        tiltTick = 0;
        el.style.transform = 'perspective(1000px) rotateX(' + targetY.toFixed(2) + 'deg) rotateY(' + targetX.toFixed(2) + 'deg)';
      }

      function schedule() {
        if (!tiltTick) tiltTick = window.requestAnimationFrame(apply);
      }

      el.addEventListener('pointerenter', function () {
        rect = el.getBoundingClientRect();
        el.classList.add('is-tilting');
      });

      el.addEventListener('pointermove', function (event) {
        if (!rect) rect = el.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        targetX = x * 2.2;
        targetY = y * -1.6;
        schedule();
      }, { passive: true });

      el.addEventListener('pointerleave', function () {
        rect = null;
        targetX = 0;
        targetY = 0;
        el.classList.remove('is-tilting');
        schedule();
      });
    });
  }

  /* ---------- active section ---------- */

  var spyLinks = $$('.nav__links a[href^="#"], .menu__links a[href^="#"]');
  var spySections = [];

  spyLinks.forEach(function (link) {
    var section = document.getElementById(link.hash.slice(1));
    if (section && spySections.indexOf(section) === -1) spySections.push(section);
  });

  var spyTick = false;

  function updateActive() {
    spyTick = false;
    var marker = window.pageYOffset + window.innerHeight * 0.42;
    var active = null;

    spySections.forEach(function (section) {
      if (section.offsetTop <= marker && section.offsetTop + section.offsetHeight > marker) {
        active = section.id;
      }
    });

    spyLinks.forEach(function (link) {
      if (link.hash === '#' + active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function onSpyScroll() {
    if (spyTick) return;
    spyTick = true;
    window.requestAnimationFrame(updateActive);
  }

  if (spySections.length) {
    window.addEventListener('scroll', onSpyScroll, { passive: true });
    window.addEventListener('resize', onSpyScroll);
    updateActive();
  }

  /* ---------- copy email ---------- */

  var copyBtn = $('.copy');
  var copyStatus = $('#copy-status');
  var copyLabel = copyBtn && $('.copy__text', copyBtn);
  var copyIcon = copyBtn && $('use', copyBtn);
  var resetTimer = null;

  function fallbackCopy(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:absolute;left:-9999px;top:0;';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(field);
    return ok;
  }

  function copyDone(ok, address) {
    if (!ok) {
      if (copyStatus) copyStatus.textContent = 'Press Ctrl+C to copy.';
      return;
    }
    if (copyBtn) copyBtn.classList.add('is-done');
    if (copyIcon) copyIcon.setAttribute('href', '#i-check');
    if (copyLabel) copyLabel.textContent = 'Copied';
    if (copyStatus) copyStatus.textContent = address + ' copied to clipboard.';

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(function () {
      if (copyBtn) copyBtn.classList.remove('is-done');
      if (copyIcon) copyIcon.setAttribute('href', '#i-copy');
      if (copyLabel) copyLabel.textContent = 'Copy';
      if (copyStatus) copyStatus.textContent = '';
    }, 2200);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var address = copyBtn.getAttribute('data-copy') || '';
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(address).then(
          function () { copyDone(true, address); },
          function () { copyDone(fallbackCopy(address), address); }
        );
      } else {
        copyDone(fallbackCopy(address), address);
      }
    });
  }

  /* ---------- certificate dialog ---------- */

  var dialog = $('#cert-dialog');
  var certOpeners = $$('[data-cert-open]');
  var certClose = $('[data-cert-close]');
  var certImage = $('#cert-image');
  var certTitle = $('#cert-title');
  var certMeta = $('#cert-meta');
  var certVerify = $('#cert-verify');
  var lastCertTrigger = null;

  function openCert(trigger) {
    if (!dialog) return;
    lastCertTrigger = trigger;

    var title = trigger.getAttribute('data-title') || 'Credential';
    var meta = trigger.getAttribute('data-meta') || '';
    var verify = trigger.getAttribute('data-verify') || '';
    var image = $('img', trigger);

    if (certTitle) certTitle.textContent = title;
    if (certMeta) certMeta.textContent = meta;
    if (certImage && image) {
      certImage.setAttribute('src', image.currentSrc || image.src);
      certImage.setAttribute('alt', title);
    }
    if (certVerify) {
      if (verify) {
        certVerify.hidden = false;
        certVerify.setAttribute('href', verify);
      } else {
        certVerify.hidden = true;
      }
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      document.body.classList.add('menu-open');
    } else if (verify) {
      window.open(verify, '_blank', 'noopener');
    }
  }

  function closeCert() {
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  certOpeners.forEach(function (trigger) {
    trigger.addEventListener('click', function () { openCert(trigger); });
  });

  if (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeCert();
    });

    dialog.addEventListener('close', function () {
      document.body.classList.remove('menu-open');
      if (lastCertTrigger) lastCertTrigger.focus();
    });

    if (certClose) {
      certClose.addEventListener('click', closeCert);
    }
  }

  /* ---------- year ---------- */

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
