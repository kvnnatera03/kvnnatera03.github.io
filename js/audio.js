/* ==========================================================================
   audio.js — diseño sonoro 100% sintetizado con Web Audio API (sin archivos).
   · Ambiente: tono de habitación, lluvia, zumbido del ordenador, truenos.
   · Teclado mecánico sincronizado con la animación.
   · Zoom: "whoosh" según la velocidad del scroll + riser/drone según progreso.
   · Entrada al IDE: encendido de pantalla + acorde tipo campana.
   · IDE: pad ambiental muy suave y sonidos de interfaz.
   ========================================================================== */
(function () {
  'use strict';
  const KN = (window.KN = window.KN || {});

  let ctx = null, master, comp, reverb, revSend, noiseBuf, pinkBuf, brownBuf;
  let amb = null, zoomFx = null, pad = null;
  let enabled = false, started = false;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeNoise(type, seconds = 3) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') d[i] = w;
        else if (type === 'pink') {
          b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
    }
    return buf;
  }

  function makeImpulse(seconds = 2.6, decay = 3) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function noiseSrc(buf, loop = true) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    s.loopStart = 0; s.start(0, Math.random() * 2);
    return s;
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = makeImpulse();
    revSend = ctx.createGain(); revSend.gain.value = 0.35;
    revSend.connect(reverb).connect(master);
    noiseBuf = makeNoise('white'); pinkBuf = makeNoise('pink'); brownBuf = makeNoise('brown');
  }

  /* ---------- Ambiente de la habitación ---------------------------------- */
  function startAmbience() {
    const bus = ctx.createGain(); bus.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.4;
    bus.connect(lp).connect(master);

    // tono de habitación
    const room = noiseSrc(brownBuf);
    const roomLp = ctx.createBiquadFilter(); roomLp.type = 'lowpass'; roomLp.frequency.value = 220;
    const roomG = ctx.createGain(); roomG.gain.value = 0.22;
    room.connect(roomLp).connect(roomG).connect(bus);

    // lluvia en la ventana
    const rain = noiseSrc(pinkBuf);
    const rHp = ctx.createBiquadFilter(); rHp.type = 'highpass'; rHp.frequency.value = 500;
    const rLp = ctx.createBiquadFilter(); rLp.type = 'lowpass'; rLp.frequency.value = 5200;
    const rG = ctx.createGain(); rG.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(rG.gain); lfo.start();
    rain.connect(rHp).connect(rLp).connect(rG).connect(bus);

    // zumbido del ordenador / ventilador
    const fan = noiseSrc(noiseBuf);
    const fBp = ctx.createBiquadFilter(); fBp.type = 'bandpass'; fBp.frequency.value = 180; fBp.Q.value = 1.2;
    const fG = ctx.createGain(); fG.gain.value = 0.05;
    fan.connect(fBp).connect(fG).connect(bus);
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 100;
    const humG = ctx.createGain(); humG.gain.value = 0.006;
    hum.connect(humG).connect(bus); hum.start();

    bus.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    amb = { bus, lp };

    // gotas sueltas
    const drop = () => {
      if (!ctx) return;
      if (enabled && amb) {
        const t = ctx.currentTime;
        const s = noiseSrc(noiseBuf, false);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 4000; bp.Q.value = 8;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.04, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        s.connect(bp).connect(g).connect(amb.bus); s.stop(t + 0.08);
      }
      setTimeout(drop, 80 + Math.random() * 380);
    };
    drop();
  }

  function thunder() {
    if (!enabled || !amb) return;
    const t = ctx.currentTime;
    const s = noiseSrc(brownBuf, false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.35, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    s.connect(lp).connect(g).connect(amb.bus);
    g.connect(revSend);
    s.stop(t + 5);
  }

  /* ---------- Zoom: whoosh + drone -------------------------------------- */
  function startZoomFx() {
    const w = noiseSrc(pinkBuf);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0;
    w.connect(bp).connect(wg).connect(master);
    wg.connect(revSend);

    const drone = ctx.createGain(); drone.gain.value = 0;
    const dLp = ctx.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 120; dLp.Q.value = 3;
    drone.connect(dLp).connect(master);
    dLp.connect(revSend);
    const oscs = [55, 55.35, 82.6, 110.2].map((f, i) => {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.25 : 0.18;
      o.connect(g).connect(drone); o.start(); return o;
    });
    const sub = ctx.createOscillator(); sub.frequency.value = 41.2;
    const sg = ctx.createGain(); sg.gain.value = 0.4; sub.connect(sg).connect(drone); sub.start();
    zoomFx = { wg, bp, drone, dLp, oscs };
  }

  /* ---------- Teclado mecánico ------------------------------------------ */
  function key(kind = 'key', level = 1) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime + Math.random() * 0.004;
    const v = level * (0.8 + Math.random() * 0.4);
    const deep = kind === 'space' || kind === 'enter';
    // clic
    const s = noiseSrc(noiseBuf, false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = (deep ? 1500 : 2600) + Math.random() * 900; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (deep ? 0.06 : 0.035));
    s.connect(bp).connect(g).connect(master); s.stop(t + 0.1);
    // "thock"
    const o = ctx.createOscillator(); o.type = 'sine';
    const f0 = deep ? 150 : 210 + Math.random() * 40;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.04);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.12 * v * (deep ? 1.5 : 1), t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.08);
    // retorno de la tecla
    const s2 = noiseSrc(noiseBuf, false);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const g2 = ctx.createGain();
    const t2 = t + 0.05 + Math.random() * 0.03;
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.exponentialRampToValueAtTime(0.05 * v, t2 + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.02);
    s2.connect(hp).connect(g2).connect(master); s2.stop(t2 + 0.04);
  }

  /* ---------- Tonos ------------------------------------------------------ */
  function tone(freq, dur, { type = 'sine', vol = 0.1, attack = 0.005, rev = 0.3, at = 0, glide = 0 } = {}) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    if (rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r).connect(revSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(freq, at = 0, vol = 0.05) {
    tone(freq, 2.4, { vol, at, attack: 0.004, rev: 0.8 });
    tone(freq * 2.01, 1.2, { vol: vol * 0.35, at, attack: 0.002, rev: 0.8 });
    tone(freq * 3.98, 0.5, { vol: vol * 0.12, at, attack: 0.001, rev: 0.6 });
  }

  const sfx = {
    boot() {
      tone(55, 0.9, { type: 'triangle', vol: 0.18, attack: 0.02, rev: 0.4, glide: 110 });
      tone(880, 0.12, { vol: 0.03, at: 0.25, rev: 0.5 });
    },
    powerOn() {
      // "zap" de encendido + sweep
      tone(60, 0.35, { type: 'sawtooth', vol: 0.05, attack: 0.005, rev: 0.2, glide: 1400 });
      const s = noiseSrc(noiseBuf, false), t = ctx.currentTime;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      s.connect(hp).connect(g).connect(master); s.stop(t + 0.4);
      // acorde (Dmaj9)
      [293.66, 369.99, 440, 554.37, 659.25].forEach((f, i) => bell(f, 0.18 + i * 0.07, 0.035));
    },
    exit() {
      tone(660, 0.5, { type: 'triangle', vol: 0.04, glide: 180, rev: 0.6 });
    },
    open() { tone(740, 0.07, { vol: 0.035, rev: 0.25 }); tone(1110, 0.09, { vol: 0.03, at: 0.05, rev: 0.25 }); },
    close() { tone(880, 0.07, { vol: 0.03, rev: 0.2, glide: 520 }); },
    click() { tone(1600, 0.03, { vol: 0.02, rev: 0 }); },
    tick() { tone(2400 + Math.random() * 400, 0.015, { type: 'square', vol: 0.006, rev: 0 }); },
    error() { tone(140, 0.18, { type: 'square', vol: 0.03, rev: 0.1 }); tone(110, 0.2, { type: 'square', vol: 0.03, at: 0.09, rev: 0.1 }); },
    success() { bell(587.33, 0, 0.03); bell(880, 0.08, 0.025); },
    type() { key('key', 0.35); },
  };

  /* ---------- Pad ambiental del IDE ------------------------------------- */
  const CHORDS = [
    [146.83, 220, 261.63, 329.63], // Dm9-ish
    [116.54, 174.61, 220, 293.66], // Bbmaj7
    [174.61, 220, 261.63, 329.63], // Fmaj7
    [130.81, 196, 246.94, 329.63], // Cmaj7
  ];
  function startPad() {
    if (pad || !ctx) return;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    out.connect(lp).connect(master); lp.connect(revSend);
    let idx = 0, timer = null;
    const play = () => {
      const t = ctx.currentTime;
      CHORDS[idx % CHORDS.length].forEach((f) => {
        [-4, 4].forEach((det) => {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
          g.gain.setValueAtTime(0.05, t + 6.5);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 9.5);
          o.connect(g).connect(out); o.start(t); o.stop(t + 10);
        });
      });
      idx++;
      timer = setTimeout(play, 8000);
    };
    play();
    out.gain.setTargetAtTime(0.5, ctx.currentTime, 2);
    pad = { out, stop() { clearTimeout(timer); out.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => out.disconnect(), 3000); } };
  }
  function stopPad() { if (pad) { pad.stop(); pad = null; } }

  /* ---------- API pública ----------------------------------------------- */
  let lastP = 0, vel = 0;
  KN.Audio = {
    get enabled() { return enabled; },
    unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEnabled(on) {
      init();
      if (!ctx) return;
      enabled = on;
      if (on) {
        ctx.resume();
        if (!started) { startAmbience(); startZoomFx(); started = true; }
        master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      }
      try { localStorage.setItem('kn-sound', on ? '1' : '0'); } catch (e) { /* noop */ }
    },
    // p: progreso del zoom 0..1, inIde: bool
    update(p, inIde, dt) {
      if (!ctx || !started) return;
      const t = ctx.currentTime;
      const d = Math.abs(p - lastP) / Math.max(dt, 0.001);
      lastP = p;
      vel += (clamp(d * 1.4, 0, 1) - vel) * 0.12;
      // ambiente: se filtra y baja al "entrar" en la pantalla
      const focus = inIde ? 1 : clamp(p, 0, 1);
      amb.lp.frequency.setTargetAtTime(inIde ? 500 : 12000 * Math.pow(0.08, focus), t, 0.15);
      amb.bus.gain.setTargetAtTime(inIde ? 0.35 : 1 - focus * 0.5, t, 0.2);
      // whoosh
      zoomFx.wg.gain.setTargetAtTime(inIde ? 0 : vel * 0.55, t, 0.06);
      zoomFx.bp.frequency.setTargetAtTime(250 + vel * 2600 + p * 900, t, 0.08);
      // drone/riser
      const rise = inIde ? 0 : Math.sin(clamp(p, 0, 1) * Math.PI) * 0.9 + (p > 0.02 ? 0.05 : 0);
      zoomFx.drone.gain.setTargetAtTime(rise * 0.09, t, 0.25);
      zoomFx.dLp.frequency.setTargetAtTime(90 + p * p * 1600, t, 0.2);
      zoomFx.oscs.forEach((o, i) => o.detune.setTargetAtTime(p * 700 + i * 3, t, 0.3));
    },
    key(kind, level) { key(kind, level); },
    thunder,
    sfx: new Proxy(sfx, { get: (o, k) => (...a) => { if (enabled && ctx && o[k]) o[k](...a); } }),
    startPad() { if (enabled) startPad(); },
    stopPad,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && enabled) ctx.resume(); },
  };
})();
