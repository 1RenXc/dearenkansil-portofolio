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
  var pager = $('#projects-nav');
  var prevBtn = $('#projects-prev');
  var nextBtn = $('#projects-next');
  var pageIndex = $('#projects-index');
  var pageTotal = $('#projects-total');
  var pageStatus = $('#projects-page-status');
  var PER_PAGE = 3;
  var activeTag = '*';
  var page = 0;

  if (projects.length) {
    var counts = Object.create(null);

    var projectTags = projects.map(function (project) {
      return $$('.tags li', project).map(function (tag) {
        return tag.textContent.trim();
      }).filter(function (name) {
        return name !== '';
      });
    });

    projectTags.forEach(function (names) {
      names.forEach(function (name) {
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

    function isMatch(index) {
      return activeTag === '*' || projectTags[index].indexOf(activeTag) !== -1;
    }

    var list = $('.projects');
    var resizeTimer = null;

    function measureCard() {
      if (!list) return;

      var restore = [];
      var tallest = 0;
      var i;

      list.classList.add('is-measuring');

      for (i = 0; i < projects.length; i++) {
        if (projects[i].hidden) {
          restore.push(projects[i]);
          projects[i].hidden = false;
        }
        tallest = Math.max(tallest, projects[i].offsetHeight);
      }

      restore.forEach(function (project) { project.hidden = true; });
      list.classList.remove('is-measuring');

      if (tallest) {
        list.style.setProperty('--project-card-h', tallest + 'px');
        list.style.setProperty('--project-page-h', tallest * PER_PAGE + 'px');
      }
    }

    function showPage(target) {
      var matched = [];
      var i;

      for (i = 0; i < projects.length; i++) {
        if (isMatch(i)) matched.push(i);
      }

      var pages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
      page = ((target % pages) + pages) % pages;

      var canPaginate = !!pager && !!prevBtn && !!nextBtn;

      projects.forEach(function (project, index) {
        var slot = matched.indexOf(index);
        var onPage = !canPaginate ||
          (slot !== -1 &&
            slot >= page * PER_PAGE &&
            slot < (page + 1) * PER_PAGE);

        project.hidden = !onPage;
        if (onPage) project.classList.add('is-in');
      });

      if (emptyState) emptyState.hidden = matched.length !== 0;

      if (pager) pager.hidden = pages < 2;
      if (pageIndex) pageIndex.textContent = String(page + 1);
      if (pageTotal) pageTotal.textContent = String(pages);

      if (filterStatus) {
        filterStatus.textContent = matched.length + ' of ' + projects.length +
          (activeTag === '*' ? ' projects' : ' projects tagged ' + activeTag) +
          (matched.length > PER_PAGE ? ', page ' + (page + 1) + ' of ' + pages + '.' : '.');
      }
      if (pageStatus) {
        pageStatus.textContent = 'Page ' + (page + 1) + ' of ' + pages + '.';
      }
    }

    if (filterBox && chipBox) {
      chipBox.appendChild(makeChip('All', '*'));
      tags.forEach(function (tag) { chipBox.appendChild(makeChip(tag, tag)); });

      chipBox.addEventListener('click', function (event) {
        var chip = event.target.closest('.chip');
        if (!chip) return;

        var next = chip.dataset.tag;
        var isActive = chip.getAttribute('aria-pressed') === 'true';
        activeTag = isActive ? '*' : next;

        var all = chipBox.querySelector('.chip[data-tag="*"]');
        var pressed = activeTag === '*' ? all : chip;

        $$('.chip', chipBox).forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === pressed));
        });

        showPage(0);
      });

      filterBox.hidden = false;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        showPage(page - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        showPage(page + 1);
      });
    }

    showPage(0);
    measureCard();

    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measureCard, 150);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureCard);
    }
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

  var certTrack = $('#certs-track');
  var certItems = $$('[data-certs-item]', certTrack);
  var certNav = $('#certs-nav');
  var certPrev = $('#certs-prev');
  var certNext = $('#certs-next');
  var certIndex = $('#certs-index');
  var certTotal = $('#certs-total');
  var certStatus = $('#certs-status');

  var lightbox = $('#certs-lightbox');
  var lbImg = $('#lightbox-img');
  var lbTitle = $('#lightbox-title');
  var lbSub = $('#lightbox-sub');
  var lbIndex = $('#lightbox-index');
  var lbTotal = $('#lightbox-total');
  var lbPrev = $('#lightbox-prev');
  var lbNext = $('#lightbox-next');
  var lbVerify = $('#lightbox-verify');

  if (certTrack && certItems.length) {
    var PER_CERT_PAGE = 2;
    var certPages = Math.ceil(certItems.length / PER_CERT_PAGE);
    var certPage = 0;
    var lbIndexAt = 0;

    function showCertPage(next) {
      certPage = (next + certPages) % certPages;

      certItems.forEach(function (item, i) {
        item.hidden = i < certPage * PER_CERT_PAGE || i >= (certPage + 1) * PER_CERT_PAGE;
      });

      if (certIndex) certIndex.textContent = String(certPage + 1);
      if (certTotal) certTotal.textContent = String(certPages);
      if (certNav) certNav.hidden = certPages < 2;
      if (certStatus) certStatus.textContent = 'Showing certificate ' + (certPage + 1) + ' of ' + certPages + '.';
    }

    function fillLightbox(index) {
      var item = certItems[index];
      if (!item) return;

      var card = $('[data-certs-open]', item);
      var img = $('.certs__img', item);
      var title = (card && card.dataset.title) || '';
      var sub = (card && card.dataset.sub) || '';
      var credId = (card && card.dataset.id) || '';
      var verify = (card && card.dataset.verify) || '';
      var src = img ? (img.currentSrc || img.getAttribute('src')) : '';

      if (credId && credId !== '—') sub += (sub ? ' \u00b7 ' : '') + 'ID ' + credId;

      if (lbImg && src) {
        lbImg.setAttribute('src', src);
        lbImg.alt = title;
      }
      if (lbTitle) lbTitle.textContent = title;
      if (lbSub) lbSub.textContent = sub;
      if (lbVerify) {
        if (verify) {
          lbVerify.hidden = false;
          lbVerify.setAttribute('href', verify);
        } else {
          lbVerify.hidden = true;
        }
      }
      if (lbIndex) lbIndex.textContent = String(index + 1);
      if (lbTotal) lbTotal.textContent = String(certItems.length);
      if (lbPrev) lbPrev.hidden = certItems.length < 2;
      if (lbNext) lbNext.hidden = certItems.length < 2;
    }

    function openLightbox(index) {
      lbIndexAt = index;
      fillLightbox(index);

      if (!lightbox || typeof lightbox.showModal !== 'function') {
        var card = $('[data-certs-open]', certItems[index]);
        var img = card && $('.certs__img', card);
        if (img) window.open(img.currentSrc || img.src, '_blank', 'noopener');
        return;
      }

      lightbox.showModal();
      document.body.classList.add('is-locked');
    }

    function closeLightbox() {
      if (lightbox && lightbox.open) lightbox.close();
      document.body.classList.remove('is-locked');
    }

    function stepLightbox(delta) {
      lbIndexAt = (lbIndexAt + delta + certItems.length) % certItems.length;
      fillLightbox(lbIndexAt);
    }

    if (certPrev) certPrev.addEventListener('click', function () { showCertPage(certPage - 1); });
    if (certNext) certNext.addEventListener('click', function () { showCertPage(certPage + 1); });

    certTrack.addEventListener('click', function (event) {
      var card = event.target.closest('[data-certs-open]');
      if (!card) return;
      var index = certItems.indexOf(card.closest('[data-certs-item]'));
      if (index > -1) openLightbox(index);
    });

    if (lightbox) {
      lightbox.addEventListener('close', function () {
        document.body.classList.remove('is-locked');
      });

      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox || event.target.closest('[data-lb-close]')) {
          closeLightbox();
          return;
        }
        if (event.target.closest('#lightbox-prev')) { stepLightbox(-1); return; }
        if (event.target.closest('#lightbox-next')) { stepLightbox(1); }
      });

      lightbox.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); stepLightbox(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); stepLightbox(1); }
      });
    }

    showCertPage(0);
  }
})();
