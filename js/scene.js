/* ==========================================================================
   scene.js — escena pixel art 100% procedural (sin imágenes).
   Resolución base 320x180. Capas con parallax (fondo, escritorio, persona)
   que se escalan de forma distinta para simular una cámara que avanza
   hacia el monitor.
   ========================================================================== */
(function () {
  'use strict';
  const KN = (window.KN = window.KN || {});

  // Tamaño de cada capa y origen de las coordenadas de escena dentro de ella
  const LW = 480, LH = 340, OX = 80, OY = 90;
  const SCR = { x: 112, y: 30, w: 96, h: 54 }; // pantalla del monitor
  const FOCUS = { x: SCR.x + SCR.w / 2, y: SCR.y + SCR.h / 2 };

  // Paleta: tonos oscuros / secos
  const P = {
    wall: ['#0a0908', '#0e0d0b', '#12110e', '#171612', '#1c1c17', '#22241e', '#2a2d26'],
    warmWall: ['#221b13', '#2b2217'],
    frame: '#1f1a15', frameHi: '#2e271f', frameLo: '#15120e',
    sky: ['#07090b', '#0a0d10', '#0d1115', '#11161b', '#161b1f'],
    bldFar: '#0b0e11', bldNear: '#07080a',
    winLit: ['#6b5a3e', '#8a7250', '#b8925a', '#5f7472'],
    rain: '#27333a', rainHi: '#364650',
    curtain: ['#120f0d', '#18130f', '#1e1813'],
    shelf: '#2e2218', shelfHi: '#3d2d1f', shelfLo: '#1a130d',
    books: ['#4a2f26', '#34402f', '#5b4a30', '#2c3640', '#3e3040', '#62482f', '#44463a'],
    desk: ['#1c150f', '#241b13', '#2c2118', '#34271c', '#3d2e21'],
    deskEdge: '#4a3727', deskFace: '#1f1710', under: '#070606',
    metal: ['#0f0f0e', '#141413', '#1a1918', '#22211f', '#2c2a27', '#3a3733'],
    led: '#c08a45',
    leaf: ['#1f281b', '#2c3824', '#3b4a2f', '#52613f'],
    pot: ['#3e2b20', '#4f3727', '#63452f'],
    mug: ['#3b352e', '#57504a', '#6f665a', '#8c7c62'],
    coffee: '#150e09',
    paper: ['#3b3830', '#4c483e', '#5e594c'],
    lamp: ['#1b1a18', '#252320', '#302d29'],
    bulb: '#f0d49a', warm: '#e0b774',
    hood: ['#0f100e', '#151613', '#1b1c18', '#22241f', '#2b2d27'],
    rimC: ['#39463f', '#566a62', '#8aa39a'],
    rimW: ['#4a3a27', '#6d5536', '#9a7a4c'],
    skin: ['#3d2c22', '#5a4233', '#735643', '#8a6a52'],
    chair: ['#0c0c0b', '#111110', '#171716', '#1e1e1c'],
    // pantalla (mini IDE) — coincide con el tema del IDE real
    ed: '#191a17', edHi: '#21221e', side: '#1e1d1a', bar: '#141412', accent: '#d8ae62',
    dim: '#5a554b', mut: '#8a8272', sel: '#2a2823',
  };

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  // PRNG determinista para que la escena sea siempre igual
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  function makeLayer(w = LW, h = LH) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c, g };
  }
  const R = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x) + OX, Math.round(y) + OY, Math.round(w), Math.round(h)); };
  const PX = (g, x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x) + OX, Math.round(y) + OY, 1, 1); };
  function line(g, x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; R(g, lerp(x0, x1, t) - (w >> 1), lerp(y0, y1, t) - (w >> 1), w, w, col); }
  }
  // Rellena con niveles de paleta usando dithering ordenado
  function levelColor(levels, v, x, y) {
    const pos = clamp(v, 0, 0.9999) * (levels.length - 1);
    const b = pos | 0;
    return pos - b > bay(x, y) ? levels[b + 1] : levels[b];
  }
  function ellipse(g, cx, cy, rx, ry, col) {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      R(g, cx - w, cy + y, w * 2 + 1, 1, col);
    }
  }

  /* ------------------------------------------------------------------------
     FONDO (pared, ventana con lluvia, estantería, cuadro)
     ------------------------------------------------------------------------ */
  const WIN = { x: 16, y: 6, w: 70, h: 66 };
  let cityLights = [];

  function drawBgStatic(g) {
    // Pared con brillo del monitor (frío) y de la lámpara (cálido)
    for (let y = -OY; y < LH - OY; y++) {
      for (let x = -OX; x < LW - OX; x++) {
        let v = 0.18 + clamp((y + 40) / 160, 0, 1) * 0.14;
        const dx = (x - 160) / 118, dy = (y - 58) / 74;
        v += Math.exp(-(dx * dx + dy * dy) * 1.5) * 0.62;
        const lx = (x - 248) / 60, ly = (y - 66) / 50;
        const warm = Math.exp(-(lx * lx + ly * ly) * 1.4);
        if (Math.random() < 0.012) v -= 0.06; // textura de yeso
        let col = levelColor(P.wall, v, x, y);
        if (warm > 0.28 && warm * 0.9 > bay(x + 1, y + 2)) col = warm > 0.7 ? P.warmWall[1] : P.warmWall[0];
        g.fillStyle = col; g.fillRect(x + OX, y + OY, 1, 1);
      }
    }

    // Luz de luna bajo la ventana
    for (let y = WIN.y + WIN.h + 4; y < 92; y++)
      for (let x = WIN.x + 4; x < WIN.x + WIN.w - 2; x++) {
        const v = 1 - (y - WIN.y - WIN.h) / 26;
        if (v * 0.35 > bay(x, y)) PX(g, x - ((y - WIN.y - WIN.h) >> 1), y, '#161a1a');
      }

    // Ventana: marco
    R(g, WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 6, P.frameLo);
    R(g, WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 4, P.frame);
    R(g, WIN.x - 2, WIN.y - 2, WIN.w + 4, 1, P.frameHi);
    // Cielo
    for (let y = 0; y < WIN.h; y++)
      for (let x = 0; x < WIN.w; x++) PX(g, WIN.x + x, WIN.y + y, levelColor(P.sky, y / WIN.h * 0.9 + 0.05, x, y));
    // Estrellas
    for (let i = 0; i < 9; i++) PX(g, WIN.x + 2 + rnd() * (WIN.w - 4), WIN.y + 2 + rnd() * 22, rnd() > 0.5 ? '#2a3036' : '#3a4046');
    // Edificios lejanos
    let bx = WIN.x;
    while (bx < WIN.x + WIN.w) {
      const w = 6 + (rnd() * 9) | 0, h = 18 + (rnd() * 24) | 0;
      R(g, bx, WIN.y + WIN.h - h, w, h, P.bldFar);
      for (let wy = WIN.y + WIN.h - h + 3; wy < WIN.y + WIN.h - 2; wy += 3)
        for (let wx = bx + 1; wx < bx + w - 1; wx += 2)
          if (rnd() < 0.18) cityLights.push({ x: wx, y: wy, c: P.winLit[(rnd() * 4) | 0], blink: rnd() < 0.25, ph: rnd() * 10 });
      bx += w + ((rnd() * 2) | 0);
    }
    // Edificios cercanos (más oscuros)
    bx = WIN.x - 2;
    while (bx < WIN.x + WIN.w) {
      const w = 9 + (rnd() * 12) | 0, h = 8 + (rnd() * 14) | 0;
      R(g, bx, WIN.y + WIN.h - h, w, h, P.bldNear);
      if (rnd() < 0.5) R(g, bx + (w >> 1), WIN.y + WIN.h - h - 4, 1, 4, P.bldNear); // antena
      bx += w;
    }
    // Parteluces
    R(g, WIN.x + (WIN.w >> 1) - 1, WIN.y, 2, WIN.h, P.frame);
    R(g, WIN.x, WIN.y + 30, WIN.w, 2, P.frame);
    R(g, WIN.x + (WIN.w >> 1) - 1, WIN.y, 1, WIN.h, P.frameHi);
    // Alféizar
    R(g, WIN.x - 6, WIN.y + WIN.h + 2, WIN.w + 12, 3, P.frame);
    R(g, WIN.x - 6, WIN.y + WIN.h + 2, WIN.w + 12, 1, P.frameHi);
    R(g, WIN.x - 6, WIN.y + WIN.h + 5, WIN.w + 12, 1, P.frameLo);
    // Cortina
    R(g, 0, -4, 96, 2, P.metal[3]);
    for (let y = -2; y < 98; y++) {
      const sway = Math.round(Math.sin(y / 9) * 1.2);
      for (let x = 4; x < 20; x++) {
        const f = Math.sin((x + sway) * 1.1) * 0.5 + 0.5;
        PX(g, x + sway, y, levelColor(P.curtain, f * 0.8 + (x > 16 ? 0.2 : 0), x, y));
      }
    }

    // Estantería con libros
    const SY = 22;
    R(g, 226, SY, 86, 3, P.shelf); R(g, 226, SY, 86, 1, P.shelfHi); R(g, 226, SY + 3, 86, 1, P.shelfLo);
    R(g, 236, SY + 4, 2, 6, P.shelfLo); R(g, 300, SY + 4, 2, 6, P.shelfLo);
    let x = 230;
    for (let i = 0; i < 13; i++) {
      const w = 3 + ((rnd() * 3) | 0), h = 9 + ((rnd() * 7) | 0), c = P.books[(rnd() * P.books.length) | 0];
      if (i === 8) { // libro inclinado
        for (let k = 0; k < 12; k++) R(g, x + (k >> 1), SY - 1 - k, 3, 1, c);
        x += 9; continue;
      }
      R(g, x, SY - h, w, h, c);
      R(g, x, SY - h, 1, h, '#00000033');
      R(g, x, SY - h + 2, w, 1, '#ffffff14');
      x += w + (rnd() < 0.2 ? 1 : 0);
      if (x > 296) break;
    }
    // Maceta colgante con enredadera
    R(g, 300, SY - 6, 8, 6, P.pot[1]); R(g, 300, SY - 6, 8, 1, P.pot[2]);
    for (let k = 0; k < 22; k++) {
      const vy = SY + k, vx = 304 + Math.round(Math.sin(k / 3) * 2);
      PX(g, vx, vy, P.leaf[1]);
      if (k % 3 === 0) { PX(g, vx - 1, vy, P.leaf[2]); PX(g, vx + 1, vy + 1, P.leaf[0]); }
    }
    for (let k = 0; k < 14; k++) { const vy = SY + k, vx = 309 + Math.round(Math.sin(k / 2.5) * 1.5); PX(g, vx, vy, k % 2 ? P.leaf[0] : P.leaf[2]); }

    // Cuadro: atardecer en tonos secos
    const FX = 276, FY = 36, FW = 36, FH = 30;
    R(g, FX - 2, FY - 2, FW + 4, FH + 4, '#191410'); R(g, FX - 2, FY - 2, FW + 4, 1, '#2a2119');
    const sunset = ['#1d1a1f', '#2a2226', '#3a2a26', '#553a2c', '#6e4a32'];
    for (let y = 0; y < FH; y++) for (let xx = 0; xx < FW; xx++) PX(g, FX + xx, FY + y, levelColor(sunset, y / FH, xx, y));
    ellipse(g, FX + 22, FY + 19, 5, 5, '#a8793f');
    for (let xx = 0; xx < FW; xx++) {
      const h1 = 9 + Math.round(Math.sin(xx / 4) * 3 + Math.sin(xx / 1.7));
      R(g, FX + xx, FY + FH - h1, 1, h1, '#2a201a');
      const h2 = 5 + Math.round(Math.sin(xx / 6 + 2) * 2);
      R(g, FX + xx, FY + FH - h2, 1, h2, '#1a1411');
    }

    // Post-its en la pared
    R(g, 216, 40, 7, 7, '#5e5236'); R(g, 216, 40, 7, 1, '#6e6040');
    R(g, 219, 49, 7, 7, '#3f4d44'); R(g, 219, 49, 7, 1, '#4b5b51');
    R(g, 217, 42, 4, 1, '#3a3222'); R(g, 217, 44, 3, 1, '#3a3222');
  }

  function drawBgDynamic(g, t, flash) {
    // Lluvia sobre el cristal
    g.save();
    g.beginPath(); g.rect(WIN.x + OX, WIN.y + OY, WIN.w, WIN.h); g.clip();
    for (let i = 0; i < 26; i++) {
      const sp = 70 + (i * 37) % 40;
      const y = ((i * 53.7 + t * sp) % (WIN.h + 12)) - 6;
      const x = ((i * 97.3) % WIN.w) - ((t * sp * 0.25) % 8);
      const c = i % 4 ? P.rain : P.rainHi;
      PX(g, WIN.x + x, WIN.y + y, c);
      PX(g, WIN.x + x - 0.35, WIN.y + y - 1, c);
      PX(g, WIN.x + x - 0.7, WIN.y + y - 2, P.rain);
    }
    // Gotas que resbalan
    for (let i = 0; i < 7; i++) {
      const y = ((i * 29 + t * (3 + i)) % WIN.h);
      PX(g, WIN.x + 5 + i * 9, WIN.y + y, '#3c4a52');
    }
    g.restore();
    // Luces de la ciudad
    for (const L of cityLights) {
      if (L.blink && Math.sin(t * 0.7 + L.ph * 3) > 0.6) continue;
      PX(g, L.x, L.y, L.c);
    }
    // Relámpago
    if (flash > 0) {
      g.globalAlpha = flash * 0.55;
      R(g, WIN.x, WIN.y, WIN.w, WIN.h, '#9fb2bf');
      g.globalAlpha = flash * 0.06;
      R(g, -OX, -OY, LW, LH, '#9fb2bf');
      g.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------------
     ESCRITORIO (mesa, monitor, teclado, lámpara, planta, taza...)
     ------------------------------------------------------------------------ */
  const KB = { x: 116, y: 101, w: 88, h: 8 };

  function drawDeskStatic(g) {
    // Superficie de la mesa
    for (let y = 92; y < 124; y++)
      for (let x = -OX; x < LW - OX; x++) {
        let v = 0.25 + (y - 92) / 32 * 0.25;
        const dx = (x - 160) / 70, dy = (y - 96) / 16;
        v += Math.exp(-(dx * dx + dy * dy)) * 0.35;
        const lx = (x - 244) / 34, ly = (y - 104) / 12;
        const warm = Math.exp(-(lx * lx + ly * ly));
        v += warm * 0.4;
        if (((x * 7 + y * 31) % 23 === 0) || (Math.sin(x / 7 + y * 1.7) > 0.93)) v -= 0.12; // veta
        PX(g, x, y, levelColor(P.desk, v, x, y));
      }
    R(g, -OX, 92, LW, 1, '#0d0a07');
    R(g, -OX, 124, LW, 2, P.deskEdge);
    R(g, -OX, 124, LW, 1, '#574130');
    R(g, -OX, 126, LW, 6, P.deskFace);
    for (let y = 132; y < LH - OY; y++)
      for (let x = -OX; x < LW - OX; x++) PX(g, x, y, levelColor([P.under, '#0b0a09', '#110e0c'], 0.6 - (y - 132) / 40, x, y));

    // Cono de luz de la lámpara
    g.globalAlpha = 0.06;
    g.fillStyle = P.warm;
    g.beginPath();
    g.moveTo(OX + 241, OY + 55); g.lineTo(OX + 255, OY + 55);
    g.lineTo(OX + 282, OY + 110); g.lineTo(OX + 212, OY + 110); g.closePath(); g.fill();
    g.globalAlpha = 1;

    // Libros apilados (izquierda)
    const stack = [['#3b2a22', 26, 86, 26], ['#2f3a30', 28, 82, 22], ['#4c3d2a', 25, 79, 24]];
    stack.forEach(([c, x, y, w]) => { R(g, x, y, w, 4, c); R(g, x, y, w, 1, '#ffffff12'); R(g, x + w - 2, y + 1, 2, 2, P.paper[0]); });

    // Altavoz
    R(g, 80, 62, 16, 30, P.metal[1]); R(g, 81, 63, 14, 28, P.metal[2]); R(g, 81, 63, 14, 1, P.metal[4]);
    ellipse(g, 88, 82, 5, 5, P.metal[0]); ellipse(g, 88, 82, 3, 3, P.metal[3]); PX(g, 88, 82, P.metal[1]);
    ellipse(g, 88, 70, 2, 2, P.metal[0]); PX(g, 87, 69, P.metal[4]);

    // Planta
    R(g, 56, 80, 14, 12, P.pot[1]); R(g, 56, 80, 14, 2, P.pot[2]); R(g, 66, 82, 4, 10, P.pot[0]); R(g, 57, 82, 12, 1, '#1a120c');
    const leaves = [[62, 60, 3], [55, 66, 2], [69, 64, 3], [59, 72, 2], [67, 73, 1], [52, 74, 1], [64, 54, 0], [72, 70, 2], [57, 58, 1]];
    leaves.forEach(([lx, ly, s], i) => {
      line(g, 63, 80, lx + 3, ly + 3, P.leaf[0]);
      for (let yy = 0; yy < 7; yy++) {
        const w = Math.round(4 * Math.sin((yy / 6) * Math.PI));
        R(g, lx + 3 - w, ly + yy, w * 2 + 1, 1, P.leaf[s > 1 ? 2 : 1]);
      }
      R(g, lx + 3, ly + 1, 1, 5, P.leaf[0]);
      if (s > 1) PX(g, lx + 1, ly + 2, P.leaf[3]);
    });

    // Monitor: soporte
    ellipse(g, 160, 96, 20, 3, P.metal[2]); R(g, 142, 94, 36, 1, P.metal[4]);
    R(g, 154, 86, 12, 9, P.metal[1]); R(g, 154, 86, 2, 9, P.metal[3]); R(g, 164, 86, 2, 9, P.metal[0]);
    R(g, 170, 88, 1, 6, '#0b0a09');
    // Marco
    R(g, SCR.x - 5, SCR.y - 5, SCR.w + 10, SCR.h + 10, P.metal[0]);
    R(g, SCR.x - 4, SCR.y - 4, SCR.w + 8, SCR.h + 8, P.metal[1]);
    R(g, SCR.x - 4, SCR.y - 4, SCR.w + 8, 1, P.metal[4]);
    R(g, SCR.x - 4, SCR.y - 4, 1, SCR.h + 8, P.metal[3]);
    R(g, SCR.x + SCR.w + 3, SCR.y - 4, 1, SCR.h + 8, '#3a2f22'); // borde cálido
    R(g, SCR.x - 1, SCR.y - 1, SCR.w + 2, SCR.h + 2, '#0b0b0a');
    R(g, 157, SCR.y + SCR.h + 2, 6, 1, P.metal[3]);
    PX(g, SCR.x + SCR.w + 1, SCR.y + SCR.h + 2, P.led);
    // Post-it en el marco
    R(g, SCR.x - 4, SCR.y + SCR.h - 6, 6, 6, '#6a5b3a'); R(g, SCR.x - 4, SCR.y + SCR.h - 6, 6, 1, '#7a6a45');

    // Teclado
    R(g, KB.x, KB.y, KB.w, KB.h, P.metal[1]);
    R(g, KB.x + 1, KB.y + 1, KB.w - 2, KB.h - 2, P.metal[2]);
    R(g, KB.x, KB.y, KB.w, 1, P.metal[4]);
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 21; k++) R(g, KB.x + 3 + r + k * 4, KB.y + 2 + r * 2, 3, 1, r === 0 ? '#34332f' : P.metal[4]);
    R(g, KB.x + 30, KB.y + 7, 28, 1, P.metal[4]);
    // Alfombrilla + ratón
    R(g, 200, 99, 30, 14, '#100f0e'); R(g, 200, 99, 30, 1, '#1b1a18');
    R(g, 212, 102, 6, 8, P.metal[3]); R(g, 213, 102, 4, 1, P.metal[5]); PX(g, 215, 103, P.metal[1]);

    // Taza
    R(g, 222, 86, 11, 12, P.mug[1]); R(g, 228, 86, 5, 12, P.mug[2]); R(g, 231, 87, 2, 10, P.mug[3]);
    R(g, 222, 86, 11, 2, P.mug[0]); R(g, 223, 86, 9, 1, P.coffee);
    R(g, 233, 89, 3, 1, P.mug[3]); R(g, 235, 89, 1, 5, P.mug[3]); R(g, 233, 93, 3, 1, P.mug[2]);
    R(g, 222, 98, 11, 1, '#0f0b08');

    // Libreta
    R(g, 34, 106, 26, 12, P.paper[1]); R(g, 34, 106, 26, 1, P.paper[2]); R(g, 46, 106, 1, 12, P.paper[0]);
    for (let k = 0; k < 4; k++) { R(g, 36, 109 + k * 2, 8, 1, P.paper[0]); R(g, 49, 109 + k * 2, 9, 1, P.paper[0]); }
    line(g, 50, 104, 62, 114, '#6a3f2a');

    // Lámpara
    ellipse(g, 272, 97, 10, 2, P.lamp[1]); R(g, 263, 95, 18, 1, P.lamp[2]);
    line(g, 272, 96, 279, 70, P.lamp[1], 2);
    R(g, 277, 68, 4, 4, P.lamp[2]);
    line(g, 278, 69, 256, 51, P.lamp[1], 2);
    for (let yy = 0; yy < 9; yy++) R(g, 243 - (yy >> 1), 46 + yy, 14 + yy, 1, yy < 2 ? P.lamp[2] : P.lamp[1]);
    R(g, 241, 54, 16, 2, P.bulb); R(g, 243, 54, 12, 1, '#fff1cf');
    R(g, 257, 48, 1, 6, '#5a4630');
  }

  // Mug steam, key flashes, pantalla
  function drawDeskDynamic(g, t, keyFlash) {
    // Vapor
    for (let k = 0; k < 6; k++) {
      const ph = (t * 0.35 + k / 6) % 1;
      g.globalAlpha = (1 - ph) * 0.5;
      PX(g, 227 + Math.sin(ph * 7 + k) * 2, 84 - ph * 18, '#6b6558');
    }
    g.globalAlpha = 1;
    // Tecla pulsada
    if (keyFlash) R(g, keyFlash.x, keyFlash.y, 3, 1, '#58534a');
  }

  /* ------------------------------------------------------------------------
     PERSONA de espaldas con sudadera y capucha + silla
     ------------------------------------------------------------------------ */
  /* Persona modelada con campos de distancia (SDF): cada parte (cabeza,
     hombros, brazos, espalda, silla) tiene volumen gracias a un perfil de
     altura; con esa normal se ilumina con luces reales de la escena
     (monitor, lámpara y ventana) y se cuantiza a la paleta con dithering. */
  const HEAD = { x: 160, y: 88, rx: 15.5, ry: 17 };
  const HOOD_TOP = HEAD.y - HEAD.ry;
  const HANDS = [{ x: 139, y: 100, left: true }, { x: 181, y: 100, left: false }];

  const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
  const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
  function sdCapsule(x, y, ax, ay, bx, by, r) {
    const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
    return Math.hypot(pax - bax * h, pay - bay * h) - r;
  }
  function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); }
  // caja redondeada con lados en trapecio y sin fondo (se pierde bajo la silla)
  function sdTorso(x, y, cx, top, hwTop, hwBot, r) {
    const hw = lerp(hwTop, hwBot, clamp((y - top) / 42, 0, 1));
    const qx = Math.abs(x - cx) - (hw - r), qy = (top + r) - y;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }

  const RAMP = {
    cloth: ['#0c0d0c', '#121412', '#191c18', '#20241f', '#292e27', '#333930', '#3e4539'],
    cool: ['#34423d', '#4b5e57', '#6a8279', '#94ada2', '#bcd2c6'],
    warm: ['#46362a', '#665034', '#8d6d45', '#b58c57', '#d6ad6d'],
    chair: ['#08090a', '#0d0f10', '#121416', '#181b1d', '#1f2326'],
    phones: ['#070707', '#0e0e0f', '#161618', '#1f1f22', '#2a2a2e'],
  };
  const LIGHTS = [
    { x: 160, y: 50, z: -16, k: 1.0, tint: 'cool' },   // monitor (detrás de la persona)
    { x: 250, y: 54, z: -16, k: 0.72, tint: 'warm' },  // lámpara
    { x: 40, y: 40, z: -30, k: 0.45, tint: 'cool' },   // luna por la ventana
  ];

  // Pinta una parte con volumen. mask marca píxeles ya pintados (para pliegues).
  function renderPart(g, mask, part) {
    const { sdf, box, R = 8, ramp = 'cloth', fold, shade = 1, crease = true } = part;
    const [x0, y0, x1, y1] = box;
    const w = x1 - x0 + 3, h = y1 - y0 + 3;
    const Z = new Float32Array(w * h), D = new Float32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const x = x0 - 1 + i, y = y0 - 1 + j;
        const d = sdf(x + 0.5, y + 0.5);
        D[j * w + i] = d;
        if (d < 0) {
          const sIn = Math.min(-d, R);
          let z = Math.sqrt(R * R - (R - sIn) * (R - sIn));
          if (fold) z += fold(x, y) * Math.min(1, -d / 2);
          Z[j * w + i] = z;
        }
      }
    for (let j = 1; j < h - 1; j++)
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i, d = D[k];
        if (d >= 0) continue;
        const x = x0 - 1 + i, y = y0 - 1 + j;
        let nx = (Z[k - 1] - Z[k + 1]) * 0.5, ny = (Z[k - w] - Z[k + w]) * 0.5, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let cool = 0, warm = 0;
        for (const L of LIGHTS) {
          const lx = L.x - x, ly = L.y - y, lz = L.z, ll = Math.hypot(lx, ly, lz);
          const v = Math.max(0, (nx * lx + ny * ly + nz * lz) / ll) * L.k;
          if (L.tint === 'cool') cool += v; else warm += v;
        }
        cool *= shade; warm *= shade;
        const li = (OY + y) * LW + (OX + x);
        const edge = d > -1.05;
        let col;
        if (edge && crease && mask[li]) col = RAMP[ramp][0]; // pliegue / oclusión con lo que hay detrás
        else if (cool > 0.34 && cool >= warm) col = levelColor(RAMP.cool, (cool - 0.34) * 1.5, x, y);
        else if (warm > 0.4) col = levelColor(RAMP.warm, (warm - 0.4) * 1.3, x, y);
        else {
          const base = 0.12 + nz * 0.3 + (cool + warm) * 0.95 + (ny < 0 ? -ny * 0.1 : 0);
          col = levelColor(RAMP[ramp], base, x, y);
        }
        g.fillStyle = col; g.fillRect(OX + x, OY + y, 1, 1);
        mask[li] = 1;
      }
  }

  function drawHand(g, cx, cy, pressed, left) {
    const y = cy + (pressed ? 1 : 0);
    // puño de la manga
    R(g, cx - 4, y + 2, 9, 3, P.hood[1]);
    R(g, cx - 4, y + 2, 9, 1, left ? P.rimC[1] : P.rimW[1]);
    // mano
    R(g, cx - 3, y - 1, 7, 3, P.skin[1]);
    R(g, cx - 2, y - 1, 4, 1, P.skin[3]);
    R(g, cx - 3, y + 1, 7, 1, P.skin[0]);
    PX(g, left ? cx - 3 : cx + 3, y - 1, P.skin[0]);
    // nudillos / dedos
    PX(g, cx - 1, y - 2, pressed && left ? P.skin[3] : P.skin[2]);
    PX(g, cx + 1, y - 2, pressed && !left ? P.skin[3] : P.skin[2]);
  }

  function drawBody(g, breath, hx) {
    g.clearRect(0, 0, LW, LH);
    const mask = new Uint8Array(LW * LH);
    const b = breath;
    const HX = HEAD.x + hx;

    // Antebrazos (detrás de hombros): del codo hacia el teclado
    [[1, 139], [-1, 181]].forEach(([s, hxp]) => {
      const ex = 160 - s * 40, ey = 147 + b;
      renderPart(g, mask, {
        sdf: (x, y) => sdCapsule(x, y, ex, ey, hxp - s * 1, 104, 5),
        box: [Math.min(ex, hxp) - 8, 96, Math.max(ex, hxp) + 8, 156], R: 4, shade: 0.9, crease: false,
      });
    });

    // Brazos superiores + deltoides (detrás de la espalda)
    [1, -1].forEach((s) => {
      const sx = 160 - s * 29, sy = 120 + b, ex = 160 - s * 40, ey = 147 + b;
      renderPart(g, mask, {
        sdf: (x, y) => smin(sdCircle(x, y, sx, sy, 11), sdCapsule(x, y, sx - s * 3, sy + 3, ex, ey, 8.5), 5),
        box: [Math.min(sx, ex) - 16, sy - 15, Math.max(sx, ex) + 16, ey + 12], R: 9,
        fold: (x, y) => (y > sy + 12 ? Math.sin((x * s) * 0.9 + y * 0.8) * 0.9 : 0),
      });
    });

    // Espalda
    renderPart(g, mask, {
      sdf: (x, y) => sdTorso(x, y, 160, 108 + b, 25, 31, 12),
      box: [118, 104 + b, 202, 250], R: 16,
      fold: (x, y) => {
        const dx = x - 160;
        return Math.sin(dx * 0.22 + y * 0.35) * Math.exp(-((y - 130) ** 2) / 300) * 1.2 * Math.min(1, Math.abs(dx) / 18);
      },
    });

    // Capucha caída sobre la espalda (forma de U bajo la nuca)
    renderPart(g, mask, {
      sdf: (x, y) => sdEllipse(x, y, HX * 0.6 + 160 * 0.4, 110 + b, 18, 9.5),
      box: [138, 98 + b, 182, 122 + b], R: 6,
    });

    // Cabeza con capucha (ligeramente más ancha arriba, con costura central)
    renderPart(g, mask, {
      sdf: (x, y) => smin(sdEllipse(x, y, HX, HEAD.y + b, HEAD.rx, HEAD.ry), sdEllipse(x, y, HX, HEAD.y + 12 + b, 13, 8), 4),
      box: [HX - 20, HEAD.y - HEAD.ry - 3 + b, HX + 20, HEAD.y + HEAD.ry + 6 + b], R: 12,
      fold: (x, y) => Math.sin(y * 0.55 + x * 0.2) * 0.45 + Math.sin(x * 0.7 - y * 0.3) * 0.3,
    });
    // costura central de la capucha (sutil)
    for (let y = HEAD.y - HEAD.ry + 4 + b; y < HEAD.y + 9 + b; y++) PX(g, HX, y, RAMP.cloth[1]);

    // Auriculares: diadema sobre la capucha + orejeras
    const top = HEAD.y - HEAD.ry + b;
    for (let a = 0; a <= 1; a += 0.01) {
      const th = Math.PI * (1.1 + a * 0.8);
      const x = HX + Math.cos(th) * (HEAD.rx + 0.6), y = HEAD.y + b + Math.sin(th) * (HEAD.ry + 0.6);
      PX(g, x, y, '#0a0a0b');
      PX(g, x, y - 1, a < 0.62 ? P.rimC[1] : P.rimW[0]);
    }
    [[-1, HX - HEAD.rx - 0.5], [1, HX + HEAD.rx + 0.5]].forEach(([s, cx]) => {
      renderPart(g, mask, {
        sdf: (x, y) => {
          const qx = Math.abs(x - cx) - 1.5, qy = Math.abs(y - (HEAD.y + 1 + b)) - 4.5;
          return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 2.5;
        },
        box: [cx - 6, HEAD.y - 8 + b, cx + 6, HEAD.y + 10 + b], R: 3, ramp: 'phones', crease: true,
      });
      PX(g, cx + s * 0, HEAD.y + 1 + b, s < 0 ? '#5f7a70' : '#b8864a'); // pequeño led
    });
    // Cable del auricular que baja por la espalda
    for (let y = HEAD.y + 7 + b; y < 124; y++) PX(g, HX - HEAD.rx + 1 + Math.round(Math.sin(y * 0.4) * 0.6) + (y - HEAD.y) * 0.25, y, '#0a0a0b');

    // Silla (respaldo con volumen, costura central y zona lumbar)
    renderPart(g, mask, {
      sdf: (x, y) => {
        const qx = Math.abs(x - 160) - (30 - 11), qy = Math.abs(y - 205) - (58 - 11);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 11;
      },
      box: [126, 146, 194, 262], R: 9, ramp: 'chair', shade: 0.55,
      fold: (x, y) => (Math.abs(x - 160) < 1 ? -1.5 : 0) + (Math.abs(y - 176) < 1 ? -1.2 : 0),
    });
    // Reposabrazos
    [[106, 1], [196, -1]].forEach(([x, s]) => {
      R(g, x, 154, 18, 4, RAMP.chair[2]); R(g, x + 1, 154, 16, 1, s > 0 ? '#2e3833' : '#3d3023');
      R(g, x + 7, 158, 4, 30, RAMP.chair[1]); R(g, x + 7, 158, 1, 30, RAMP.chair[2]);
    });
  }

  const bodyCache = {};
  function drawPerson(g, t, st) {
    const breath = Math.sin(t * 1.45) > 0.35 ? -1 : 0;
    const key = breath + '|' + st.headDX;
    if (!bodyCache[key]) { const L = makeLayer(); drawBody(L.g, breath, st.headDX); bodyCache[key] = L.c; }
    g.clearRect(0, 0, LW, LH);
    g.drawImage(bodyCache[key], 0, 0);
    HANDS.forEach((hd) => drawHand(g, hd.x, hd.y, hd.left ? st.pressL : st.pressR, hd.left));
  }

  /* ------------------------------------------------------------------------
     PANTALLA: mini-IDE (baja res en bloques / alta res con fuente 3x5)
     Layout en unidades base (96x54). Alta resolución = x4.
     ------------------------------------------------------------------------ */
  const LAY = { act: 3, side: 15, gutter: 5, code: 23, top: 4, rows: 23, maxCols: 67 };
  const SIDE_FILES = ['README.MD', 'EXPERIENCE/', ' 03_FANDIT.TS', ' 02_BRISA.DART', ' 01_NODO.JS', 'SKILLS.JSON', 'EDUCATION.YML', 'CONTACT.SH', 'KEVIN.TS'];
  const ACTIVE_SIDE = 8;

  const Typer = {
    full: '', buf: '', i: 0, next: 0, pendingBack: false, state: 'typing', lines: [], saved: true, version: 0,
    init(text) {
      this.full = text;
      // arranca a mitad para que la pantalla ya tenga código
      const nl = text.split('\n').slice(0, 9).join('\n').length;
      this.i = nl; this.buf = text.slice(0, nl);
      this.retokenize();
    },
    retokenize() { this.lines = KN.highlight(this.buf, 'ts'); this.version++; },
    update(now, emit) {
      if (now < this.next) return;
      const r = (a, b) => a + Math.random() * (b - a);
      if (this.state === 'done') {
        this.buf = ''; this.i = 0; this.state = 'typing'; this.saved = false;
        this.retokenize(); this.next = now + 900; emit('enter'); return;
      }
      if (this.pendingBack) {
        this.buf = this.buf.slice(0, -1); this.pendingBack = false;
        emit('back'); this.retokenize(); this.next = now + r(110, 190); return;
      }
      if (this.i >= this.full.length) {
        this.state = 'done'; this.saved = true; emit('save'); this.version++;
        this.next = now + 5200; return;
      }
      this.saved = false;
      const ch = this.full[this.i];
      if (ch === '\n') {
        this.buf += '\n'; this.i++;
        while (this.full[this.i] === ' ') { this.buf += ' '; this.i++; }
        emit('enter'); this.retokenize();
        this.next = now + r(280, 760); return;
      }
      if (/[a-z]/.test(ch) && Math.random() < 0.03) {
        this.buf += 'qwertyuiopasdfghjklzxcvbnm'[(Math.random() * 26) | 0];
        this.pendingBack = true; emit('key', 'x'); this.retokenize();
        this.next = now + r(220, 380); return;
      }
      this.buf += ch; this.i++;
      emit(ch === ' ' ? 'space' : 'key', ch);
      this.retokenize();
      let d = r(48, 125);
      if (ch === ' ') d += r(15, 70);
      if ('({[;,.'.includes(ch)) d += r(40, 150);
      if (Math.random() < 0.035) d += r(350, 900);
      this.next = now + d;
    },
  };

  const COLORS = () => KN.tokenColors;

  function screenModel(t) {
    const lines = Typer.lines;
    const curLine = lines.length - 1;
    const scroll = Math.max(0, curLine - (LAY.rows - 2));
    const blink = Math.floor(t * 1.9) % 2 === 0;
    return { lines, curLine, scroll, blink };
  }

  function drawScreenLo(g, t) {
    const X = SCR.x, Y = SCR.y;
    const m = screenModel(t);
    const col = COLORS();
    R(g, X, Y, SCR.w, SCR.h, P.ed);
    R(g, X, Y, LAY.act, SCR.h, P.bar);
    PX(g, X + 1, Y + 5, P.mut); PX(g, X + 1, Y + 9, P.dim); PX(g, X + 1, Y + 13, P.dim);
    R(g, X + LAY.act, Y, LAY.side, SCR.h, P.side);
    SIDE_FILES.forEach((f, i) => {
      const yy = Y + LAY.top + 1 + i * 2;
      if (i === ACTIVE_SIDE) R(g, X + LAY.act, yy, LAY.side, 1, P.sel);
      R(g, X + LAY.act + 1 + (f[0] === ' ' ? 1 : 0), yy, Math.min(12, f.trim().length), 1, i === ACTIVE_SIDE ? '#b7ad9b' : P.dim);
    });
    R(g, X + 18, Y, SCR.w - 18, 3, P.bar);
    R(g, X + 18, Y, 16, 3, P.ed); R(g, X + 18, Y, 16, 1, P.accent);
    R(g, X + 20, Y + 1, 8, 1, '#b7ad9b');
    if (!Typer.saved) PX(g, X + 31, Y + 1, P.mut);
    // código
    for (let r = 0; r < LAY.rows; r++) {
      const li = m.scroll + r; const ln = m.lines[li];
      const yy = Y + LAY.top + r * 2;
      if (!ln) break;
      if (li === m.curLine) R(g, X + 18, yy, SCR.w - 18, 1, P.edHi);
      R(g, X + 19 + (li + 1 < 10 ? 2 : 0), yy, li + 1 < 10 ? 1 : 3, 1, li === m.curLine ? P.mut : P.dim);
      let cx = 0;
      for (const tk of ln) {
        const len = tk.t.length;
        if (tk.c !== 'plain' || tk.t.trim()) {
          // bloques: los espacios dentro del token no se pintan
          const s = tk.t;
          let a = 0;
          while (a < len) {
            while (a < len && s[a] === ' ') a++;
            let b = a; while (b < len && s[b] !== ' ') b++;
            if (b > a && cx + a < LAY.maxCols) R(g, X + LAY.code + cx + a, yy, Math.min(b - a, LAY.maxCols - cx - a), 1, col[tk.c] || col.plain);
            a = b;
          }
        }
        cx += len;
      }
      if (li === m.curLine && m.blink) R(g, X + LAY.code + Math.min(cx, LAY.maxCols), yy, 1, 1, P.accent);
    }
    // minimapa
    for (let r = 0; r < Math.min(m.lines.length, 24); r++) {
      const w = m.lines[r].reduce((a, b) => a + b.t.length, 0);
      if (w) R(g, X + 91, Y + 4 + r * 2, Math.max(1, Math.min(4, (w / 12) | 0)), 1, '#34342e');
    }
    // barra de estado
    R(g, X, Y + 52, SCR.w, 2, P.bar);
    R(g, X + 1, Y + 52, 6, 2, '#3a3226');
    R(g, X + 2, Y + 53, 4, 1, P.accent);
    R(g, X + 70, Y + 53, 8, 1, P.dim); R(g, X + 82, Y + 53, 10, 1, P.dim);
    // reflejo del cristal
    g.globalAlpha = 0.035; g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(OX + X + 50, OY + Y); g.lineTo(OX + X + 70, OY + Y); g.lineTo(OX + X + 40, OY + Y + SCR.h); g.lineTo(OX + X + 20, OY + Y + SCR.h); g.fill();
    g.globalAlpha = 1;
  }

  // Alta resolución (384x216)
  const HI = makeLayer(SCR.w * 4, SCR.h * 4);
  let hiKey = '';
  function text(g, s, x, y, colr) {
    g.fillStyle = colr;
    for (let i = 0; i < s.length; i++) {
      const pts = KN.glyph(s[i]);
      for (const [px, py] of pts) g.fillRect(x + i * 4 + px, y + py, 1, 1);
    }
  }
  function drawScreenHi(t) {
    const m = screenModel(t);
    const key = Typer.version + '|' + m.blink;
    if (key === hiKey) return;
    hiKey = key;
    const g = HI.g, col = COLORS();
    const U = 4;
    g.fillStyle = P.ed; g.fillRect(0, 0, 384, 216);
    g.fillStyle = P.bar; g.fillRect(0, 0, LAY.act * U, 216);
    // iconos actividad
    g.fillStyle = P.mut; g.fillRect(3, 18, 6, 7); g.fillStyle = P.bar; g.fillRect(4, 19, 3, 5);
    g.fillStyle = P.dim; g.fillRect(3, 34, 5, 5); g.fillRect(7, 38, 2, 2); g.fillRect(4, 50, 1, 7); g.fillRect(7, 50, 1, 4); g.fillRect(4, 56, 4, 1);
    g.fillStyle = P.accent; g.fillRect(0, 17, 1, 9);
    // sidebar
    g.fillStyle = P.side; g.fillRect(LAY.act * U, 0, LAY.side * U, 216);
    text(g, 'PORTFOLIO', LAY.act * U + 3, 5, P.dim);
    SIDE_FILES.forEach((f, i) => {
      const yy = (LAY.top + 1 + i * 2) * U;
      if (i === ACTIVE_SIDE) { g.fillStyle = P.sel; g.fillRect(LAY.act * U, yy - 2, LAY.side * U, 9); }
      text(g, f.slice(0, 14), LAY.act * U + 3, yy, i === ACTIVE_SIDE ? '#d9d0bf' : P.mut);
    });
    // pestañas
    g.fillStyle = P.bar; g.fillRect(18 * U, 0, 384 - 18 * U, 12);
    g.fillStyle = P.ed; g.fillRect(18 * U, 0, 16 * U, 12);
    g.fillStyle = P.accent; g.fillRect(18 * U, 0, 16 * U, 1);
    text(g, 'KEVIN.TS', 18 * U + 5, 4, '#d9d0bf');
    text(g, Typer.saved ? 'X' : '•', 18 * U + 54, 4, P.mut);
    text(g, 'README.MD', 34 * U + 5, 4, P.dim);
    // código
    for (let r = 0; r < LAY.rows; r++) {
      const li = m.scroll + r; const ln = m.lines[li];
      if (!ln) break;
      const yy = (LAY.top + r * 2) * U;
      if (li === m.curLine) { g.fillStyle = P.edHi; g.fillRect(18 * U, yy - 2, (SCR.w - 18) * U, 9); }
      const num = String(li + 1);
      text(g, num, (22 * U) - num.length * 4, yy, li === m.curLine ? P.mut : P.dim);
      let cx = 0;
      for (const tk of ln) {
        const s = tk.t.slice(0, Math.max(0, LAY.maxCols - cx));
        text(g, s, (LAY.code + cx) * U, yy, col[tk.c] || col.plain);
        cx += tk.t.length;
      }
      if (li === m.curLine && m.blink) { g.fillStyle = P.accent; g.fillRect((LAY.code + Math.min(cx, LAY.maxCols)) * U, yy - 1, 1, 7); }
    }
    // minimapa
    for (let r = 0; r < Math.min(m.lines.length, 40); r++) {
      let cx = 0;
      for (const tk of m.lines[r]) {
        if (tk.t.trim()) { g.fillStyle = (col[tk.c] || col.plain) + '55'; g.fillRect(91 * U + cx / 3, 16 + r * 2, Math.max(1, tk.t.length / 3), 1); }
        cx += tk.t.length;
      }
    }
    // estado
    g.fillStyle = P.bar; g.fillRect(0, 208, 384, 8);
    text(g, 'MAIN', 6, 210, P.accent);
    text(g, 'LN ' + (m.curLine + 1) + '  TYPESCRIPT  UTF-8', 250, 210, P.mut);
  }

  /* ------------------------------------------------------------------------
     MOTOR
     ------------------------------------------------------------------------ */
  let out, ctx, bgStatic, deskStatic, bgL, deskL, personL;
  const personState = { headDX: 0, nextLook: 0, pressL: false, pressR: false, tL: 0, tR: 0 };
  let keyFlash = null, keyFlashT = 0, flash = 0, dust = [];
  const LEFT = new Set('qwertasdfgzxcvb12345`~!@#$%'.split(''));
  let onKey = null;

  function init(canvas) {
    out = canvas;
    ctx = out.getContext('2d');
    seed = 1337;
    bgStatic = makeLayer(); drawBgStatic(bgStatic.g);
    deskStatic = makeLayer(); drawDeskStatic(deskStatic.g);
    bgL = makeLayer(); deskL = makeLayer(); personL = makeLayer();
    Typer.init(KN.sceneCode);
    for (let i = 0; i < 46; i++) dust.push({ x: 70 + rnd() * 190, y: 10 + rnd() * 100, d: 0.8 + rnd() * 1.6, s: rnd() * 10, v: 0.6 + rnd() });
    resize();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    out.width = Math.round(innerWidth * dpr);
    out.height = Math.round(innerHeight * dpr);
    ctx.imageSmoothingEnabled = false;
  }

  function emitKey(kind, ch) {
    const now = performance.now();
    let hand = 'R';
    if (kind === 'key') hand = LEFT.has((ch || '').toLowerCase()) ? 'L' : 'R';
    if (kind === 'space') hand = Math.random() < 0.5 ? 'L' : 'R';
    if (kind === 'save') {
      personState.pressL = true; personState.tL = now + 160;
      setTimeout(() => { personState.pressR = true; personState.tR = performance.now() + 120; }, 90);
    } else if (hand === 'L') { personState.pressL = true; personState.tL = now + 85; }
    else { personState.pressR = true; personState.tR = now + 85; }
    // tecla iluminada aproximada
    const col = hand === 'L' ? 1 + ((Math.random() * 8) | 0) : 11 + ((Math.random() * 8) | 0);
    keyFlash = kind === 'space' ? { x: KB.x + 40, y: KB.y + 7 } : { x: KB.x + 3 + col * 4, y: KB.y + 2 + ((Math.random() * 3) | 0) * 2 };
    keyFlashT = now + 90;
    if (onKey) onKey(kind, hand);
  }

  // zoom: 0..1 (ya suavizado), dissolve: 0..1, typing: bool
  function render(zoom, t, opts = {}) {
    const now = performance.now();
    const W = out.width, H = out.height;
    if (opts.typing !== false) Typer.update(now, emitKey);
    if (now > personState.tL) personState.pressL = false;
    if (now > personState.tR) personState.pressR = false;
    if (now > keyFlashT) keyFlash = null;
    if (now > personState.nextLook) {
      personState.headDX = Math.random() < 0.7 ? 0 : Math.random() < 0.5 ? -1 : 1;
      personState.nextLook = now + 1800 + Math.random() * 4000;
    }
    flash = Math.max(0, flash - 0.04);

    // Cámara
    const portrait = W / H < 1;
    let s0 = Math.max(W / 320, H / 180);
    s0 = Math.min(s0, W / (portrait ? 150 : 200));
    const sEnd = Math.max(W / SCR.w, H / SCR.h) * 1.03;
    const S = sEnd / s0;
    const kd = Math.pow(S, zoom);
    const kp = Math.pow(kd, 2.6);
    const kb = Math.pow(kd, 0.72);
    const start = portrait ? { x: 160, y: 84 } : { x: 160, y: 88 };
    const pan = smooth(clamp(zoom * 1.25, 0, 1));
    const cx = lerp(start.x, FOCUS.x, pan), cy = lerp(start.y, FOCUS.y, pan);

    // Componer capas
    bgL.g.drawImage(bgStatic.c, 0, 0); drawBgDynamic(bgL.g, t, flash);
    deskL.g.clearRect(0, 0, LW, LH); deskL.g.drawImage(deskStatic.c, 0, 0); drawDeskDynamic(deskL.g, t, keyFlash); drawScreenLo(deskL.g, t);

    ctx.fillStyle = '#070606'; ctx.fillRect(0, 0, W, H);
    const place = (layer, k) => {
      const scl = s0 * k;
      const x = Math.round(W / 2 + (-OX - cx) * scl), y = Math.round(H / 2 + (-OY - cy) * scl);
      ctx.drawImage(layer.c, x, y, Math.round(LW * scl), Math.round(LH * scl));
      return { scl, x, y };
    };
    place(bgL, kb);
    const d = place(deskL, kd);

    // Pantalla en alta resolución cuando nos acercamos
    const ppx = (s0 * kd) / 4;
    const hiA = clamp((ppx - 1.1) / 1.4, 0, 1);
    if (hiA > 0) {
      drawScreenHi(t);
      ctx.globalAlpha = hiA;
      ctx.drawImage(HI.c, Math.round(W / 2 + (SCR.x - cx) * d.scl), Math.round(H / 2 + (SCR.y - cy) * d.scl), Math.round(SCR.w * d.scl), Math.round(SCR.h * d.scl));
      ctx.globalAlpha = 1;
    }

    // Polvo flotando en la luz
    for (const p of dust) {
      const k = Math.pow(kd, p.d);
      const scl = s0 * k;
      const px = p.x + Math.sin(t * 0.3 * p.v + p.s) * 6, py = p.y - ((t * 1.5 * p.v + p.s * 10) % 110) + 50;
      const sx = W / 2 + (px - cx) * scl, sy = H / 2 + (py - cy) * scl;
      if (sx < -50 || sy < -50 || sx > W + 50 || sy > H + 50) continue;
      const light = Math.exp(-(((px - 160) / 70) ** 2 + ((py - 60) / 45) ** 2));
      const a = light * 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + p.s)) * clamp(1 - zoom / 0.55, 0, 1);
      if (a < 0.02) continue;
      ctx.globalAlpha = a; ctx.fillStyle = '#c9bb9a';
      const sz = Math.max(1, Math.round(s0 * k * 0.9));
      ctx.fillRect(Math.round(sx), Math.round(sy), sz, sz);
    }
    ctx.globalAlpha = 1;

    // Persona (la más cercana a cámara)
    const headScreenY = H / 2 + (HOOD_TOP - cy) * s0 * kp;
    if (headScreenY < H + 10) {
      drawPerson(personL.g, t, personState);
      place(personL, kp);
    }

    // Disolución en bloques hacia el IDE real
    if (opts.dissolve > 0) {
      const bs = Math.ceil(Math.max(W, H) / 28);
      const cols = Math.ceil(W / bs), rows = Math.ceil(H / bs);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const h = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
          const dx = (i - cols / 2) / cols, dy = (j - rows / 2) / rows;
          const thr = Math.abs(h) * 0.65 + Math.sqrt(dx * dx + dy * dy) * 0.5;
          if (thr < opts.dissolve * 1.05) ctx.clearRect(i * bs, j * bs, bs, bs);
        }
    }
  }

  KN.Scene = {
    init, resize, render,
    set onKey(fn) { onKey = fn; },
    lightning() { flash = 1; setTimeout(() => (flash = 0.8), 140); },
  };
})();
