/* ==========================================================================
   main.js — orquesta arranque, scroll → cámara, sonido y transición al IDE
   ========================================================================== */
(function () {
  'use strict';
  const KN = window.KN;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    boot: $('#boot'), bootLog: $('#boot-log'), bootBar: $('#boot-bar'), bootActions: $('#boot-actions'), bootHint: $('#boot-hint'),
    canvas: $('#scene'), ide: $('#ide'), hud: $('#hud'), hero: $('#hero'), hint: $('#scroll-hint'), rail: $('#rail'),
    flash: $('#fx-flash'), vignette: $('.fx-vignette'), grain: $('#fx-grain'), skip: $('#skip'),
  };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Grano de película ---------------------------------------- */
  (function grain() {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'); const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    els.grain.style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  /* ---------- Estado ---------------------------------------------------- */
  const st = { pTarget: 0, pView: 0, inIde: false, dissolve: 0, dissolveTarget: 0, lockReveal: false, keyLevel: 0.4, started: false, t0: performance.now(), last: performance.now(), nextThunder: 0 };
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

  /* ---------- Escena + sonido de teclas -------------------------------- */
  KN.Scene.init(els.canvas);
  KN.Scene.onKey = (kind) => {
    if (!st.started || st.inIde || st.keyLevel < 0.02) return;
    if (kind === 'save') { KN.Audio.key('key', st.keyLevel); setTimeout(() => KN.Audio.key('key', st.keyLevel * 0.9), 90); }
    else KN.Audio.key(kind, st.keyLevel);
  };

  /* ---------- IDE ------------------------------------------------------ */
  KN.IDE.init({
    onExit: exitIde,
    onSound: setSound,
    sfx: (n) => KN.Audio.sfx[n](),
  });

  function setSound(on) {
    KN.Audio.setEnabled(on);
    KN.IDE.setSound(on);
    if (on && st.inIde) KN.Audio.startPad();
    if (!on) KN.Audio.stopPad();
  }

  function enterIde() {
    if (st.inIde) return;
    st.inIde = true;
    st.dissolveTarget = 1;
    els.ide.classList.add('is-on');
    els.ide.removeAttribute('inert');
    els.ide.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go');
    KN.Audio.sfx.powerOn();
    setTimeout(() => KN.Audio.startPad(), 900);
    KN.IDE.show();
  }

  function exitIde() {
    if (!st.inIde) return;
    st.inIde = false;
    st.dissolveTarget = 0;
    st.lockReveal = true;
    KN.IDE.hide();
    els.ide.setAttribute('inert', '');
    els.ide.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    KN.Audio.sfx.exit();
    KN.Audio.stopPad();
    const target = reduced ? 0 : 0.42;
    window.scrollTo(0, maxScroll() * target);
    st.pTarget = target;
    if (reduced) st.pView = target;
  }

  /* ---------- Scroll ---------------------------------------------------- */
  addEventListener('scroll', () => { if (!st.inIde) st.pTarget = clamp(scrollY / maxScroll(), 0, 1); }, { passive: true });
  addEventListener('resize', () => { KN.Scene.resize(); if (st.inIde) window.scrollTo(0, maxScroll()); });
  els.skip.addEventListener('click', () => {
    KN.Audio.sfx.click();
    if (reduced) { window.scrollTo(0, maxScroll()); st.pTarget = st.pView = 1; return; }
    window.scrollTo({ top: maxScroll(), behavior: 'smooth' });
  });
  document.querySelectorAll('#hud [data-cmd="sound"]').forEach((b) => b.addEventListener('click', () => setSound(!KN.Audio.enabled)));
  $('.hud-brand').addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
  // Teclado en la escena
  addEventListener('keydown', (e) => {
    if (!st.started || st.inIde) return;
    if (e.key === 'Enter') { e.preventDefault(); els.skip.click(); }
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? KN.Audio.suspend() : KN.Audio.resume()));

  /* ---------- Bucle principal ------------------------------------------ */
  const railItems = Array.from(els.rail.children);
  function frame(now) {
    const dt = Math.min(0.1, (now - st.last) / 1000);
    st.last = now;
    const t = (now - st.t0) / 1000;

    if (st.inIde) st.pTarget = 1;
    const k = 1 - Math.pow(0.0009, dt); // suavizado independiente de los fps
    st.pView += (st.pTarget - st.pView) * k;
    if (Math.abs(st.pTarget - st.pView) < 0.0004) st.pView = st.pTarget;

    const zLin = clamp((st.pView - 0.05) / 0.88, 0, 1);
    const zoom = easeInOut(zLin);

    if (st.lockReveal && st.pView < 0.9) st.lockReveal = false;
    if (st.started && !st.inIde && !st.lockReveal && st.pView > 0.972) enterIde();

    // disolución
    const ds = dt * (st.dissolveTarget ? 1.5 : 2.2);
    st.dissolve = st.dissolveTarget ? Math.min(1, st.dissolve + ds) : Math.max(0, st.dissolve - ds);
    if (!st.inIde && st.dissolve === 0 && els.ide.classList.contains('is-on')) els.ide.classList.remove('is-on');

    if (st.dissolve < 1) KN.Scene.render(zoom, t, { dissolve: st.dissolve, typing: !st.inIde });
    const hideCanvas = st.dissolve >= 1;
    if (hideCanvas !== st.canvasHidden) { st.canvasHidden = hideCanvas; els.canvas.style.visibility = hideCanvas ? 'hidden' : ''; }

    // HUD / overlays
    const heroA = 1 - smoothstep(0.012, 0.07, st.pView);
    els.hero.style.opacity = heroA;
    els.hero.style.transform = `translateY(${(1 - heroA) * -20}px)`;
    els.hint.style.opacity = heroA;
    const hudA = st.inIde ? 0 : 1 - smoothstep(0.93, 0.97, st.pView) * 0.6;
    els.hud.style.opacity = hudA;
    els.hud.style.pointerEvents = hudA < 0.1 ? 'none' : '';
    els.rail.style.opacity = st.inIde ? 0 : 1;
    const step = st.pView < 0.06 ? 0 : st.pView < 0.95 ? 1 : 2;
    railItems.forEach((li, i) => li.classList.toggle('is-on', i <= step));
    els.vignette.style.opacity = 1 - st.dissolve;
    els.grain.style.opacity = 0.06 * (1 - st.dissolve * 0.6);

    // sonido
    st.keyLevel = st.inIde ? 0 : 0.3 + zoom * 0.35;
    KN.Audio.update(zLin, st.inIde, dt);
    if (st.started && !st.inIde && now > st.nextThunder) {
      if (st.nextThunder) { KN.Scene.lightning(); setTimeout(() => KN.Audio.thunder(), 500 + Math.random() * 900); }
      st.nextThunder = now + 28000 + Math.random() * 40000;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Arranque ------------------------------------------------- */
  const LOG = [
    'dibujando la habitación, píxel a píxel',
    `cargando experiencia (${KN.experiences.length} trabajos)`,
    'afinando el sonido de la lluvia',
    'encendiendo la lámpara',
    'sirviendo el café',
  ];
  function boot() {
    let i = 0;
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const tick = () => {
      if (i < LOG.length) {
        const d = document.createElement('div');
        d.innerHTML = `<span class="ok">[ ok ]</span> ${LOG[i]}`;
        els.bootLog.appendChild(d);
        i++;
        els.bootBar.style.width = `${(i / LOG.length) * 100}%`;
        setTimeout(tick, reduced ? 0 : 170 + Math.random() * 160);
      } else {
        fontsReady.then(() => {
          els.bootActions.hidden = false; els.bootHint.hidden = false;
          let pref = null; try { pref = localStorage.getItem('kn-sound'); } catch (e) { /* noop */ }
          (pref === '0' ? $('#enter-mute') : $('#enter-sound')).focus();
        });
      }
    };
    tick();
  }
  function start(withSound) {
    if (st.started) return;
    st.started = true;
    setSound(withSound);
    KN.Audio.sfx.boot();
    els.boot.classList.add('is-out');
    document.body.classList.remove('is-booting');
    setTimeout(() => els.boot.remove(), 900);
    const deep = decodeURIComponent(location.hash.slice(1));
    const isFile = KN.files.some((f) => f.path === deep);
    if (reduced || isFile) {
      window.scrollTo(0, maxScroll());
      st.pTarget = st.pView = 1;
      enterIde();
      st.dissolve = reduced ? 1 : st.dissolve;
    } else {
      window.scrollTo(0, 0);
    }
  }
  $('#enter-sound').addEventListener('click', () => start(true));
  $('#enter-mute').addEventListener('click', () => start(false));
  KN.IDE.setSound(false);
  boot();
})();
