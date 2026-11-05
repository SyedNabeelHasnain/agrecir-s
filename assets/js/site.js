(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const main = $('#main');

  if (location.protocol === 'file:') {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const h = a.getAttribute('href');
      if (h && !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.endsWith('.html') && !h.endsWith('.pdf')) {
        e.preventDefault();
        const base = h.split('?')[0].split('#')[0];
        const q = h.includes('?') ? '?' + h.split('?')[1].split('#')[0] : '';
        const hash = h.includes('#') ? '#' + h.split('#')[1] : '';
        location.href = (base.endsWith('/') ? base + 'index.html' : base + '/index.html') + q + hash;
      }
    });
  }

  const toastEl = $('.toast');
  let toastTimer;
  const toast = msg => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  };

  class Hero {
    constructor(el) {
      this.el = el;
      this.slides = $$('.hs', el);
      this.segs = $$('.segs .seg', el);
      this.cap = $('.hero-cap span', el);
      this.count = $('.hero-count b', el);
      this.btn = $('.hero-pause', el);
      this.ctrl = $('.hero-ctrl', el);
      this.i = 0;
      this.timer = null;
      this.isPaused = reduce.matches;
      this.isHeld = false;
      if (this.slides.length < 2) return;
      if (this.isPaused) el.classList.add('is-paused');

      this.segs.forEach((s, n) => {
        s.addEventListener('click', () => {
          this.go(n);
          this.schedule();
        });
      });

      if (this.btn) {
        this.btn.addEventListener('click', () => {
          this.isPaused = !this.isPaused;
          el.classList.toggle('is-paused', this.isPaused);
          this.btn.setAttribute('aria-label', this.isPaused ? 'Play slideshow' : 'Pause slideshow');
          if (this.isPaused) {
            clearTimeout(this.timer);
          } else {
            this.schedule();
          }
        });
      }

      if (this.ctrl) {
        this.ctrl.addEventListener('pointerenter', () => {
          this.isHeld = true;
          el.classList.add('is-held');
          clearTimeout(this.timer);
        });
        this.ctrl.addEventListener('pointerleave', () => {
          this.isHeld = false;
          el.classList.remove('is-held');
          this.schedule();
        });
        this.ctrl.addEventListener('focusin', () => {
          this.isHeld = true;
          el.classList.add('is-held');
          clearTimeout(this.timer);
        });
        this.ctrl.addEventListener('focusout', () => {
          this.isHeld = false;
          el.classList.remove('is-held');
          this.schedule();
        });
      }

      this.warm(1);
      this.schedule();
    }
    warm(n) {
      const img = $('img', this.slides[(n + this.slides.length) % this.slides.length]);
      if (img && img.loading === 'lazy') img.loading = 'eager';
    }
    schedule() {
      clearTimeout(this.timer);
      if (this.isPaused || this.isHeld || reduce.matches) return;
      this.timer = setTimeout(() => {
        this.go(this.i + 1);
        this.schedule();
      }, 7000);
    }
    go(n) {
      const len = this.slides.length;
      this.i = (n + len) % len;
      this.slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === this.i);
        if (k === this.i) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
      this.segs.forEach((s, k) => {
        s.classList.remove('is-active');
        s.classList.toggle('is-done', k < this.i);
      });
      const seg = this.segs[this.i];
      if (seg) {
        void seg.offsetWidth;
        seg.classList.add('is-active');
      }
      if (this.cap) this.cap.textContent = this.slides[this.i].dataset.cap || '';
      if (this.count) this.count.textContent = String(this.i + 1).padStart(2, '0');
      this.warm(this.i + 1);
    }
  }
  const heroEl = $('.hero');
  if (heroEl) new Hero(heroEl);

  if ('IntersectionObserver' in window && !reduce.matches) {
    const rvObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.05
    });
    $$('.rv').forEach(el => rvObserver.observe(el));
  } else {
    $$('.rv').forEach(el => el.classList.add('is-in'));
  }


  const fmt = new Intl.NumberFormat('en-GB');
  if ('IntersectionObserver' in window && !reduce.matches) {
    const counter = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      counter.unobserve(e.target);
      const el = e.target, to = +el.dataset.to, t0 = performance.now(), dur = 1400;
      let lastVal = -1;
      const tick = t => {
        const p = Math.min(1, (t - t0) / dur);
        const val = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (val !== lastVal) {
          lastVal = val;
          el.textContent = fmt.format(val);
        }
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = fmt.format(to);
        }
      };
      requestAnimationFrame(tick);
    }), { threshold: .15 });
    $$('.count').forEach(el => counter.observe(el));
  }

  const toc = $('.toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = new Map($$('a[href^="#"]', toc).map(a => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-current'));
      const a = links.get(e.target.id);
      if (a) a.classList.add('is-current');
    }), { rootMargin: '-20% 0px -70% 0px' });
    $$('.lsec h2[id]').forEach(h => spy.observe(h));
  }

  function transition(update) {
    if (!document.startViewTransition || reduce.matches) { update(); return null; }
    let done = false;
    const run = () => { if (!done) { done = true; update(); } };
    const t = document.startViewTransition(run);
    [t.ready, t.finished, t.updateCallbackDone].forEach(p => p.catch(() => {}));
    setTimeout(run, 350);
    return t;
  }

  document.addEventListener('click', e => {
    const skip = e.target.closest('.skip');
    if (skip && main) {
      e.preventDefault();
      const hero = $('.hero', main);
      const next = hero && hero.nextElementSibling ? hero.nextElementSibling : main;
      next.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
      main.focus({ preventScroll: true });
      return;
    }
    const topBtn = e.target.closest('[data-top]');
    if (topBtn) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
      return;
    }
    const hashLink = e.target.closest('a[href^="#"]:not([href="#"])');
    if (hashLink) {
      const id = hashLink.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        history.replaceState(null, '', '#' + id);
      }
    }
  });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      root.classList.toggle('is-scrolled', scrollY > 24);
      root.classList.toggle('is-deep', scrollY > 700);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('.burger'), head = $('[data-head]');
  function closeMenus(except) {
    $$('.nav-btn[aria-expanded="true"]').forEach(b => {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      const panel = $('#' + b.getAttribute('aria-controls'));
      if (panel) panel.classList.remove('is-open');
    });
    if (!except) {
      root.classList.remove('head-solid');
      document.body.classList.remove('menu-open');
      root.classList.remove('menu-open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
    }
  }
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') === 'true';
    closeMenus(b);
    b.setAttribute('aria-expanded', String(!open));
    const panel = $('#' + b.getAttribute('aria-controls'));
    if (panel) panel.classList.toggle('is-open', !open);
    if (!root.classList.contains('menu-open')) root.classList.toggle('head-solid', !open);
  }));

  const desktopMedia = matchMedia('(min-width: 1101px)');
  let navHoverTimer = null;
  $$('.has-mega').forEach(li => {
    const btn = $('.nav-btn', li);
    const panel = $('.mega', li);
    if (!btn || !panel) return;

    li.addEventListener('pointerenter', e => {
      if (!desktopMedia.matches || e.pointerType !== 'mouse') return;
      clearTimeout(navHoverTimer);
      navHoverTimer = setTimeout(() => {
        closeMenus(btn);
        btn.setAttribute('aria-expanded', 'true');
        panel.classList.add('is-open');
        root.classList.add('head-solid');
      }, 100);
    });

    li.addEventListener('pointerleave', e => {
      if (!desktopMedia.matches || e.pointerType !== 'mouse') return;
      clearTimeout(navHoverTimer);
      navHoverTimer = setTimeout(() => {
        btn.setAttribute('aria-expanded', 'false');
        panel.classList.remove('is-open');
        if (!$$('.nav-btn[aria-expanded="true"]').length) {
          root.classList.remove('head-solid');
        }
      }, 140);
    });
  });
  if (burger && head) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      if (open) { closeMenus(); return; }
      burger.setAttribute('aria-expanded', 'true');
      root.classList.add('menu-open');
      document.body.classList.add('menu-open');
    });
  }
  addEventListener('resize', () => {
    if (innerWidth > 1100 && root.classList.contains('menu-open')) closeMenus();
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openBtn = $('.nav-btn[aria-expanded="true"]');
    if (openBtn || root.classList.contains('menu-open')) {
      closeMenus();
      if (openBtn) openBtn.focus(); else if (burger) burger.focus();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('[data-head]')) closeMenus(); });

  $$('.panels').forEach(group => {
    const panels = $$('.panel', group);
    const on = p => panels.forEach(x => x.classList.toggle('is-on', x === p));
    panels.forEach(p => {
      p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') on(p); });
      p.addEventListener('focusin', () => on(p));
      p.addEventListener('click', () => on(p));
    });
  });

  $$('[data-rail]').forEach(rail => {
    const track = $('.rail-track', rail), [prev, next] = $$('.rail-btn', rail);
    if (!track || !prev || !next) return;
    const update = () => {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    $$('.rail-btn', rail).forEach(b => b.addEventListener('click', () => {
      const card = track.firstElementChild;
      if (!card) return;
      track.scrollBy({ left: (+b.dataset.dir) * (card.getBoundingClientRect().width + 18), behavior: reduce.matches ? 'auto' : 'smooth' });
    }));
    track.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(track);
  });

  $$('.filters').forEach(group => {
    const grid = group.nextElementSibling;
    if (!grid) return;
    group.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      const apply = () => {
        $$('.chip', group).forEach(c => c.setAttribute('aria-pressed', String(c === b)));
        const f = b.dataset.filter;
        $$('.pcard', grid).forEach(c => { c.hidden = !(f === 'All' || c.dataset.cat.split('|').includes(f)); });
      };
      root.classList.add('vt-filter');
      const t = transition(apply);
      if (t) t.finished.catch(() => {}).finally(() => root.classList.remove('vt-filter')); else root.classList.remove('vt-filter');
    });
  });

  const lb = $('.lightbox');
  if (lb && main) {
    const lbImg = $('img', lb), lbCap = $('figcaption', lb), lbCount = $('.lb-count', lb);
    let lbList = [], lbI = 0, lbFrom = null;
    const lbShow = i => {
      lbI = (i + lbList.length) % lbList.length;
      const z = lbList[lbI];
      lbImg.src = z.dataset.full;
      lbImg.alt = $('img', z).alt;
      lbCap.textContent = z.dataset.cap;
      lbCount.textContent = `${lbI + 1} / ${lbList.length}`;
      $$('.lb-prev, .lb-next', lb).forEach(x => { x.hidden = lbList.length < 2; });
    };
    document.addEventListener('click', e => {
      const z = e.target.closest('.zoom');
      if (!z || !main.contains(z)) return;
      lbList = $$('.zoom', main);
      lbFrom = z;
      lbShow(lbList.indexOf(z));
      lb.showModal();
    });
    $('.lb-close', lb).addEventListener('click', () => lb.close());
    $('.lb-prev', lb).addEventListener('click', () => lbShow(lbI - 1));
    $('.lb-next', lb).addEventListener('click', () => lbShow(lbI + 1));
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' && lbList.length > 1) lbShow(lbI - 1);
      if (e.key === 'ArrowRight' && lbList.length > 1) lbShow(lbI + 1);
    });
    lb.addEventListener('close', () => { if (lbFrom) lbFrom.focus(); });
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      lb.addEventListener('click', e => {
        if (e.target !== lb) return;
        const r = lb.getBoundingClientRect();
        if (r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right) return;
        lb.close();
      });
    }
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch {
      const t = document.createElement('textarea');
      t.value = b.dataset.copy;
      document.body.append(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    b.classList.add('is-done');
    const sp = $('span', b);
    if (sp) sp.textContent = 'Copied';
    toast('Copied to clipboard');
    setTimeout(() => { b.classList.remove('is-done'); if (sp) sp.textContent = 'Copy'; }, 1800);
  });

  $$('[data-faq-search]').forEach(input => {
    const scope = input.closest('.container');
    const empty = $('.faq-empty', scope);
    const allDetails = $$('.acc', scope);
    allDetails.forEach(d => { d.dataset.accName = d.getAttribute('name') || ''; });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      $$('[data-faq]', scope).forEach(g => {
        let n = 0;
        $$('.acc', g).forEach(d => {
          const hit = !q || d.textContent.toLowerCase().includes(q);
          d.hidden = !hit;
          if (q) {
            d.removeAttribute('name');
            if (hit && q.length >= 2) d.open = true;
          } else {
            d.open = false;
            if (d.dataset.accName) d.setAttribute('name', d.dataset.accName);
          }
          if (hit) n++;
        });
        g.hidden = n === 0;
        shown += n;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });

  $$('[data-site-search]').forEach(input => {
    const idxEl = $('#site-index');
    const out = $('#site-results');
    if (!idxEl || !out) return;
    let items = [];
    try { items = JSON.parse(idxEl.textContent); } catch { items = []; }
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { out.replaceChildren(); out.hidden = true; return; }
      const words = q.split(/\s+/).filter(Boolean);
      const matches = items.filter(it => {
        const hay = (it.t + ' ' + it.s + ' ' + it.d + ' ' + it.u).toLowerCase();
        return words.every(w => hay.includes(w));
      }).slice(0, 8);
      out.hidden = false;
      if (!matches.length) {
        const li = document.createElement('li');
        li.className = 'feat feat--plain';
        const sp = document.createElement('span');
        sp.textContent = 'No matching pages found. Try searching for cotton, certification, traceability, projects or contact.';
        li.append(sp);
        out.replaceChildren(li);
        return;
      }
      out.replaceChildren(...matches.map(it => {
        const li = document.createElement('li');
        li.className = 'feat feat--link';
        const a = document.createElement('a');
        a.href = it.u;
        const wrap = document.createElement('span');
        const st = document.createElement('strong');
        st.textContent = it.t;
        const bd = document.createElement('span');
        bd.className = 'feat-body';
        bd.textContent = it.d;
        wrap.append(st, bd);
        a.append(wrap);
        li.append(a);
        return li;
      }));
    });
  });

  $$('.cform').forEach(form => {
    const [eName, eEmail, eMsg, eSrv] = JSON.parse(form.dataset.errors);
    const status = $('.fstatus', form);
    const submitBtn = $('button[type="submit"]', form);
    const submitLbl = submitBtn ? $('span', submitBtn) : null;
    const tsInput = $('input[name="ts"]', form);
    if (tsInput) tsInput.value = String(Date.now());

    const qs = new URLSearchParams(location.search);
    if (qs.get('sent') === '1' && status) {
      status.classList.remove('fstatus--err');
      status.textContent = form.dataset.success;
    } else if (qs.get('error') === '1' && status) {
      status.classList.add('fstatus--err');
      status.textContent = eSrv;
    }

    const checks = [
      ['#f-name', '#e-name', v => v.trim().length > 0, eName],
      ['#f-email', '#e-email', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), eEmail],
      ['#f-msg', '#e-msg', v => v.trim().length > 0, eMsg],
    ];
    checks.forEach(([f, er, ok]) => {
      const input = $(f, form), out = $(er, form);
      if (!input || !out) return;
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true' && ok(input.value)) {
          input.setAttribute('aria-invalid', 'false');
          out.textContent = '';
        }
      });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      let firstBad = null;
      for (const [f, er, ok, msg] of checks) {
        const input = $(f, form), out = $(er, form), good = ok(input.value);
        input.setAttribute('aria-invalid', String(!good));
        out.textContent = good ? '' : msg;
        if (!good && !firstBad) firstBad = input;
      }
      if (firstBad) {
        status.textContent = '';
        status.classList.remove('fstatus--err');
        firstBad.focus();
        return;
      }
      const origLbl = submitLbl ? submitLbl.textContent : 'Send enquiry';
      if (submitBtn) submitBtn.disabled = true;
      if (submitLbl) submitLbl.textContent = 'Sending…';
      status.textContent = '';
      status.classList.remove('fstatus--err');
      try {
        const res = await fetch(form.getAttribute('action') || '/api/contact.php', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' },
          body: new FormData(form),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.ok) {
          status.classList.remove('fstatus--err');
          status.textContent = form.dataset.success;
          form.reset();
          checks.forEach(([f]) => { const el = $(f, form); if (el) el.removeAttribute('aria-invalid'); });
          if (tsInput) tsInput.value = String(Date.now());
        } else if (res.status === 422 && data && data.errors) {
          const map = { name: ['#f-name', '#e-name'], email: ['#f-email', '#e-email'], message: ['#f-msg', '#e-msg'] };
          let focusEl = null;
          for (const [k, msg] of Object.entries(data.errors)) {
            if (!map[k]) continue;
            const [inpSel, errSel] = map[k];
            const inp = $(inpSel, form), err = $(errSel, form);
            if (inp) { inp.setAttribute('aria-invalid', 'true'); if (!focusEl) focusEl = inp; }
            if (err) err.textContent = msg;
          }
          if (focusEl) focusEl.focus();
        } else {
          status.classList.add('fstatus--err');
          status.textContent = (data && data.error) ? data.error : eSrv;
        }
      } catch {
        status.classList.add('fstatus--err');
        status.textContent = eSrv;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitLbl) submitLbl.textContent = origLbl;
      }
    });
  });

  const COOKIE_NAME = 'agrecir_consent';
  const getCookie = name => {
    const m = document.cookie.split('; ').find(r => r.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
  };
  const setCookie = (name, value) => {
    const sec = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax${sec}`;
  };
  const clearGaCookies = () => {
    document.cookie.split('; ').forEach(c => {
      const k = c.split('=')[0];
      if (k === '_ga' || k.startsWith('_ga_')) {
        document.cookie = `${k}=; Max-Age=0; Path=/; SameSite=Lax`;
      }
    });
  };
  let gaLoaded = false;
  const applyConsent = choice => {
    const gaMeta = $('meta[name="ga-id"]');
    const gaId = gaMeta ? gaMeta.content.trim() : '';
    if (choice === 'analytics' && gaId && !gaLoaded && navigator.globalPrivacyControl !== true) {
      gaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gaId, { anonymize_ip: true });
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
      document.head.append(s);
    } else if (choice !== 'analytics') {
      clearGaCookies();
    }
  };

  const ck = $('.cookie'), ana = $('#ck-ana');
  if (ck && ana) {
    const gpc = navigator.globalPrivacyControl === true;
    const showCk = settings => {
      ck.hidden = false;
      $('.ck-set', ck).hidden = !settings;
      ana.checked = getCookie(COOKIE_NAME) === 'analytics' && !gpc;
      if (gpc) { ana.checked = false; ana.disabled = true; $('.gpc', ck).hidden = false; }
    };
    ck.addEventListener('click', e => {
      const a = e.target.closest('[data-ck]'); if (!a) return;
      const act = a.dataset.ck;
      if (act === 'settings') { $('.ck-set', ck).hidden = false; ana.focus(); return; }
      const choice = act === 'all' ? (gpc ? 'essential' : 'analytics') : act === 'save' ? (ana.checked && !gpc ? 'analytics' : 'essential') : 'essential';
      setCookie(COOKIE_NAME, choice);
      applyConsent(choice);
      ck.hidden = true;
      toast(choice === 'analytics' ? 'Cookie choices saved: analytics on' : 'Cookie choices saved: essential only');
    });
    $$('[data-cookie-open]').forEach(b => b.addEventListener('click', () => { showCk(true); ana.focus(); }));
    const saved = getCookie(COOKIE_NAME);
    if (saved) {
      applyConsent(gpc ? 'essential' : saved);
    } else {
      setTimeout(() => showCk(false), 900);
    }
  }
})();
