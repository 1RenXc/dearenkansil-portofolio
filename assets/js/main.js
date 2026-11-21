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
    '.project',
    '.tool-frame',
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

  /* ---------- clipboard ---------- */

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

  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(fallbackCopy(text)); }
      );
    } else {
      done(fallbackCopy(text));
    }
  }

  var copyBtn = $('.copy');
  var copyStatus = $('#copy-status');
  var copyLabel = copyBtn && $('.copy__text', copyBtn);
  var copyIcon = copyBtn && $('use', copyBtn);

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
      copyText(address, function (ok) { copyDone(ok, address); });
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

  /* ---------- sheet dialogs ---------- */

  function sheetDialog(dialog) {
    if (!dialog || typeof dialog.showModal !== 'function') return null;

    var opener = null;

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', function () {
      document.body.classList.remove('menu-open');
      if (opener) {
        var target = opener;
        opener = null;
        target.focus();
      }
    });

    var closer = $('[data-sheet-close]', dialog);
    if (closer) closer.addEventListener('click', function () { dialog.close(); });

    return function open(trigger) {
      opener = trigger || null;
      dialog.showModal();
      document.body.classList.add('menu-open');
    };
  }

  var openContact = sheetDialog($('#contact-dialog'));
  var openProject = sheetDialog($('#project-dialog'));

  if (openContact) {
    $$('[data-contact-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        openContact(trigger);
      });
    });
  }

  var contactCopy = $('[data-contact-copy]');
  var contactCopyText = $('[data-contact-copy-text]');
  var contactStatus = $('#contact-status');
  var contactReset = null;

  if (contactCopy) {
    contactCopy.addEventListener('click', function () {
      var address = 'dearenkansil@gmail.com';
      copyText(address, function (ok) {
        if (!ok) {
          if (contactStatus) contactStatus.textContent = 'Press Ctrl+C to copy the address.';
          return;
        }
        if (contactCopyText) contactCopyText.textContent = 'Copied';
        if (contactStatus) contactStatus.textContent = address + ' copied to clipboard.';
        window.clearTimeout(contactReset);
        contactReset = window.setTimeout(function () {
          if (contactCopyText) contactCopyText.textContent = 'Copy address';
          if (contactStatus) contactStatus.textContent = '';
        }, 2200);
      });
    });
  }

  if (openProject) {
    $$('[data-project-details]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var slide = trigger.closest('[data-work-slide]');
        var detail = slide && $('.project__detail', slide);
        var name = slide && $('.project__name', slide);
        var body = $('[data-project-dialog-body]');
        var title = $('#project-dialog-title');

        if (title) title.textContent = name ? name.textContent : 'Project';

        if (body) {
          body.innerHTML = '';
          if (detail) {
            var clone = detail.cloneNode(true);
            clone.hidden = false;
            clone.removeAttribute('hidden');
            body.appendChild(clone);
          }
        }

        openProject(trigger);
      });
    });
  }

  /* ---------- selected work rail ---------- */

  var rail = $('[data-work-rail]');

  if (rail) {
    var slides = $$('[data-work-slide]', rail);
    var prevBtn = $('[data-work-prev]');
    var nextBtn = $('[data-work-next]');
    var currentEl = $('[data-work-current]');
    var totalEl = $('[data-work-total]');
    var total = slides.length;
    var index = 0;

    function pad(value) { return value < 10 ? '0' + value : String(value); }

    function renderRail() {
      if (currentEl) currentEl.textContent = pad(index + 1);
      if (totalEl) totalEl.textContent = pad(total);
      if (prevBtn) {
        prevBtn.hidden = total < 2;
        prevBtn.disabled = index <= 0;
      }
      if (nextBtn) {
        nextBtn.hidden = total < 2;
        nextBtn.disabled = index >= total - 1;
      }
    }

    function slideLeft(i) {
      return slides[i].offsetLeft - slides[0].offsetLeft;
    }

    function goTo(i) {
      if (!slides.length) return;
      index = Math.max(0, Math.min(total - 1, i));
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rail.scrollTo({ left: slideLeft(index), behavior: calm ? 'auto' : 'smooth' });
      renderRail();
    }

    var railTick = false;

    rail.addEventListener('scroll', function () {
      if (railTick) return;
      railTick = true;
      window.requestAnimationFrame(function () {
        railTick = false;
        var best = 0;
        var bestDistance = Infinity;

        slides.forEach(function (slide, i) {
          var distance = Math.abs(slideLeft(i) - rail.scrollLeft);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        });

        if (best !== index) {
          index = best;
          renderRail();
        }
      });
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1); });

    rail.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(total - 1);
      }
    });

    window.addEventListener('resize', function () {
      rail.scrollLeft = slideLeft(index);
    });

    slides.forEach(function (slide, i) {
      slide.setAttribute('aria-label', (i + 1) + ' of ' + total);
    });

    renderRail();
  }

  /* ---------- year ---------- */

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
