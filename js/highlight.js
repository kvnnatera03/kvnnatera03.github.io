/* ==========================================================================
   highlight.js — tokenizador ligero para ts / dart / php / json / yml / sh / md
   Devuelve un array de líneas; cada línea es un array de { t, c }.
   ========================================================================== */
(function () {
  'use strict';
  const KN = (window.KN = window.KN || {});

  // Paleta compartida con el CSS (tema "Dry Dusk")
  KN.tokenColors = {
    plain: '#d9d0bf',
    kw: '#da8c50',
    str: '#9fae7c',
    num: '#d8ae62',
    com: '#6d685c',
    fn: '#82aaa1',
    type: '#cdb883',
    prop: '#bba98f',
    punc: '#8f8779',
    op: '#b3a28a',
    deco: '#c58a78',
    var: '#d7a07e',
    const: '#c98a7a',
    head: '#d8ae62',
    bold: '#e7dccb',
    code: '#82aaa1',
    link: '#9fae7c',
    bullet: '#cf9458',
    quote: '#8f8779',
    key: '#cf9458',
  };

  const set = (s) => new Set(s.split(/\s+/));

  const LANGS = {
    ts: {
      kw: set('import export from const let var new return function class extends implements interface type async await if else for of in while switch case break default this super public private protected readonly static as'),
      consts: set('true false null undefined'),
      line: '//', block: ['/*', '*/'], quotes: '\'"`', deco: true,
    },
    dart: {
      kw: set('import class extends const final var return new if else for in this super required get set void async await static late with implements'),
      consts: set('true false null'),
      line: '//', block: ['/*', '*/'], quotes: '\'"', deco: true, dollar: true,
    },
    php: {
      kw: set('namespace use class extends public protected private function return new if else foreach as static'),
      consts: set('true false null'),
      types: set('string array int bool float void'),
      line: '//', block: ['/*', '*/'], quotes: '\'"', dollar: true,
    },
    sh: {
      kw: set('echo open if then fi for do done export local read'),
      consts: set('true false'),
      hash: true, quotes: '\'"', dollar: true,
    },
    json: { kw: new Set(), consts: set('true false null'), quotes: '"', json: true },
  };

  LANGS.js = LANGS.ts;

  const isIdStart = (ch) => /[A-Za-z_]/.test(ch);
  const isId = (ch) => /[\w]/.test(ch);

  function tokenizeCode(src, L) {
    const out = [];
    const push = (t, c) => { if (t) out.push({ t, c }); };
    let i = 0;
    const n = src.length;
    let prevSig = '';
    while (i < n) {
      const ch = src[i];
      // salto de línea
      if (ch === '\n') { push('\n', 'plain'); i++; continue; }
      // espacios
      if (ch === ' ' || ch === '\t') {
        let j = i; while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
        push(src.slice(i, j), 'plain'); i = j; continue;
      }
      // comentarios
      if (L.line && src.startsWith(L.line, i)) {
        let j = src.indexOf('\n', i); if (j < 0) j = n;
        push(src.slice(i, j), 'com'); i = j; continue;
      }
      if (L.hash && ch === '#') {
        let j = src.indexOf('\n', i); if (j < 0) j = n;
        push(src.slice(i, j), 'com'); i = j; continue;
      }
      if (L.block && src.startsWith(L.block[0], i)) {
        let j = src.indexOf(L.block[1], i + 2); j = j < 0 ? n : j + 2;
        push(src.slice(i, j), 'com'); i = j; continue;
      }
      // strings
      if (L.quotes && L.quotes.includes(ch)) {
        let j = i + 1;
        while (j < n && src[j] !== ch) {
          if (src[j] === '\\') j++;
          if (src[j] === '\n' && ch !== '`') break;
          j++;
        }
        j = Math.min(n, j + 1);
        const s = src.slice(i, j);
        if (L.json) {
          let k = j; while (src[k] === ' ') k++;
          push(s, src[k] === ':' ? 'key' : 'str');
        } else push(s, 'str');
        prevSig = ch; i = j; continue;
      }
      // decoradores / anotaciones
      if (L.deco && ch === '@' && isIdStart(src[i + 1] || '')) {
        let j = i + 1; while (j < n && isId(src[j])) j++;
        push(src.slice(i, j), 'deco'); i = j; prevSig = 'x'; continue;
      }
      // variables $x
      if (L.dollar && ch === '$' && isIdStart(src[i + 1] || '')) {
        let j = i + 1; while (j < n && isId(src[j])) j++;
        push(src.slice(i, j), 'var'); i = j; prevSig = 'x'; continue;
      }
      // números
      if (/\d/.test(ch)) {
        let j = i; while (j < n && /[\d_.]/.test(src[j])) j++;
        push(src.slice(i, j), 'num'); i = j; prevSig = '0'; continue;
      }
      // identificadores
      if (isIdStart(ch)) {
        let j = i; while (j < n && isId(src[j])) j++;
        const w = src.slice(i, j);
        let k = j; while (src[k] === ' ') k++;
        const next = src[k];
        let c = 'plain';
        if (L.kw.has(w)) c = 'kw';
        else if (L.consts.has(w)) c = 'const';
        else if (L.types && L.types.has(w)) c = 'type';
        else if (next === '(') c = 'fn';
        else if (prevSig === '.') c = 'prop';
        else if (/^[A-Z]/.test(w)) c = 'type';
        else if (next === ':' && src[k + 1] !== ':') c = 'prop';
        push(w, c); i = j; prevSig = 'x'; continue;
      }
      // puntuación y operadores
      if ('{}[]();,.'.includes(ch)) { push(ch, 'punc'); prevSig = ch; i++; continue; }
      push(ch, 'op'); prevSig = ch; i++;
    }
    return out;
  }

  function tokenizeYaml(src) {
    const out = [];
    src.split('\n').forEach((line, idx) => {
      if (idx) out.push({ t: '\n', c: 'plain' });
      const hashAt = line.search(/(^|\s)#/);
      let body = line, com = '';
      if (hashAt >= 0) { body = line.slice(0, hashAt); com = line.slice(hashAt); }
      const m = body.match(/^(\s*)(-\s+)?([\w .-]+?)(:)(.*)$/);
      if (m) {
        out.push({ t: m[1], c: 'plain' });
        if (m[2]) out.push({ t: m[2], c: 'punc' });
        out.push({ t: m[3], c: 'key' });
        out.push({ t: m[4], c: 'punc' });
        valueTokens(m[5], out);
      } else {
        const m2 = body.match(/^(\s*)(-\s+)(.*)$/);
        if (m2) { out.push({ t: m2[1], c: 'plain' }, { t: m2[2], c: 'punc' }); valueTokens(m2[3], out); }
        else out.push({ t: body, c: 'plain' });
      }
      if (com) out.push({ t: com, c: 'com' });
    });
    return out;
  }
  function valueTokens(v, out) {
    const parts = v.split(/(\[|\]|,)/);
    parts.forEach((p) => {
      if (!p) return;
      if (p === '[' || p === ']' || p === ',') out.push({ t: p, c: 'punc' });
      else if (/^\s*\d+\s*$/.test(p)) out.push({ t: p, c: 'num' });
      else if (/^\s*(true|false|null)\s*$/.test(p)) out.push({ t: p, c: 'const' });
      else out.push({ t: p, c: 'str' });
    });
  }

  function tokenizeMd(src) {
    const out = [];
    src.split('\n').forEach((line, idx) => {
      if (idx) out.push({ t: '\n', c: 'plain' });
      let m;
      if ((m = line.match(/^(#{1,6}\s)(.*)$/))) { out.push({ t: m[1], c: 'bullet' }, { t: m[2], c: 'head' }); return; }
      if ((m = line.match(/^(>\s?)(.*)$/))) { out.push({ t: m[1], c: 'bullet' }, { t: m[2], c: 'quote' }); return; }
      if ((m = line.match(/^(\s*(?:[-*]|\d+\.)\s)(.*)$/))) { out.push({ t: m[1], c: 'bullet' }); inlineMd(m[2], out); return; }
      inlineMd(line, out);
    });
    return out;
  }
  function inlineMd(s, out) {
    const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index), c: 'plain' });
      out.push({ t: m[0], c: m[1] ? 'bold' : m[2] ? 'code' : 'link' });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ t: s.slice(last), c: 'plain' });
  }

  function toLines(tokens) {
    const lines = [[]];
    tokens.forEach((tk) => {
      if (tk.t === '\n') { lines.push([]); return; }
      const parts = tk.t.split('\n');
      parts.forEach((p, k) => {
        if (k) lines.push([]);
        if (p) lines[lines.length - 1].push({ t: p, c: tk.c });
      });
    });
    return lines;
  }

  KN.highlight = function (src, lang) {
    let tokens;
    if (lang === 'md') tokens = tokenizeMd(src);
    else if (lang === 'yml') tokens = tokenizeYaml(src);
    else tokens = tokenizeCode(src, LANGS[lang] || LANGS.ts);
    return toLines(tokens);
  };

  KN.escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
})();
