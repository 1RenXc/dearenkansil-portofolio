(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var revealables = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { observer.observe(el); });

    function flushViewport() {
      revealables.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
          el.classList.add('is-in');
          observer.unobserve(el);
        }
      });
    }

    window.addEventListener('scroll', flushViewport, { passive: true });
    window.addEventListener('load', function () {
      flushViewport();
      setTimeout(flushViewport, 1500);
    });
  }

  var navLinks = $$('.nav__links a[href^="#"]');
  var sections = navLinks
    .map(function (link) { return $(link.hash); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var visible = new Map();

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
        else visible.delete(entry.target.id);
      });

      var activeId = null;
      var best = 0;
      visible.forEach(function (ratio, id) {
        if (ratio > best) { best = ratio; activeId = id; }
      });

      navLinks.forEach(function (link) {
        if (link.hash === '#' + activeId) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] });

    sections.forEach(function (section) { spy.observe(section); });
  }

  var progress = $('.progress');
  var bar = $('#progress-bar');
  var toTop = $('#to-top');
  var ticking = false;

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;

    if (bar) bar.style.transform = 'scaleX(' + ratio + ')';
    if (progress) progress.classList.toggle('is-on', ratio > 0.01);

    if (toTop) {
      var show = window.pageYOffset > window.innerHeight * 0.7;
      if (show === toTop.hidden) {
        toTop.hidden = !show;
        requestAnimationFrame(function () { toTop.classList.toggle('is-on', show); });
      }
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  var filterBox = $('#filters');
  var chipBox = $('#filters-chips');
  var filterStatus = $('#filter-status');
  var projects = $$('.project');
  var emptyState = $('#projects-empty');
  var moreBox = $('#projects-more-box');
  var moreBtn = $('#projects-more');
  var moreLabel = $('#projects-more-label');
  var moreStatus = $('#projects-more-status');
  var PREVIEW = 3;
  var activeTag = '*';
  var expanded = false;

  if (projects.length) {
    var counts = Object.create(null);
    projects.forEach(function (project) {
      $$('.tags li', project).forEach(function (tag) {
        var name = tag.textContent.trim();
        counts[name] = (counts[name] || 0) + 1;
      });
    });

    var tags = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    });

    function makeChip(label, value) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.tag = value;

      var text = document.createElement('span');
      text.textContent = label;
      btn.appendChild(text);

      var n = document.createElement('span');
      n.className = 'chip__n';
      n.textContent = value === '*' ? String(projects.length) : String(counts[value]);
      btn.appendChild(n);

      return btn;
    }

    function matches(project) {
      return activeTag === '*' ||
        $$('.tags li', project).some(function (t) {
          return t.textContent.trim() === activeTag;
        });
    }

    function render(reveal) {
      var shown = 0;
      var hidden = 0;

      projects.forEach(function (project) {
        var match = matches(project);

        if (match && (expanded || shown < PREVIEW)) {
          project.classList.remove('is-filtered', 'is-collapsed');
          if (reveal) project.classList.add('is-in');
          shown++;
        } else {
          project.classList.add(match ? 'is-collapsed' : 'is-filtered');
          if (match) hidden++;
        }
      });

      if (emptyState) emptyState.hidden = shown !== 0;

      if (moreBox) {
        var showToggle = hidden > 0 || expanded;
        moreBox.hidden = !showToggle;
        if (showToggle) {
          moreBtn.setAttribute('aria-expanded', String(expanded));
          moreLabel.textContent = expanded
            ? 'Show fewer'
            : 'Show ' + hidden + ' more';
        }
      }

      if (filterStatus) {
        filterStatus.textContent = shown + ' of ' + projects.length +
          (activeTag === '*' ? ' projects' : ' projects tagged ' + activeTag) + ' shown.';
      }
      if (moreStatus && moreBtn && !moreBox.hidden) {
        moreStatus.textContent = expanded
          ? 'All matching projects shown.'
          : hidden + ' more project' + (hidden === 1 ? '' : 's') + ' hidden.';
      }
    }

    if (filterBox && chipBox) {
      chipBox.appendChild(makeChip('All', '*'));
      tags.forEach(function (tag) { chipBox.appendChild(makeChip(tag, tag)); });

      chipBox.addEventListener('click', function (event) {
        var chip = event.target.closest('.chip');
        if (!chip) return;
        activeTag = chip.dataset.tag;

        $$('.chip', chipBox).forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });

        render(false);
      });

      filterBox.hidden = false;
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        expanded = !expanded;
        render(true);
      });
    }

    render(false);
  }

  var copyBtn = $('#copy-btn');
  var copyStatus = $('#copy-status');
  var copyText = copyBtn && $('.copy__text', copyBtn);

  function copyViaFallback(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:absolute;left:-9999px;';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(field);
    return ok;
  }

  if (copyBtn) {
    var resetTimer = null;

    copyBtn.addEventListener('click', function () {
      var address = copyBtn.dataset.copy;
      var done = function (ok) {
        if (!ok) {
          if (copyStatus) copyStatus.textContent = 'Press Ctrl+C to copy.';
          return;
        }
        copyBtn.classList.add('is-done');
        $('use', copyBtn).setAttribute('href', '#i-check');
        if (copyText) copyText.textContent = 'Copied';
        if (copyStatus) copyStatus.textContent = address + ' copied to clipboard.';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          copyBtn.classList.remove('is-done');
          $('use', copyBtn).setAttribute('href', '#i-copy');
          if (copyText) copyText.textContent = 'Copy';
          if (copyStatus) copyStatus.textContent = '';
        }, 2000);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(address).then(function () { done(true); }, function () {
          done(copyViaFallback(address));
        });
      } else {
        done(copyViaFallback(address));
      }
    });
  }
})();
