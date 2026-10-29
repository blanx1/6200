/* Answer checkers for the static site: a port of tools/checks.py.
   XQ.grade(spec, submission) -> {score: 0|1, msg}  where spec comes from data.json. */
(() => {
  'use strict';
  // ------------------------------------------------------------ complex arithmetic
  const C = (re, im = 0) => ({re, im});
  const isC = x => typeof x === 'object' && x !== null && 're' in x;
  const toC = x => isC(x) ? x : C(x, 0);
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => {
    if (a.im === 0 && b.im === 0) return C(a.re * b.re);
    return C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  };
  const div = (a, b) => {
    if (a.im === 0 && b.im === 0) {
      if (b.re === 0) throw new Error('zerodiv');
      return C(a.re / b.re);
    }
    const d = b.re * b.re + b.im * b.im;
    if (d === 0) throw new Error('zerodiv');
    return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  };
  const cabs = a => Math.hypot(a.re, a.im);
  const carg = a => Math.atan2(a.im, a.re);
  const cexp = a => { const m = Math.exp(a.re); return a.im === 0 ? C(m) : C(m * Math.cos(a.im), m * Math.sin(a.im)); };
  const clog = a => {
    if (a.im === 0 && a.re > 0) return C(Math.log(a.re));
    if (a.re === 0 && a.im === 0) throw new Error('domain');
    return C(Math.log(cabs(a)), carg(a));
  };
  const cpow = (a, b) => {
    if (a.im === 0 && b.im === 0) {
      if (a.re >= 0 || Number.isInteger(b.re)) {
        const r = Math.pow(a.re, b.re);
        if (!Number.isNaN(r)) return C(r);
      }
    }
    if (a.re === 0 && a.im === 0) {
      if (b.re > 0) return C(0);
      throw new Error('zerodiv');
    }
    return cexp(mul(b, clog(a)));
  };
  const csqrt = a => {
    if (a.im === 0 && a.re >= 0) return C(Math.sqrt(a.re));
    const r = cabs(a), re = Math.sqrt((r + a.re) / 2), im = Math.sign(a.im || 1) * Math.sqrt((r - a.re) / 2);
    return C(re, im);
  };
  const real = f => a => { if (a.im !== 0) throw new Error('domain'); return C(f(a.re)); };
  const csin = a => a.im === 0 ? C(Math.sin(a.re)) : C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
  const ccos = a => a.im === 0 ? C(Math.cos(a.re)) : C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
  const FUNCS = {
    sqrt: csqrt, exp: cexp, ln: clog, log: a => div(clog(a), C(Math.LN10)), log10: a => div(clog(a), C(Math.LN10)),
    log2: a => div(clog(a), C(Math.LN2)), sin: csin, cos: ccos, tan: a => div(csin(a), ccos(a)),
    atan: real(Math.atan), arctan: real(Math.atan), asin: real(Math.asin), acos: real(Math.acos),
    arcsin: real(Math.asin), arccos: real(Math.acos), sinh: real(Math.sinh), cosh: real(Math.cosh), tanh: real(Math.tanh),
    abs: a => C(cabs(a)), mag: a => C(cabs(a)), arg: a => C(carg(a)), angle: a => C(carg(a)), phase: a => C(carg(a)),
    Re: a => C(a.re), Im: a => C(a.im), conj: a => C(a.re, -a.im),
  };
  const CONSTS = {pi: C(Math.PI), '\u03c0': C(Math.PI), e: C(Math.E), j: C(0, 1), inf: C(Infinity), infinity: C(Infinity), '\u221e': C(Infinity)};
  const GREEK = {'\u03b1': 'alpha', '\u03b2': 'beta', '\u03b3': 'gamma', '\u03b4': 'delta', '\u03b5': 'epsilon', '\u03b6': 'zeta', '\u03b8': 'theta',
    '\u03bb': 'lambda', '\u03bc': 'mu', '\u03be': 'xi', '\u03c1': 'rho', '\u03c3': 'sigma', '\u03c4': 'tau', '\u03c6': 'phi', '\u03d5': 'phi', '\u03c7': 'chi',
    '\u03c8': 'psi', '\u03c9': 'omega', '\u0394': 'Delta', '\u03a6': 'Phi'};
  const PREFIX = {T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, '\u00b5': 1e-6, '\u03bc': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15};
  const UNITS = ['V', 'A', '\u03a9', 'ohm', 'ohms', 'Ohm', 'Ohms', 'Hz', 'F', 'H', 's', 'sec', 'W', 'J', 'S', 'C', 'dB', 'rad', 'Wb'];
  const UNIT_RE = new RegExp('^(?:[TGMkKmu\u00b5\u03bcnpf])?(?:' + [...UNITS].sort((a, b) => b.length - a.length).join('|') + ')$');
  const PREFIX_RE = /^[TGMkKmu\u00b5\u03bcnpf]$/;
  const NUM = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
  const WORD = /^[A-Za-z\u03a9\u00b5\u03bc\u03b1-\u03c9\u0391-\u03a9\u03d5\u0394\u03a6][A-Za-z0-9_\u03a9\u00b5\u03bc\u03b1-\u03c9\u03d5']*/;

  class ParseError extends Error {}

  function normalize(s) {
    let t = s.trim();
    const reps = [['\u2212', '-'], ['\u2013', '-'], ['\u2014', '-'], ['\u00b7', '*'], ['\u00d7', '*'], ['\u22c5', '*'], ['\u00f7', '/'], ['\u03a9', '\u03a9'],
      ['**', '^'], ['\u2225', '||'], ['{', '('], ['}', ')'], ['[', '('], [']', ')'], ['\u00b2', '^2'], ['\u00b3', '^3'],
      ['\u221a', ' sqrt '], ['\u00b0', ' deg '], ['\u00ba', ' deg '], ['\u221e', ' inf '], ['\\cdot', '*'], ['\\times', '*'],
      ['\\pi', '\u03c0'], ['\\omega', '\u03c9'], ['\\alpha', '\u03b1'], ['\\tau', '\u03c4'], ['\\sqrt', ' sqrt '], ['\\frac', ''],
      ['\\Omega', '\u03a9'], ['\\mu', '\u00b5'], ['\\left', ''], ['\\right', ''], ['$', '']];
    for (const [a, b] of reps) t = t.split(a).join(b);
    t = t.replace(/\b(?:rads?|radians?)\s*\/\s*(?:s|sec|second)\b/g, ' ');
    t = t.replace(/\b(?:rads?|radians?)\b/g, ' ');
    t = t.replace(/(\d),(?=\d{3}\b)/g, '$1');
    return t;
  }

  function splitName(word, names) {
    if (names.has(word)) return [word];
    for (let k = word.length - 1; k > 0; k--) {
      const head = word.slice(0, k);
      if (names.has(head)) {
        const rest = splitName(word.slice(k), names);
        if (rest) return [head, ...rest];
      }
    }
    return null;
  }

  function tokenize(s, names) {
    const t = normalize(s), toks = [];
    let i = 0;
    while (i < t.length) {
      const c = t[i];
      if (/\s/.test(c)) { i++; continue; }
      if (t.startsWith('||', i)) { toks.push(['op', '||']); i += 2; continue; }
      if ('+-*/^(),|'.includes(c)) { toks.push(['op', c]); i++; continue; }
      let m = NUM.exec(t.slice(i));
      if (m) {
        let val = parseFloat(m[0]);
        i += m[0].length;
        let j = i;
        while (j < t.length && t[j] === ' ') j++;
        const w = WORD.exec(t.slice(j));
        if (w) {
          const word = w[0];
          if (!splitName(word, names)) {
            if (UNITS.includes(word)) i = j + word.length;
            else if (UNIT_RE.test(word) || PREFIX_RE.test(word)) { val *= PREFIX[word[0]]; i = j + word.length; }
            else if (word === 'deg') { val *= Math.PI / 180; i = j + word.length; }
          }
        }
        toks.push(['num', val]);
        continue;
      }
      m = WORD.exec(t.slice(i));
      if (m) {
        const word = m[0];
        i += word.length;
        if (word === 'deg') { toks.push(['op', '*']); toks.push(['num', Math.PI / 180]); continue; }
        const parts = splitName(word, names);
        if (!parts) {
          if (UNIT_RE.test(word)) { toks.push(['num', UNITS.includes(word) ? 1 : PREFIX[word[0]]]); continue; }
          throw new ParseError(`I don't know what \u201c${word}\u201d means here.`);
        }
        for (const p of parts) toks.push(['name', p]);
        continue;
      }
      throw new ParseError(`Unexpected character \u201c${c}\u201d.`);
    }
    return toks;
  }

  function parse(toks) {
    let i = 0;
    const peek = () => toks[i] || [null, null];
    const is = (k, v) => { const p = peek(); return p[0] === k && p[1] === v; };
    const take = (k, v) => {
      const p = peek();
      if (p[0] === null || (k && p[0] !== k) || (v && p[1] !== v)) throw new ParseError('The expression looks incomplete.');
      i++;
      return p;
    };
    const startsAtom = () => { const [k, v] = peek(); return k === 'num' || k === 'name' || (k === 'op' && v === '('); };
    function sum() {
      let node = parallel();
      while (is('op', '+') || is('op', '-')) {
        const op = take()[1], a = node, b = parallel();
        node = op === '+' ? env => add(a(env), b(env)) : env => sub(a(env), b(env));
      }
      return node;
    }
    function parallel() {
      let node = product();
      while (is('op', '||')) {
        take();
        const a = node, b = product();
        node = env => { const x = a(env), y = b(env); return div(mul(x, y), add(x, y)); };
      }
      return node;
    }
    function product() {
      let node = implicit();
      while (is('op', '*') || is('op', '/')) {
        const v = take()[1], a = node, b = implicit();
        node = v === '*' ? env => mul(a(env), b(env)) : env => div(a(env), b(env));
      }
      return node;
    }
    function implicit() {
      let node = unary();
      while (startsAtom()) {
        const a = node, b = power();
        node = env => mul(a(env), b(env));
      }
      return node;
    }
    function unary() {
      if (is('op', '-')) { take(); const a = unary(); return env => mul(C(-1), a(env)); }
      if (is('op', '+')) { take(); return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (is('op', '^')) { take(); const e = unary(); return env => cpow(base(env), e(env)); }
      return base;
    }
    function atom() {
      const [k, v] = take();
      if (k === 'num') return () => C(v);
      if (k === 'op' && v === '(') { const n = sum(); take('op', ')'); return n; }
      if (k === 'op' && v === '|') { const n = sum(); take('op', '|'); return env => C(cabs(n(env))); }
      if (k === 'name') {
        if (FUNCS[v]) {
          const f = FUNCS[v];
          if (is('op', '^')) { take(); const p = unary(); const a = power(); return env => cpow(f(a(env)), p(env)); }
          let a;
          if (is('op', '(')) {
            take();
            const args = [sum()];
            while (is('op', ',')) { take(); args.push(sum()); }
            take('op', ')');
            if ((v === 'atan' || v === 'arctan') && args.length === 2) return env => C(Math.atan2(args[0](env).re, args[1](env).re));
            if (args.length !== 1) throw new ParseError(`${v} takes one argument.`);
            a = args[0];
          } else a = power();
          return env => f(a(env));
        }
        return env => { if (!(v in env)) throw new Error('unknown ' + v); return env[v]; };
      }
      throw new ParseError(`Couldn't read the part starting at \u201c${v}\u201d.`);
    }
    if (!toks.length) throw new ParseError('Empty answer.');
    const node = sum();
    if (i !== toks.length) throw new ParseError(`Couldn't read the part starting at \u201c${toks[i][1]}\u201d.`);
    return node;
  }

  function compile(s, vars = []) {
    const names = new Set([...vars, ...Object.keys(FUNCS), ...Object.keys(CONSTS), 'deg']);
    s = [...s].map(ch => (GREEK[ch] && names.has(GREEK[ch])) ? GREEK[ch] : ch).join('');
    const f = parse(tokenize(s, names));
    return env => toC(f({...CONSTS, ...env}));
  }
  const parseValue = (s, vars) => compile(s, vars)({});

  function close(a, b, tol, atol) {
    const ia = !Number.isFinite(a.re) || !Number.isFinite(a.im), ib = !Number.isFinite(b.re) || !Number.isFinite(b.im);
    if (ia || ib) return ia && ib && Math.sign(a.re) === Math.sign(b.re);
    return cabs(sub(a, b)) <= tol * cabs(b) + atol;
  }
  const clean = s => s.trim().replace(/\.+$/, '').trim();
  const SPECIAL = {none: 'None', no: 'None', 'n/a': 'None', impossible: 'None', any: 'any', anything: 'any'};

  // Same random points as Python is not needed: each side samples its own.
  function rng(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }

  function numCheck(spec) {
    const vars = spec.vars || [], ranges = spec.ranges || {};
    const r = rng(6200);
    const points = vars.length ? Array.from({length: 6}, () => Object.fromEntries(vars.map(v => {
      const [lo, hi] = ranges[v] || [0.5, 2.0];
      return [v, C(lo + (hi - lo) * r())];
    }))) : [{}];
    const keys = spec.answers.filter(a => a !== 'None').map(a => compile(a, vars));
    const targets = keys.map(k => points.map(p => k(p)));
    const words = new Set((spec.words || []).map(w => w.toLowerCase()));
    if (spec.none || spec.answers.includes('None')) words.add('none');
    const tol = vars.length ? Math.max(spec.tol, 1e-6) : spec.tol;
    return sub_ => {
      const s = clean(sub_);
      if (!s) return {score: 0, msg: ''};
      const low = s.toLowerCase();
      if (words.has(low) || words.has((SPECIAL[low] || '-').toLowerCase())) return {score: 1, msg: ''};
      if (low in SPECIAL) return {score: 0, msg: ''};
      let got;
      try { const f = compile(s, vars); got = points.map(p => f(p)); }
      catch (e) {
        if (e instanceof ParseError) return {score: 0, msg: `Couldn't read that answer. ${e.message}`};
        if (String(e.message).startsWith('unknown')) return {score: 0, msg: `Couldn't read that answer. Unknown variable ${e.message.slice(8)}.`};
        return {score: 0, msg: "Couldn't evaluate that answer."};
      }
      for (const t of targets) if (got.every((g, k) => close(g, t[k], tol, spec.atol))) return {score: 1, msg: ''};
      return {score: 0, msg: ''};
    };
  }

  function rangeCheck(spec) {
    return sub_ => {
      const s = clean(sub_);
      if (!s) return {score: 0, msg: ''};
      if (s.toLowerCase() in SPECIAL) return {score: spec.none && SPECIAL[s.toLowerCase()] === 'None' ? 1 : 0, msg: ''};
      let v;
      try { v = parseValue(s, []); }
      catch (e) { return {score: 0, msg: "Couldn't read that as a number. " + (e instanceof ParseError ? e.message : '')}; }
      if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) return {score: 0, msg: ''};
      const x = v.re;
      if (spec.lo !== null && spec.lo !== undefined && (x < spec.lo || (x === spec.lo && !spec.lo_incl))) return {score: 0, msg: ''};
      if (spec.hi !== null && spec.hi !== undefined && (x > spec.hi || (x === spec.hi && !spec.hi_incl))) return {score: 0, msg: ''};
      return {score: 1, msg: ''};
    };
  }

  // spec.ok = {args, body}: an expression tree exported from the page's xq_pair lambda
  function evalTree(n, env) {
    switch (n[0]) {
      case 'and': return n[1].every(x => evalTree(x, env));
      case 'or': return n[1].some(x => evalTree(x, env));
      case 'cmp': {
        const vals = n[2].map(x => evalTree(x, env));
        return n[1].every((op, k) => {
          const a = vals[k], b = vals[k + 1];
          return {'<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a === b, '!=': a !== b}[op];
        });
      }
      case 'bin': {
        const a = evalTree(n[2], env), b = evalTree(n[3], env);
        return {'+': a + b, '-': a - b, '*': a * b, '/': a / b, '^': a ** b}[n[1]];
      }
      case 'neg': return -evalTree(n[1], env);
      case 'abs': return Math.abs(evalTree(n[1], env));
      case 'name': return env[n[1]];
      case 'const': return n[1];
    }
    throw new Error('bad tree');
  }
  function pairCheck(spec) {
    const ok = spec.ok ? (...vals) => evalTree(spec.ok.body, Object.fromEntries(spec.ok.args.map((a, k) => [a, vals[k]]))) : null;
    return sub_ => {
      const s = clean(sub_);
      if (!s) return {score: 0, msg: ''};
      if (s.toLowerCase() in SPECIAL) return {score: spec.none && SPECIAL[s.toLowerCase()] === 'None' ? 1 : 0, msg: ''};
      if (spec.none) return {score: 0, msg: ''};
      const parts = s.split(/[,;]/).filter(p => p.trim());
      if (parts.length !== spec.n) return {score: 0, msg: `Enter ${spec.n} values separated by commas, like \u201c${spec.example}\u201d.`};
      let vals;
      try { vals = parts.map(p => parseValue(p, []).re); }
      catch (e) { return {score: 0, msg: "Couldn't read that answer. " + (e instanceof ParseError ? e.message : '')}; }
      return {score: ok(...vals) ? 1 : 0, msg: ''};
    };
  }

  function normText(s, cs, space) {
    let t = s.trim();
    if (t.length >= 2 && t[0] === t[t.length - 1] && `"'`.includes(t[0])) t = t.slice(1, -1);
    t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    t = t.replace(/\s+/g, space === 'ignore' ? '' : ' ').trim().replace(/\.+$/, '');
    return cs ? t : t.toLowerCase();
  }
  function textCheck(spec) {
    const targets = new Set(spec.answers.map(a => normText(a, spec.case, spec.space)));
    return s => (!s.trim() ? {score: 0, msg: ''} : {score: targets.has(normText(s, spec.case, spec.space)) ? 1 : 0, msg: ''});
  }

  const orderKey = s => s.toUpperCase().replace(/ /g, '').replace(/\u2264/g, '<').split('<').map(g => g.split('=').sort().join('='));
  function orderCheck(spec) {
    const target = JSON.stringify(orderKey(spec.answer));
    return sub_ => {
      const s = clean(sub_);
      if (!s) return {score: 0, msg: ''};
      if (s.includes('>')) return {score: 0, msg: 'Write the order from slowest to fastest, using < and =.'};
      return {score: JSON.stringify(orderKey(s)) === target ? 1 : 0, msg: ''};
    };
  }

  function build(spec) {
    switch (spec.type) {
      case 'num': return numCheck(spec);
      case 'range': return rangeCheck(spec);
      case 'pair': return pairCheck(spec);
      case 'text': return textCheck(spec);
      case 'order': return orderCheck(spec);
      case 'any': {
        const cs = spec.checks.map(build);
        return s => {
          const msgs = [];
          for (const c of cs) { const r = c(s); if (r.score >= 1) return r; msgs.push(r.msg); }
          return {score: 0, msg: msgs.find(m => m) || ''};
        };
      }
    }
    throw new Error('unknown checker ' + spec.type);
  }
  const cache = new WeakMap();
  function grade(spec, submission) {
    if (!cache.has(spec)) cache.set(spec, build(spec));
    return cache.get(spec)(submission);
  }
  window.XQ = {grade, parseValue};
})();
