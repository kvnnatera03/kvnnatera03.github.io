/* ==========================================================================
   ide.js — el entorno de desarrollo navegable (DOM real, accesible)
   ========================================================================== */
(function () {
  'use strict';
  const KN = (window.KN = window.KN || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => KN.escapeHtml(String(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 760;

  /* ---------- Iconos pixel (ASCII → SVG) -------------------------------- */
  const ICONS = {
    files: ['..######....', '..#....##...', '..#....#.#..', '..#....####.', '..#.......#.', '..#.####..#.', '..#.......#.', '..#.#####.#.', '..#.......#.', '..#.###...#.', '..#.......#.', '..#########.'],
    search: ['...####.....', '..#....#....', '.#......#...', '.#......#...', '.#......#...', '.#......#...', '..#....#....', '...#####....', '.......##...', '........##..', '.........##.', '..........#.'],
    git: ['.##.....##..', '.##.....##..', '..#......#..', '..#......#..', '..#.....#...', '..#....#....', '..#..##.....', '..###.......', '..#.........', '..#.........', '.##.........', '.##.........'],
    ext: ['####.####...', '#..#.#..#...', '#..#.#..#...', '####.####...', '.............', '####..####..', '#..#.#...#..', '#..#.#...#..', '####..####..', '............', '............', '............'],
    term: ['############', '#..........#', '#.#........#', '#..#.......#', '#...#......#', '#..#.......#', '#.#..####..#', '#..........#', '#..........#', '############', '............', '............'],
    sound: ['.....#......', '....##...#..', '...###....#.', '####.#..#..#', '####.#...#.#', '####.#...#.#', '####.#..#..#', '...###....#.', '....##...#..', '.....#......', '............', '............'],
    mute: ['.....#......', '....##......', '...###......', '####.#.#...#', '####.#..#.#.', '####.#...#..', '####.#..#.#.', '...###.#...#', '....##......', '.....#......', '............', '............'],
    exit: ['....########', '....#......#', '....#......#', '..#.#......#', '.##.#......#', '#########..#', '.##.#......#', '..#.#......#', '....#......#', '....#......#', '....########', '............'],
    logo: ['...#....#...', '..#......#..', '.#...#...#..', '#....#....#.', '#...#.....#.', '.#..#....#..', '..#.#...#...', '...#....#...', '............', '............', '............', '............'],
    chev: ['.#...', '.##..', '.###.', '.##..', '.#...'],
    mail: ['############', '##........##', '#.#......#.#', '#..#....#..#', '#...####...#', '#..........#', '############', '............', '............', '............', '............', '............'],
  };
  function svg(name) {
    const rows = ICONS[name]; if (!rows) return '';
    const h = rows.length, w = rows[0].length;
    let r = '';
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${r}</svg>`;
  }
  KN.icon = svg;
  function paintIcons(root = document) { $$('[data-icon]', root).forEach((el) => { if (!el.dataset.painted) { el.innerHTML = svg(el.dataset.icon); el.dataset.painted = 1; } }); }

  /* ---------- Utilidades de fechas -------------------------------------- */
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const parseYM = (s) => { const [y, m] = s.split('-').map(Number); return { y, m: m || 1 }; };
  const now = new Date();
  const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const fmtYM = (s) => { const d = parseYM(s); return `${MES[d.m - 1]} ${d.y}`; };
  const months = (a, b) => (b.y - a.y) * 12 + (b.m - a.m);
  function duration(start, end) {
    const m = Math.max(1, months(parseYM(start), end ? parseYM(end) : nowYM));
    const y = Math.floor(m / 12), r = m % 12;
    const parts = [];
    if (y) parts.push(`${y} año${y > 1 ? 's' : ''}`);
    if (r) parts.push(`${r} mes${r > 1 ? 'es' : ''}`);
    return parts.join(' ');
  }
  const period = (e) => `${fmtYM(e.start)} — ${e.end ? fmtYM(e.end) : 'Actualidad'}`;
  const firstStart = KN.experiences.map((e) => e.start).sort()[0];
  const YEARS = Math.floor((months(parseYM(firstStart), nowYM) - 1) / 12);

  /* ---------- Modelo de archivos ---------------------------------------- */
  const FILES = {};
  KN.files.forEach((f) => { f.content = f.content.replace(/\{\{years\}\}/g, YEARS); FILES[f.path] = f; });
  const EXP_BY_FILE = {}; KN.experiences.forEach((e) => (EXP_BY_FILE[e.file] = e));
  const FI = {
    md: ['MD', '#c9a063'], ts: ['TS', '#7f9fb8'], dart: ['DT', '#76aaa5'], php: ['PHP', '#9a94be'], js: ['JS', '#d2b36a'],
    json: ['{}', '#d2b36a'], yml: ['YML', '#c07a58'], sh: ['$_', '#9fae7c'], welcome: ['KN', '#d8ae62'],
  };
  const LANG_NAME = { md: 'Markdown', ts: 'TypeScript', dart: 'Dart', php: 'PHP', js: 'JavaScript', json: 'JSON', yml: 'YAML', sh: 'Shell Script', welcome: 'Bienvenida' };
  const fileIcon = (lang) => { const [t, c] = FI[lang] || ['··', '#888']; return `<span class="fi" style="background:${c}">${t}</span>`; };
  const baseName = (p) => (p === 'welcome' ? 'Bienvenida' : p.split('/').pop());
  const langOf = (p) => (p === 'welcome' ? 'welcome' : FILES[p].lang);

  /* ---------- Estado ---------------------------------------------------- */
  const S = { open: [], active: null, typed: new Set(), preview: false, typing: null, hist: [], histI: 0 };
  let els = {};
  const hooks = { onExit: () => {}, onSound: () => {}, sfx: () => {} };
  const sfx = (n) => hooks.sfx(n);

  /* ---------- Árbol de archivos ----------------------------------------- */
  function buildTree() {
    const t = els.tree;
    const item = (path, depth) => {
      const f = FILES[path], e = EXP_BY_FILE[path];
      const meta = e ? `<span class="meta ${e.end ? '' : 'is-current'}">${String(parseYM(e.start).y).slice(2)}–${e.end ? String(parseYM(e.end).y).slice(2) : 'hoy'}</span>` : '';
      return `<li role="none"><button class="tree-item" role="treeitem" data-open="${path}" style="padding-left:${14 + depth * 14}px">${fileIcon(f.lang)}<span>${esc(baseName(path))}</span>${meta}</button></li>`;
    };
    const root = KN.files.filter((f) => !f.path.includes('/'));
    const exp = KN.files.filter((f) => f.path.startsWith('experience/')).sort((a, b) => b.path.localeCompare(a.path));
    let html = item('README.md', 0);
    html += `<li role="none"><button class="tree-item is-open" role="treeitem" aria-expanded="true" data-folder="experience" style="padding-left:8px"><span class="ico twisty" data-icon="chev"></span><span class="fi" style="background:#4a4236;color:#d8ae62">▤</span><span>experience</span><span class="meta">${exp.length} trabajos</span></button>
      <ul class="tree-children" role="group">${exp.map((f) => item(f.path, 1)).join('')}</ul></li>`;
    html += root.filter((f) => f.path !== 'README.md').map((f) => item(f.path, 0)).join('');
    t.innerHTML = html;
    paintIcons(t);
  }

  /* ---------- Pestañas -------------------------------------------------- */
  function renderTabs() {
    els.tabs.innerHTML = S.open.map((p) => `
      <div class="tab ${p === S.active ? 'is-active' : ''}" role="tab" aria-selected="${p === S.active}" data-tab="${p}" title="${esc(p)}" tabindex="0">
        ${fileIcon(langOf(p))}<span>${esc(baseName(p))}</span>
        <button class="x" data-close="${p}" aria-label="Cerrar ${esc(baseName(p))}">✕</button>
      </div>`).join('');
    const act = $('.tab.is-active', els.tabs);
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------- Editor ---------------------------------------------------- */
  function tokensHtml(tokens, limit = Infinity) {
    let out = '', n = 0;
    for (const tk of tokens) {
      if (n >= limit) break;
      const s = tk.t.slice(0, limit - n);
      n += s.length;
      let h = esc(s);
      if (tk.c === 'link' && s === tk.t) {
        const m = tk.t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) h = `<a class="tk-link-a" href="${esc(m[2])}" target="_blank" rel="noopener">${esc(tk.t)}</a>`;
      }
      out += tk.c === 'plain' ? h : `<span class="tk-${tk.c}">${h}</span>`;
    }
    return out;
  }

  function renderWelcome() {
    const exps = KN.experiences.map((e) => `
      <li><button class="w-job" data-open="${e.file}">
        ${fileIcon(FILES[e.file].lang)}
        <span class="w-job-t">${esc(e.role)} <small>@ ${esc(e.company)}</small></span>
        <span class="w-job-p ${e.end ? '' : 'is-current'}">${period(e)}<br>${duration(e.start, e.end)} · ${esc(e.mode)}</span>
        <span class="w-job-s">${esc(e.summary)}</span>
        <span class="chips">${e.stack.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</span>
      </button></li>`).join('');
    const pr = KN.profile;
    return `<div class="welcome">
      <span class="w-kicker"><i class="dot"></i> Abierto a nuevos proyectos</span>
      <h1 class="w-title">${esc(pr.name)}</h1>
      <p class="w-role">${esc(pr.role)} · Web &amp; Mobile</p>
      <p class="w-bio">¡Hola! Llevo más de <b>${YEARS} años</b> haciendo webs y apps. Empecé en <b>Venezuela</b> como frontend, me enamoré de <b>Flutter</b> y hoy soy full-stack en <b>${esc(KN.experiences[0].company)}</b>, donde toco <b>Angular</b>, <b>Flutter</b> y <b>Django</b>.<br>Cada archivo de <b>experience/</b> es uno de mis trabajos: ábrelo y léelo como código, o dale a <b>▶ Ejecutar</b>.</p>
      <div class="w-cta">
        <button class="px-btn px-btn--primary" data-open="${KN.experiences[0].file}">Mira qué hago ahora</button>
        <a class="px-btn" href="mailto:${esc(pr.email)}?subject=Hola%20Kevin"><span class="ico" data-icon="mail"></span> Escríbeme</a>
        <button class="px-btn" data-cmd="terminal">&gt;_ Terminal</button>
      </div>
      <div class="w-stats">
        <div class="w-stat"><b>${YEARS}+</b><span>años de experiencia</span></div>
        <div class="w-stat"><b>${KN.experiences.length}</b><span>empresas</span></div>
        <div class="w-stat"><b>Web+App</b><span>Angular · Flutter</span></div>
        <div class="w-stat"><b>${KN.skills.length}</b><span>tecnologías</span></div>
      </div>
      <div class="w-grid">
        <section><h3 class="w-h">experience/ — por dónde he pasado</h3><ul class="w-jobs">${exps}</ul></section>
        <section>
          <h3 class="w-h">Atajos</h3>
          <ul class="w-keys">
            <li><span>Ir a archivo</span><span><kbd>Ctrl</kbd> <kbd>P</kbd></span></li>
            <li><span>Terminal</span><span><kbd>Ctrl</kbd> <kbd>J</kbd></span></li>
            <li><span>Barra lateral</span><span><kbd>Ctrl</kbd> <kbd>B</kbd></span></li>
            <li><span>Buscar en todo</span><span><kbd>Ctrl</kbd> <kbd>⇧</kbd> <kbd>F</kbd></span></li>
          </ul>
          <h3 class="w-h">Hablemos</h3>
          <div class="w-links">
            <a href="mailto:${esc(pr.email)}"><span>email</span>${esc(pr.email)}</a>
            <a href="tel:${esc(pr.phone)}"><span>teléfono</span>${esc(pr.phoneDisplay)}</a>
            <a href="${esc(pr.github)}" target="_blank" rel="noopener"><span>github</span>${esc(pr.github.replace(/^https?:\/\/(www\.)?/, ''))}</a>
            <a href="${esc(pr.linkedin)}" target="_blank" rel="noopener"><span>linkedin</span>in/kevin-natera</a>
          </div>
        </section>
      </div>
    </div>`;
  }

  function mdToHtml(src) {
    const inline = (s) => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    let html = '', list = null, para = [];
    const close = () => {
      if (list) { html += `</${list}>`; list = null; }
      if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; }
    };
    src.split('\n').forEach((l) => {
      let m;
      if ((m = l.match(/^(#{1,3})\s(.*)/))) { close(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
      else if ((m = l.match(/^>\s?(.*)/))) { close(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
      else if ((m = l.match(/^[-*]\s(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\d+\.\s(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if (!l.trim()) close();
      else { if (list) { html += `</${list}>`; list = null; } para.push(l); }
    });
    close();
    return `<article class="md">${html}</article>`;
  }

  function renderEditor(path, opts = {}) {
    stopTyping();
    const ed = els.editor;
    ed.scrollTop = 0;
    if (path === 'welcome') {
      ed.innerHTML = renderWelcome(); paintIcons(ed);
      drawMinimap(); return;
    }
    const f = FILES[path];
    if (S.preview && f.lang === 'md') { ed.innerHTML = mdToHtml(f.content); drawMinimap(); return; }
    const lines = KN.highlight(f.content, f.lang);
    ed.innerHTML = lines.map((_, i) => `<div class="row" data-line="${i + 1}"><span class="ln">${i + 1}</span><span class="src"></span></div>`).join('');
    const rows = $$('.row', ed);
    const srcs = rows.map((r) => r.lastChild);
    const fill = () => lines.forEach((ln, i) => (srcs[i].innerHTML = tokensHtml(ln) || ' '));
    const animate = !reduced && !S.typed.has(path) && !opts.instant;
    S.typed.add(path);
    if (!animate) { fill(); afterRender(opts); return; }

    // Efecto máquina de escribir
    const lens = lines.map((ln) => ln.reduce((a, t) => a + t.t.length, 0) + 1);
    const total = lens.reduce((a, b) => a + b, 0);
    const dur = Math.min(1500, 350 + total * 0.9);
    const t0 = performance.now();
    let lastTick = 0, doneLines = 0;
    const cursor = '<span class="cursor"></span>';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      let n = Math.floor(total * (1 - Math.pow(1 - k, 1.6)));
      let li = 0;
      while (li < lines.length && n >= lens[li]) { n -= lens[li]; li++; }
      for (let i = doneLines; i < Math.min(li, lines.length); i++) srcs[i].innerHTML = tokensHtml(lines[i]) || ' ';
      doneLines = Math.max(doneLines, li);
      if (li < lines.length) {
        srcs[li].innerHTML = tokensHtml(lines[li], n) + cursor;
        rows.forEach((r, i) => r.classList.toggle('is-cur', i === li));
        const rowEl = rows[li];
        if (rowEl.offsetTop > ed.scrollTop + ed.clientHeight * 0.75 && ed.scrollTop < 40) { /* no auto-scroll largo */ }
      }
      if (now - lastTick > 45) { sfx('tick'); lastTick = now; }
      if (k < 1) S.typing = requestAnimationFrame(step);
      else { S.typing = null; fill(); afterRender(opts); }
    };
    S.typing = requestAnimationFrame(step);
    S.finishTyping = () => { if (S.typing) { cancelAnimationFrame(S.typing); S.typing = null; fill(); afterRender(opts); } };
  }
  function stopTyping() { if (S.typing) { cancelAnimationFrame(S.typing); S.typing = null; } }
  function afterRender(opts) {
    $$('.row.is-cur', els.editor).forEach((r) => r.classList.remove('is-cur'));
    setCursor(opts.line || 1);
    if (opts.line) gotoLine(opts.line);
    drawMinimap();
  }
  function setCursor(line, col = 1) {
    const rows = $$('.row', els.editor);
    rows.forEach((r) => r.classList.toggle('is-cur', +r.dataset.line === line));
    els.sbPos.textContent = `Ln ${line}, Col ${col}`;
  }
  function gotoLine(line) {
    const row = $(`.row[data-line="${line}"]`, els.editor);
    if (!row) return;
    els.editor.scrollTop = Math.max(0, row.offsetTop - els.editor.clientHeight * 0.3);
    row.classList.remove('is-flash'); void row.offsetWidth; row.classList.add('is-flash');
    setCursor(line);
  }

  /* ---------- Minimapa -------------------------------------------------- */
  function drawMinimap() {
    const c = els.minimap;
    if (!c || getComputedStyle(c).display === 'none') return;
    const h = Math.max(50, c.clientHeight | 0);
    if (c.height !== h) c.height = h;
    c.width = 70;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const f = FILES[S.active];
    if (!f || S.preview) return;
    const lines = KN.highlight(f.content, f.lang);
    const col = KN.tokenColors;
    lines.forEach((ln, i) => {
      let x = 6;
      ln.forEach((tk) => {
        const len = tk.t.length * 0.62;
        if (tk.t.trim()) { g.fillStyle = col[tk.c] || col.plain; g.globalAlpha = 0.55; g.fillRect(Math.round(x), 6 + i * 3, Math.max(1, Math.round(len)), 2); }
        x += len;
      });
    });
    g.globalAlpha = 1;
    const ed = els.editor;
    const ratio = (lines.length * 3) / Math.max(1, ed.scrollHeight - ed.clientHeight * 0.4);
    const vy = 6 + ed.scrollTop * ratio, vh = Math.max(12, ed.clientHeight * ratio);
    g.fillStyle = 'rgba(216,174,98,.08)'; g.fillRect(0, vy, 70, vh);
    g.fillStyle = 'rgba(216,174,98,.35)'; g.fillRect(0, vy, 2, vh);
  }

  /* ---------- Esquema --------------------------------------------------- */
  function renderOutline(path) {
    const out = [];
    if (path !== 'welcome') {
      const f = FILES[path];
      f.content.split('\n').forEach((l, i) => {
        let m;
        if (f.lang === 'md' && (m = l.match(/^#{1,3}\s(.*)/))) out.push(['#', m[1], i + 1]);
        else if ((m = l.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/))) out.push(['C', m[1], i + 1]);
        else if ((m = l.match(/^\s*(?:export\s+)?const\s+(\w+)(?![\w(])/))) out.push(['v', m[1], i + 1]);
        else if ((m = l.match(/function\s+(\w+)/))) out.push(['ƒ', m[1], i + 1]);
        else if ((m = l.match(/get\s+(\w+)\s*=>/))) out.push(['ƒ', m[1], i + 1]);
        else if (f.lang === 'json' && (m = l.match(/^\s{2}"(\w+)"/))) out.push(['{', m[1], i + 1]);
        else if (f.lang === 'yml' && (m = l.match(/^(\w+):/))) out.push(['-', m[1], i + 1]);
        else if (f.lang === 'sh' && (m = l.match(/^(\w+)=/))) out.push(['$', m[1], i + 1]);
      });
    }
    els.outline.innerHTML = out.length
      ? out.map(([k, n, l]) => `<li><button data-line="${l}"><span class="o-kind">${esc(k)}</span>${esc(n)}</button></li>`).join('')
      : '<li style="padding:4px 16px;color:var(--dim);font-size:12px">Sin símbolos</li>';
  }

  /* ---------- Abrir / cerrar ------------------------------------------- */
  function openFile(path, opts = {}) {
    if (path !== 'welcome' && !FILES[path]) return false;
    if (!S.open.includes(path)) S.open.push(path);
    const changed = S.active !== path;
    S.active = path;
    if (changed && !opts.keepPreview) S.preview = false;
    renderTabs();
    renderEditor(path, opts);
    $$('.tree-item[data-open]', els.tree).forEach((b) => b.classList.toggle('is-active', b.dataset.open === path));
    const lang = langOf(path);
    els.tbFile.textContent = path === 'welcome' ? 'Bienvenida' : path;
    els.sbLang.textContent = LANG_NAME[lang];
    els.crumbs.innerHTML = path === 'welcome' ? '<span>kevin-natera</span> › <span>Bienvenida</span>'
      : '<span>kevin-natera</span> › ' + path.split('/').map((p) => `<span>${esc(p)}</span>`).join(' › ');
    els.btnRun.hidden = !(EXP_BY_FILE[path] || lang === 'sh');
    els.btnPreview.hidden = lang !== 'md';
    els.btnPreview.classList.toggle('is-on', S.preview);
    els.btnPreview.textContent = S.preview ? 'Ver código' : 'Vista previa';
    renderOutline(path);
    if (changed && !opts.silent) sfx('open');
    if (isMobile()) toggleSidebar(false);
    try { history.replaceState(null, '', path === 'welcome' ? location.pathname + location.search : '#' + path); } catch (e) { /* noop */ }
    return true;
  }
  function closeFile(path) {
    const i = S.open.indexOf(path);
    if (i < 0) return;
    S.open.splice(i, 1);
    sfx('close');
    if (S.active === path) {
      const next = S.open[Math.max(0, i - 1)];
      if (next) openFile(next, { silent: true });
      else { S.active = null; openFile('welcome', { silent: true }); }
    } else renderTabs();
  }

  /* ---------- Paneles laterales ---------------------------------------- */
  function showPanel(name) {
    const ide = els.ide;
    const already = $(`.act[data-panel="${name}"]`).classList.contains('is-active');
    if (isMobile()) {
      if (already && ide.classList.contains('side-open')) { toggleSidebar(false); return; }
      toggleSidebar(true);
    } else if (already && !ide.classList.contains('no-sidebar')) { toggleSidebar(false); return; }
    else toggleSidebar(true);
    $$('.act[data-panel]').forEach((b) => b.classList.toggle('is-active', b.dataset.panel === name));
    $$('.panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
    sfx('click');
    if (name === 'search') els.searchInput.focus({ preventScroll: true });
  }
  function toggleSidebar(on) {
    const ide = els.ide;
    if (isMobile()) { ide.classList.toggle('side-open', on ?? !ide.classList.contains('side-open')); ide.classList.remove('no-sidebar'); }
    else ide.classList.toggle('no-sidebar', on === undefined ? undefined : !on);
    setTimeout(drawMinimap, 30);
  }

  function renderGit() {
    els.gitLog.innerHTML = KN.commits.map((c) => `
      <li><button data-open="${c.file}">
        <span class="git-node"><i></i></span>
        <span class="git-msg">${esc(c.msg)}${c.tag ? `<span class="git-tag">${esc(c.tag)}</span>` : ''}</span>
        <span class="git-meta"><b>${c.hash}</b> · ${c.date.length > 4 ? fmtYM(c.date) : c.date} · Kevin Natera</span>
      </button></li>`).join('');
  }
  function renderExt() {
    els.extCount.textContent = KN.skills.length;
    els.extList.innerHTML = KN.skills.map((s) => `
      <li>
        <span class="ext-ico" style="background:${s.color}">${esc(s.abbr)}</span>
        <div>
          <div class="ext-name">${esc(s.name)} <small>${esc(s.cat)}</small></div>
          <div class="ext-desc">${esc(s.desc)}</div>
          <div class="ext-level" aria-label="Nivel ${s.level} de 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= s.level ? 'on' : ''}"></i>`).join('')}</div>
        </div>
      </li>`).join('');
  }

  function doSearch(q) {
    q = q.trim();
    if (!q) { els.searchRes.innerHTML = ''; els.searchMeta.textContent = 'Escribe para buscar en todos los archivos.'; return; }
    const ql = q.toLowerCase();
    let total = 0, filesHit = 0, html = '';
    KN.files.forEach((f) => {
      const hits = [];
      f.content.split('\n').forEach((l, i) => { if (l.toLowerCase().includes(ql)) hits.push([i + 1, l]); });
      if (!hits.length) return;
      filesHit++; total += hits.length;
      html += `<li><div class="sr-file">${fileIcon(f.lang)} ${esc(baseName(f.path))} <span class="t-dim" style="font-weight:400">${hits.length}</span></div>`;
      hits.slice(0, 6).forEach(([ln, l]) => {
        const s = l.trim(); const idx = s.toLowerCase().indexOf(ql);
        const a = Math.max(0, idx - 18);
        const pre = esc(s.slice(a, idx)), mid = esc(s.slice(idx, idx + q.length)), post = esc(s.slice(idx + q.length, idx + q.length + 50));
        html += `<button class="sr-hit" data-open="${f.path}" data-line="${ln}">${a ? '…' : ''}${pre}<mark>${mid}</mark>${post}</button>`;
      });
      html += '</li>';
    });
    els.searchRes.innerHTML = html;
    els.searchMeta.textContent = total ? `${total} resultado${total > 1 ? 's' : ''} en ${filesHit} archivo${filesHit > 1 ? 's' : ''}` : 'Sin resultados.';
  }

  /* ---------- Terminal -------------------------------------------------- */
  function print(html, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    els.termOut.appendChild(d);
    els.termBody.scrollTop = els.termBody.scrollHeight;
  }
  function printLines(lines, delay = 35) {
    return new Promise((res) => {
      let i = 0;
      const next = () => {
        if (i >= lines.length) return res();
        const l = lines[i++];
        print(Array.isArray(l) ? l[0] : l, Array.isArray(l) ? l[1] : '');
        sfx('tick');
        setTimeout(next, reduced ? 0 : delay);
      };
      next();
    });
  }
  function toggleTerminal(on) {
    const ide = els.ide;
    const show = on ?? ide.classList.contains('no-term');
    ide.classList.toggle('no-term', !show);
    if (show && !isMobile()) setTimeout(() => els.termInput.focus({ preventScroll: true }), 40);
    if (show) { els.toast.classList.remove('is-on'); requestAnimationFrame(() => (els.termBody.scrollTop = els.termBody.scrollHeight)); }
    sfx('click');
    setTimeout(drawMinimap, 30);
  }
  function resolveFile(arg) {
    if (!arg) return null;
    const a = arg.toLowerCase().replace(/^\.\//, '');
    const all = KN.files.map((f) => f.path);
    return all.find((p) => p.toLowerCase() === a) || all.find((p) => baseName(p).toLowerCase() === a) ||
      all.find((p) => p.toLowerCase().includes(a)) || null;
  }

  function runFile(path) {
    const e = EXP_BY_FILE[path];
    const pr = KN.profile;
    toggleTerminal(true);
    print(`<span class="t-cmd"><b>$</b> run ${esc(path)}</span>`);
    if (e) {
      const bar = '─'.repeat(38);
      const ms = (Math.random() * 0.3 + 0.12).toFixed(2);
      printLines([
        [`▸ compilando ${esc(baseName(path))} … <span class="t-ok">ok</span> <span class="t-dim">(${ms}s)</span>`, 't-dim'],
        [`┌ <span class="t-acc">${esc(e.company)}</span> ${bar.slice(e.company.length)}`, 't-box'],
        [`│ ${esc(e.role)}`, 't-box'],
        [`│ ${period(e)} <span class="t-dim">· ${duration(e.start, e.end)} · ${esc(e.mode)}</span>`, 't-box'],
        [`│ <span class="t-fn">${e.stack.map(esc).join(' · ')}</span>`, 't-box'],
        [`│ ${esc(e.summary)}`, 't-box'],
        [`└ <span class="t-ok">✓ listo</span> ${e.end ? '' : '<span class="t-acc">· aquí sigo</span>'} <span class="t-dim">· ábrelo para ver el detalle</span>`, 't-box'],
      ]).then(() => sfx('success'));
    } else if (path === 'contact.sh') {
      printLines([
        `¡Hola! Soy ${esc(pr.name)}.`,
        'Si tienes un proyecto o una vacante, escríbeme sin miedo.',
        '',
        `  email     <a href="mailto:${esc(pr.email)}">${esc(pr.email)}</a>`,
        `  teléfono  <a href="tel:${esc(pr.phone)}">${esc(pr.phoneDisplay)}</a>`,
        `  github    <a href="${esc(pr.github)}" target="_blank" rel="noopener">${esc(pr.github.replace(/^https?:\/\//, ''))}</a>`,
        `  linkedin  <a href="${esc(pr.linkedin)}" target="_blank" rel="noopener">linkedin.com/in/kevin-natera</a>`,
        '',
        [`→ open mailto:${esc(pr.email)}  <span class="t-dim">(pincha en el email y me llega directo)</span>`, 't-ok'],
      ]).then(() => sfx('success'));
    }
  }

  const COMMANDS = {
    help() {
      return printLines([
        ['Esto es lo que puedes probar:', 't-acc'],
        '  <span class="t-fn">whoami</span>           quién soy, en corto',
        '  <span class="t-fn">ls</span>               lista los archivos',
        '  <span class="t-fn">open</span> &lt;archivo&gt;   abre un archivo (ej. open fandit)',
        '  <span class="t-fn">run</span> &lt;archivo&gt;    resume un trabajo (ej. run brisa)',
        '  <span class="t-fn">experience</span>       mi recorrido, año a año',
        '  <span class="t-fn">skills</span>           con qué trabajo y cuánto lo domino',
        '  <span class="t-fn">contact</span>          cómo dar conmigo',
        '  <span class="t-fn">email</span>            copia mi email al portapapeles',
        '  <span class="t-fn">phone</span>            mi teléfono',
        '  <span class="t-fn">neofetch</span>         info del "sistema"',
        '  <span class="t-fn">sound</span> [on|off]   activa o silencia el sonido',
        '  <span class="t-fn">clear</span>            limpia la terminal',
        '  <span class="t-fn">exit</span>             vuelve a la habitación',
      ], 12);
    },
    whoami() {
      const p = KN.profile;
      return printLines([`<span class="t-acc">${esc(p.name)}</span> — ${esc(p.role)}`, `${YEARS}+ años haciendo webs y apps · ${esc(p.tagline)}`, 'Empecé como frontend en Venezuela; hoy, full-stack desde España.']);
    },
    ls(arg) {
      if (arg && arg.startsWith('exp')) return printLines(KN.files.filter((f) => f.path.startsWith('experience/')).map((f) => `<span class="t-fn">${esc(baseName(f.path))}</span>`), 10);
      return printLines([KN.files.filter((f) => !f.path.includes('/')).map((f) => esc(f.path)).join('   ') + '   <span class="t-acc">experience/</span>'], 10);
    },
    open(arg) {
      const p = resolveFile(arg);
      if (!p) return print(`open: no encuentro «${esc(arg || '')}». Prueba con ls`, 't-err');
      openFile(p); print(`abriendo ${esc(p)}…`, 't-dim');
    },
    cat(arg) { return COMMANDS.open(arg); },
    code(arg) { return COMMANDS.open(arg); },
    run(arg) {
      const p = resolveFile(arg);
      if (!p || !(EXP_BY_FILE[p] || p.endsWith('.sh'))) return print(`run: eso no se puede ejecutar. Prueba con run fandit`, 't-err');
      openFile(p, { silent: true }); runFile(p);
    },
    experience() {
      return printLines(KN.experiences.map((e) => `<span class="t-acc">${String(parseYM(e.start).y)}</span> ${e.end ? '│' : '●'} ${esc(e.role)} <span class="t-dim">@</span> ${esc(e.company)} <span class="t-dim">· ${duration(e.start, e.end)}</span>`));
    },
    skills() {
      return printLines(KN.skills.map((s) => `${esc(s.name.padEnd(20, ' '))} <span class="t-acc">${'█'.repeat(s.level * 2)}</span><span class="t-dim">${'░'.repeat(10 - s.level * 2)}</span>`), 18);
    },
    contact() { runFile('contact.sh'); },
    email() {
      const e = KN.profile.email;
      (navigator.clipboard ? navigator.clipboard.writeText(e) : Promise.reject()).then(
        () => print(`<span class="t-ok">✓</span> ${esc(e)} copiado al portapapeles`),
        () => print(`<a href="mailto:${esc(e)}">${esc(e)}</a>`));
    },
    phone() { const p = KN.profile; print(`<a href="tel:${esc(p.phone)}">${esc(p.phoneDisplay)}</a>`); },
    telefono() { COMMANDS.phone(); },
    github() { window.open(KN.profile.github, '_blank', 'noopener'); print('abriendo GitHub…', 't-dim'); },
    linkedin() { window.open(KN.profile.linkedin, '_blank', 'noopener'); print('abriendo LinkedIn…', 't-dim'); },
    neofetch() {
      const p = KN.profile;
      const art = ['  ██╗  ██╗', '  ██║ ██╔╝', '  █████╔╝ ', '  ██╔═██╗ ', '  ██║  ██╗', '  ╚═╝  ╚═╝'];
      const info = [`<span class="t-acc">kevin</span>@<span class="t-acc">portfolio</span>`, '─────────────────', `<span class="t-acc">OS</span>: Full-Stack ${YEARS}.0 LTS`, `<span class="t-acc">Shell</span>: TypeScript / Dart`, `<span class="t-acc">Front</span>: Angular, HTML5, CSS3`, `<span class="t-acc">Mobile</span>: Flutter, Cordova`, `<span class="t-acc">Back</span>: Django REST, Laravel`, `<span class="t-acc">Uptime</span>: ${duration(firstStart, null)}`];
      return printLines(info.map((l, i) => `<span class="t-acc">${esc(art[i] || '          ')}</span>   ${l}`), 20);
    },
    sound(arg) { const on = arg ? arg === 'on' : !KN.Audio.enabled; hooks.onSound(on); print(`sonido ${on ? 'activado' : 'silenciado'}`, 't-dim'); },
    clear() { els.termOut.innerHTML = ''; },
    exit() { hooks.onExit(); },
    date() { print(new Date().toLocaleString('es-ES')); },
    pwd() { print('/home/kevin/portfolio'); },
    sudo() { print('Buen intento, pero aquí no hay sudo. Lo que sí hay es mi email: <a href="mailto:' + esc(KN.profile.email) + '">' + esc(KN.profile.email) + '</a>', 't-err'); },
    hire() { print('<span class="t-ok">¡Buena elección!</span> Te abro el correo…'); setTimeout(() => (location.href = `mailto:${KN.profile.email}?subject=Oportunidad%20para%20Kevin`), 500); },
    contratar() { COMMANDS.hire(); },
    echo(arg) { print(esc(arg || '')); },
  };
  function execute(raw) {
    const line = raw.trim();
    print(`<span class="t-cmd"><b>$</b> ${esc(line)}</span>`);
    if (!line) return;
    S.hist.push(line); S.histI = S.hist.length;
    const [cmd, ...rest] = line.split(/\s+/);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (fn) { sfx('click'); fn(rest.join(' ')); }
    else { sfx('error'); print(`ups, no conozco «${esc(cmd)}». Escribe <span class="t-fn">help</span> y te enseño lo que hay`, 't-err'); }
  }
  function autocomplete(v) {
    const parts = v.split(/\s+/);
    if (parts.length === 1) {
      const m = Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0]));
      if (m.length === 1) return m[0] + ' ';
      if (m.length > 1) print(m.join('   '), 't-dim');
      return v;
    }
    const last = parts.pop().toLowerCase();
    const m = KN.files.map((f) => f.path).filter((p) => p.toLowerCase().startsWith(last) || baseName(p).toLowerCase().startsWith(last));
    if (m.length === 1) return [...parts, m[0]].join(' ');
    if (m.length > 1) print(m.map(esc).join('   '), 't-dim');
    return v;
  }

  /* ---------- Paleta de comandos --------------------------------------- */
  const PCMDS = [
    ['Terminal: mostrar u ocultar', () => toggleTerminal()],
    ['Ver: barra lateral', () => toggleSidebar()],
    ['Sonido: activar / silenciar', () => hooks.onSound(!KN.Audio.enabled)],
    ['Contacto: escribirme un email', () => (location.href = `mailto:${KN.profile.email}`)],
    ['Ver: volver a la habitación', () => hooks.onExit()],
    ['Ejecutar: lo que hago ahora', () => { openFile(KN.experiences[0].file); runFile(KN.experiences[0].file); }],
  ];
  let palItems = [], palSel = 0;
  function openPalette(prefix = '') {
    els.palette.hidden = false;
    els.palInput.value = prefix;
    renderPalette();
    els.palInput.focus();
    sfx('click');
  }
  function closePalette() { els.palette.hidden = true; }
  function renderPalette() {
    const v = els.palInput.value;
    if (v.startsWith('>')) {
      const q = v.slice(1).trim().toLowerCase();
      palItems = PCMDS.filter(([n]) => n.toLowerCase().includes(q)).map(([n, fn]) => ({ label: n, hint: 'comando', run: fn }));
    } else {
      const q = v.trim().toLowerCase();
      const all = ['welcome', ...KN.files.map((f) => f.path)];
      palItems = all.filter((p) => !q || p.toLowerCase().includes(q) || (EXP_BY_FILE[p] && EXP_BY_FILE[p].company.toLowerCase().includes(q)))
        .map((p) => ({ label: `${fileIcon(langOf(p))} ${esc(baseName(p))}`, html: true, hint: p === 'welcome' ? '' : p, run: () => openFile(p) }));
    }
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    els.palList.innerHTML = palItems.map((it, i) => `<li class="${i === palSel ? 'is-sel' : ''}"><button data-pal="${i}">${it.html ? it.label : esc(it.label)}<small>${esc(it.hint || '')}</small></button></li>`).join('')
      || '<li style="padding:8px;color:var(--dim)">Sin coincidencias</li>';
  }

  /* ---------- Toast ----------------------------------------------------- */
  let toastT;
  function toast(html, ms = 4200) {
    els.toast.innerHTML = html; els.toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => els.toast.classList.remove('is-on'), ms);
  }

  /* ---------- Eventos --------------------------------------------------- */
  function bind() {
    const ide = els.ide;
    ide.addEventListener('click', (e) => {
      const t = e.target;
      const close = t.closest('[data-close]');
      if (close) { e.stopPropagation(); closeFile(close.dataset.close); return; }
      const op = t.closest('[data-open]');
      if (op) { const line = op.dataset.line ? +op.dataset.line : undefined; if (line && S.active === op.dataset.open) gotoLine(line); else openFile(op.dataset.open, { line, instant: !!line }); return; }
      const tab = t.closest('[data-tab]');
      if (tab) { openFile(tab.dataset.tab); return; }
      const fold = t.closest('[data-folder]');
      if (fold) {
        const open = !fold.classList.contains('is-open');
        fold.classList.toggle('is-open', open); fold.setAttribute('aria-expanded', open);
        fold.nextElementSibling.classList.toggle('is-closed', !open); sfx('click'); return;
      }
      const act = t.closest('[data-panel]');
      if (act && act.classList.contains('act')) { showPanel(act.dataset.panel); return; }
      const cmd = t.closest('[data-cmd]');
      if (cmd) {
        const c = cmd.dataset.cmd;
        if (c === 'terminal') toggleTerminal();
        else if (c === 'palette') openPalette();
        else if (c === 'clear') COMMANDS.clear();
        else if (c === 'help') { toggleTerminal(true); COMMANDS.help(); }
        else if (c === 'exit') hooks.onExit();
        else if (c === 'sound') hooks.onSound(!KN.Audio.enabled);
        return;
      }
      const ol = t.closest('.outline [data-line]');
      if (ol) { gotoLine(+ol.dataset.line); return; }
      const row = t.closest('.row');
      if (row && !S.typing) {
        const sel = getSelection(); const col = sel && sel.anchorOffset ? sel.anchorOffset + 1 : 1;
        setCursor(+row.dataset.line, col);
      }
      const pal = t.closest('[data-pal]');
      if (pal) { const it = palItems[+pal.dataset.pal]; closePalette(); it && it.run(); return; }
      if (t === els.palette) closePalette();
    });
    els.tabs.addEventListener('auxclick', (e) => { const tab = e.target.closest('[data-tab]'); if (tab && e.button === 1) closeFile(tab.dataset.tab); });
    els.tabs.addEventListener('keydown', (e) => { const tab = e.target.closest('[data-tab]'); if (tab && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openFile(tab.dataset.tab); } });
    els.editor.addEventListener('pointerdown', () => S.finishTyping && S.typing && S.finishTyping());
    els.editor.addEventListener('scroll', () => requestAnimationFrame(drawMinimap), { passive: true });
    els.minimap.addEventListener('click', (e) => {
      const f = FILES[S.active]; if (!f) return;
      const lines = f.content.split('\n').length;
      const line = Math.max(1, Math.min(lines, Math.round((e.offsetY - 6) / 3)));
      gotoLine(line);
    });
    els.scrim.addEventListener('click', () => toggleSidebar(false));
    els.btnRun.addEventListener('click', () => runFile(S.active));
    els.btnPreview.addEventListener('click', () => { S.preview = !S.preview; sfx('click'); const a = S.active; S.active = null; openFile(a, { silent: true, instant: true, keepPreview: true }); });
    els.searchInput.addEventListener('input', () => doSearch(els.searchInput.value));
    els.termBody.addEventListener('click', (e) => { if (!e.target.closest('a') && !getSelection().toString()) els.termInput.focus({ preventScroll: true }); });
    els.termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { execute(els.termInput.value); els.termInput.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (S.histI > 0) els.termInput.value = S.hist[--S.histI]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (S.histI < S.hist.length) els.termInput.value = S.hist[++S.histI] || ''; }
      else if (e.key === 'Tab') { e.preventDefault(); els.termInput.value = autocomplete(els.termInput.value); }
      else if (e.key.length === 1) sfx('type');
    });
    els.palInput.addEventListener('input', () => { palSel = 0; renderPalette(); });
    els.palInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); renderPalette(); }
      else if (e.key === 'Enter') { const it = palItems[palSel]; closePalette(); it && it.run(); }
      else if (e.key === 'Escape') closePalette();
    });
    $('#git-hire').addEventListener('click', (e) => { e.preventDefault(); location.href = `mailto:${KN.profile.email}?subject=Hola%20Kevin`; });

    document.addEventListener('keydown', (e) => {
      if (!KN.IDE.active) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'p') { e.preventDefault(); openPalette(e.shiftKey ? '>' : ''); }
      else if (mod && (k === 'j' || e.key === '`' || k === 'ñ')) { e.preventDefault(); toggleTerminal(); }
      else if (mod && k === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (mod && e.shiftKey && k === 'f') { e.preventDefault(); showPanel('search'); }
      else if (e.altKey && k === 'w') { e.preventDefault(); if (S.active) closeFile(S.active); }
      else if (e.key === 'Escape') { if (!els.palette.hidden) closePalette(); else if (ide.classList.contains('side-open')) toggleSidebar(false); }
    });
    addEventListener('resize', () => requestAnimationFrame(drawMinimap));
  }

  /* ---------- API ------------------------------------------------------- */
  KN.IDE = {
    active: false,
    init(opts = {}) {
      Object.assign(hooks, opts);
      els = {
        ide: $('#ide'), tree: $('#tree'), outline: $('#outline'), tabs: $('#tabs'), editor: $('#editor'), minimap: $('#minimap'),
        crumbs: $('#crumbs'), tbFile: $('#tb-file'), sbLang: $('#sb-lang'), sbPos: $('#sb-pos'),
        btnRun: $('#btn-run'), btnPreview: $('#btn-preview'), searchInput: $('#search-input'), searchRes: $('#search-results'),
        searchMeta: $('#search-meta'), gitLog: $('#git-log'), extList: $('#ext-list'), extCount: $('#ext-count'),
        termOut: $('#term-out'), termBody: $('#term-body'), termInput: $('#term-input'), palette: $('#palette'),
        palInput: $('#palette-input'), palList: $('#palette-list'), toast: $('#toast'), scrim: $('#sidebar-scrim'),
      };
      paintIcons();
      buildTree(); renderGit(); renderExt();
      bind();
      if (isMobile()) els.ide.classList.add('no-term');
      print(`<span class="t-acc">kevin-natera</span> portfolio <span class="t-dim">[versión ${now.getFullYear()}.${now.getMonth() + 1}]</span>`);
      print('Escribe <span class="t-fn">help</span> para ver qué puedes hacer · o prueba <span class="t-fn">run fandit</span>', 't-dim');
      const hash = decodeURIComponent(location.hash.slice(1));
      openFile('welcome', { silent: true });
      if (FILES[hash]) openFile(hash, { silent: true });
    },
    show() {
      this.active = true;
      drawMinimap();
      if (!this._greeted) {
        this._greeted = true;
        setTimeout(() => toast('<b>Psst ·</b> cada archivo de <b>experience/</b> es uno de mis trabajos. Y si abres la terminal y escribes <b>help</b>, hay más cosas.', 6500), 1200);
      }
    },
    hide() { this.active = false; closePalette(); },
    openFile, toast, drawMinimap, paintIcons,
    setSound(on) {
      $$('.sound-toggle').forEach((b) => {
        b.classList.toggle('is-off', !on);
        const ico = $('.ico', b); if (ico) { ico.innerHTML = svg(on ? 'sound' : 'mute'); }
        b.setAttribute('aria-pressed', on);
        const lbl = $('.sound-lbl', b); if (lbl) lbl.textContent = on ? 'Sonido' : 'Silencio';
      });
    },
  };
})();
