/* 6.200 Exam Practice, static edition (GitHub Pages).
   Renders the same CAT-SOOP markup as the server version (course/__STATIC__/practice.js
   and CAT-SOOP's question boxes), grades in the browser with checks.js, and keeps
   progress in this browser's localStorage. */
(() => {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const app = $('#app');
  let D, Q = [], byId = {};
  const figs = {};          // exam -> {filename: data URI}

  // ------------------------------------------------------------ progress (this browser)
  // state[qid] = {s: 'attempted'|'correct'|'reviewed', a: last answer, v: answer viewed}
  let state = {};
  try { state = JSON.parse(localStorage.getItem('xq6200') || '{}'); } catch (_) { state = {}; }
  const save = () => { try { localStorage.setItem('xq6200', JSON.stringify(state)); } catch (_) {} };
  const status = q => (state[q.id] && state[q.id].s) || 'new';
  const done = q => ['correct', 'reviewed'].includes(status(q));
  const statusName = q => ({correct: 'Full credit earned', reviewed: 'Reviewed', attempted: q.manual ? 'Needs review' : 'Keep practicing', new: 'Not started'}[status(q)]);

  // ------------------------------------------------------------ markdown, math, figures
  function md(s) {
    if (!s) return '';
    const math = [];
    const keep = (tex, display) => { math.push([tex, display]); return `XQMATH${math.length - 1}X`; };
    let t = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => keep(m, true)).replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, p, m) => p + keep(m, false));
    t = t.replace(/\\\$/g, '$');
    const h = window.marked ? marked.parse(t) : esc(t);
    return h.replace(/XQMATH(\d+)X/g, (_, k) => {
      const [tex, display] = math[+k];
      return display ? `<div class="cs_displaymath cs_math_to_render" style="text-align:center;padding-bottom:10px;">${esc(tex)}</div>`
        : `<span class="cs_math_to_render">${esc(tex)}</span>`;
    });
  }
  const pendingMath = [];
  function typeset(el) {
    if (window.MathJax && MathJax.typeset && window.catsoop?.render_all_math) catsoop.render_all_math(el);
    else pendingMath.push(el);
  }
  const mathTimer = setInterval(() => {
    if (window.MathJax && MathJax.typeset && window.catsoop?.render_all_math) {
      clearInterval(mathTimer);
      pendingMath.splice(0).forEach(el => { if (el.isConnected) catsoop.render_all_math(el); });
    }
  }, 200);
  const withFigs = (html, exam) => html.replace(/src="figs\/([^"]+)"/g, (m, name) => figs[exam]?.[name] ? `src="${figs[exam][name]}"` : m);
  async function loadFigs(exam) {
    if (!figs[exam]) {
      try { figs[exam] = await (await fetch(`figs/${exam}.json`)).json(); } catch (_) { figs[exam] = {}; }
    }
  }

  // ------------------------------------------------------------ data helpers
  const conceptName = k => D.concepts.find(c => c.id === k)?.name || k;
  const counts = list => ({total: list.length, complete: list.filter(done).length,
    automatic: list.filter(q => !q.manual).length, correct: list.filter(q => !q.manual && done(q)).length,
    manual: list.filter(q => q.manual).length, reviewed: list.filter(q => q.manual && done(q)).length});
  const inConcept = k => Q.filter(q => !k || q.concept === k);
  const pageToken = pid => 'p-' + pid.replace('/', '-');
  let focusQ = null, activeConcept = null;
  const link = (q, key = q.concept) => `#${pageToken(q.page)}" data-q="${esc(q.name)}" data-c="${esc(key)}`;
  const meter = (n, total, label) => `<progress max="${total || 1}" value="${n}" aria-label="${esc(label)}">${n} of ${total}</progress>`;
  const header = title => `<center><h1 class="cs_content_header">${esc(title)}</h1></center>`;
  const tags = keys => keys.map(k => `<a class="xq-tag" href="#c-${k}">${esc(conceptName(k))}</a>`).join(' · ');

  function summary(list, title) {
    const c = counts(list), next = list.find(q => !done(q));
    return `<section class="xq-progress-overview" aria-label="${esc(title)}">
      <div class="xq-progress-heading"><div><strong>${c.complete} / ${c.total}</strong> <span>completed</span></div><span>${c.total ? (c.complete / c.total * 100).toFixed(1) : 0}%</span></div>
      ${meter(c.complete, c.total, title)}
      <p>${c.correct} / ${c.automatic} questions answered correctly${c.manual ? ` · ${c.reviewed} / ${c.manual} explanations reviewed` : ''}</p>
      ${next ? `<a class="btn btn-catsoop xq-go" href="${link(next)}">${c.complete ? 'Continue practicing' : 'Start practicing'}</a>` : '<strong>All questions in this group are complete.</strong>'}
      <p class="xq-progress-note">Full credit counts once earned, even after a later retry. Conceptual questions are automatically graded too.</p>
    </section>`;
  }
  const note = '<p class="xq-progress-note">Progress is saved in this browser. Each answer part is counted once.</p>';

  // ------------------------------------------------------------ dashboard views
  function viewConcepts() {
    document.title = '6.200 Exam Practice';
    return header('Practice by concept') + `<div id="xq-practice">
      <p>Practice by the concept you want to learn. Questions from different exams are grouped together; each opens with its full problem context.</p>
      ${summary(Q, 'Overall progress')}
      <div class="xq-concept-grid">${D.concepts.map(c => {
        const list = inConcept(c.id), n = counts(list);
        return `<section class="xq-concept-card" id="${c.id}"><h2><a href="#c-${c.id}">${esc(c.name)}</a></h2><p>${esc(c.description)}</p>
          ${meter(n.complete, n.total, c.name)}<div class="xq-concept-count">${n.complete} / ${n.total} completed <span>${n.total - n.complete} remaining</span></div>
          <a href="#c-${c.id}">Practice this concept →</a></section>`;
      }).join('')}</div>${note}</div>`;
  }

  let filter = 'all', search = '';
  function viewList(concept) {
    const title = concept ? conceptName(concept) : 'Your progress';
    document.title = title + ' · 6.200';
    const list = inConcept(concept);
    return header(title) + `<div id="xq-practice">
      ${concept ? `<p class="xq-back"><a href="#practice">← All concepts</a> · <a href="#progress">Your progress</a></p><p>${esc(D.concepts.find(c => c.id === concept).description)}</p>` : ''}
      ${summary(list, concept ? conceptName(concept) : 'Overall progress')}
      <div class="xq-practice-filters"><label>Show <select id="xq-status-filter"><option value="all">All questions</option><option value="unfinished">Unfinished</option><option value="attempted">Attempted, not complete</option><option value="complete">Completed</option></select></label><label>Search <input id="xq-practice-search" type="search" placeholder="Concept, problem, or answer part" value="${esc(search)}"></label></div>
      <p id="xq-filter-count" role="status"></p><div id="xq-practice-list"></div>${note}</div>`;
  }
  function renderList(concept) {
    const target = $('#xq-practice-list'); if (!target) return;
    const match = q => (filter === 'all' || (filter === 'unfinished' && !done(q)) || (filter === 'complete' && done(q)) || (filter === 'attempted' && status(q) === 'attempted'))
      && (!search || `${q.prompt} ${q.name} ${D.pages[q.page].title} ${D.pages[q.page].label} ${conceptName(q.concept)}`.toLowerCase().includes(search.toLowerCase()));
    const list = inConcept(concept).filter(match), groups = new Map();
    for (const q of list) { const k = q.concept + ':' + q.page; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    $('#xq-filter-count').textContent = `${list.length} question${list.length === 1 ? '' : 's'} shown`;
    target.innerHTML = list.length ? [...groups.values()].map(qs => {
      const p = D.pages[qs[0].page], first = qs.find(q => !done(q)) || qs[0];
      return `<section class="xq-practice-row"><div class="xq-row-heading"><h3><a class="xq-go" href="${link(first)}">${esc(p.title)}</a></h3>
        <span>${qs.filter(done).length} / ${qs.length} complete</span></div>
        <p class="xq-source">${esc(conceptName(first.concept))} · ${esc(p.label)}</p>
        <ul class="xq-question-list">${qs.map(q => `<li><a class="xq-question-link xq-go ${status(q)}" href="${link(q)}"><span><b>${esc(q.name)}</b> ${esc(q.prompt)}</span><span class="xq-status-label">${statusName(q)}${q.manual ? ' · self-review' : ''}</span></a></li>`).join('')}</ul></section>`;
    }).join('') : '<p class="xq-empty">No questions match these filters. Try “All questions” or clear the search.</p>';
  }
  function hookFilters(concept) {
    const sel = $('#xq-status-filter'); sel.value = filter;
    sel.addEventListener('change', () => { filter = sel.value; renderList(concept); });
    $('#xq-practice-search').addEventListener('input', e => { search = e.target.value; renderList(concept); });
    renderList(concept);
  }

  function viewExams() {
    document.title = 'Exams · 6.200';
    const sect = (kind, h) => `<h2>${h}</h2><ul class="xq-list">${D.exams.filter(e => e.kind === kind).map(e => `<li><a href="#e-${e.id}">${esc(e.label)}</a></li>`).join('')}</ul>`;
    return header('Exams') + sect('midterm', 'Midterms') + sect('final', 'Finals');
  }
  function viewExam(eid) {
    const e = D.exams.find(x => x.id === eid);
    if (!e) return viewConcepts();
    document.title = e.label + ' · 6.200';
    return header(e.label) + `<ul class="xq-list">${e.pages.map(pid => {
      const p = D.pages[pid];
      return `<li><a href="#${pageToken(pid)}">${esc(p.title)}</a> ${tags([...new Set(p.order.map(n => p.questions[n].concept))])}</li>`;
    }).join('')}</ul>`;
  }

  // ------------------------------------------------------------ problem pages
  function viewProblem(pid) {
    const p = D.pages[pid];
    document.title = p.title + ' · 6.200';
    const qs = Q.filter(q => q.page === pid);
    if (!qs.some(q => q.concept === activeConcept)) activeConcept = qs[0]?.concept;
    return header(p.title) +
      `<div class="xq-meta"><div>${esc(p.label)}</div><div class="xq-topics">${tags([...new Set(qs.map(q => q.concept))])}</div></div>
       <div class="xq-back"><a href="#c-${activeConcept}">Back to ${esc(conceptName(activeConcept))}</a></div>
       <div id="xq-problem-progress" aria-live="polite"></div><hr/>
       <div id="xq-problem">${withFigs(p.html, p.exam)}</div><div class="xq-nav"></div>`;
  }
  function problemChrome(pid) {
    const group = inConcept(activeConcept), c = counts(group), here = counts(Q.filter(q => q.page === pid));
    $('#xq-problem-progress').innerHTML = `<div class="xq-context-links"><a href="#c-${activeConcept}">← ${esc(conceptName(activeConcept))}</a><a href="#progress">Your progress</a></div>
      <div class="xq-progress-heading"><span><b>${c.complete} / ${c.total}</b> completed in this concept</span><span>${here.complete} / ${here.total} on this page</span></div>${meter(c.complete, c.total, conceptName(activeConcept))}`;
    let at = group.findIndex(q => q.page === pid && q.name === focusQ);
    if (at < 0) at = group.findIndex(q => q.page === pid);
    const next = group.slice(at + 1).find(q => !done(q) && q.page !== pid) || group.find(q => !done(q) && q.page !== pid);
    $('.xq-nav').innerHTML = `<a href="#c-${activeConcept}">← Back to this concept</a>${next ? `<a class="xq-go" href="${link(next, activeConcept)}">Next unfinished question →</a>` : '<span>Concept complete ✓</span>'}`;
  }

  const scoreHtml = ok => `<span style="color:rgb(${ok ? '0,200,0' : '200,0,0'});font-weight:bolder;">${ok ? '100.00' : '0.00'}%</span>`;
  const inlineMd = s => md(s).trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1');
  function questionHtml(q) {
    const s = state[q.id] || {}, n = esc(q.name);
    const spec = q.learn ? {...q.spec, prompt: inlineMd(q.spec.prompt), optionsHtml: (q.spec.options || []).map(inlineMd)} : q.spec;
    let input;
    if (spec.kind === 'multiplechoice') {
      const type = spec.renderer === 'checkbox' ? 'checkbox' : 'radio';
      const picked = s.a ? JSON.parse(s.a) : null;
      input = `<div aria-labelledby="catsoop_prompt_${n}" role="${type === 'radio' ? 'radiogroup' : 'group'}">${spec.options.map((o, k) => {
        const on = picked !== null && (type === 'radio' ? picked === k : picked[k]);
        return `<div style="margin-bottom: 10px;"><input id="${n}_opts_${k}" name="${n}_opts" type="${type}" value="${k}"${on ? ' checked' : ''}/><label for="${n}_opts_${k}">${spec.optionsHtml ? spec.optionsHtml[k] : esc(o)}</label></div>`;
      }).join('')}</div>`;
    } else if (spec.kind === 'bigbox') {
      input = `<textarea aria-labelledby="catsoop_prompt_${n}" cols="80" id="${n}" rows="${spec.rows || 4}">${esc(s.a || '')}</textarea><br/>`;
    } else {
      input = `<input aria-labelledby="catsoop_prompt_${n}" id="${n}" size="32" type="text" autocomplete="off" spellcheck="false" value="${esc(s.a || '')}"/>`;
    }
    return `<div class="question question-${spec.kind}" id="cs_qdiv_${n}" style="position: static">
      <div class="xq-question-progress"></div>
      <div id="${n}_rendered_question"><div id="catsoop_prompt_${n}" style="display: inline;">${spec.prompt}</div>${input}</div>
      <div><span id="${n}_buttons">
        <button class="submit btn btn-catsoop" data-act="submit" style="margin-top: 10px;">Submit</button>
        <button class="viewanswer btn btn-catsoop" data-act="view" style="margin-top: 10px;">View Answer</button></span>
        <span class="xq-score" role="status">${s.a !== undefined && spec.kind !== 'bigbox' && (s.s === 'correct' || s.s === 'attempted') ? scoreHtml(s.s === 'correct') : ''}</span>
        <div class="nsubmits_left" role="status"><i>You have infinitely many submissions remaining.</i></div></div>
      <div class="xq-solution-container"><div class="xq-solution"></div></div>
      <div aria-atomic="true" class="xq-message" role="status"></div></div>`;
  }
  function solnHtml(q) {
    const spec = q.spec, exam = q.learn ? '' : D.pages[q.page].exam;
    if (q.learn) {
      const sol = spec.kind === 'multiplechoice'
        ? (spec.renderer === 'checkbox' ? spec.options.filter((o, k) => spec.soln[k]).join(', ') : spec.soln)
        : (spec.soln || '');
      return `<b>Solution:</b> ${md(sol).replace(/^<p>|<\/p>\s*$/g, '')}` + (spec.why ? `<hr /><p><b>Explanation:</b></p>\n\n${md(spec.why)}` : '');
    }
    let sol;
    if (spec.kind === 'multiplechoice') {
      sol = spec.renderer === 'checkbox' ? spec.options.filter((o, k) => spec.soln[k]).map(esc).join(', ') || '(none)' : esc(spec.soln);
      sol = `<b>Solution:</b> ${sol}`;
    } else sol = `<b>Solution:</b> ${md(spec.soln)}`;
    return withFigs(sol + (spec.expl ? `<hr /><p><b>Explanation:</b></p>\n\n${md(spec.expl)}` : ''), exam);
  }
  const afterChange = q => (q.learn ? learnAfter(q) : problemChrome(q.page));
  function badge(box, q) {
    box.querySelector('.xq-question-progress').innerHTML = q.learn
      ? `<span>${q.spec.quiz ? 'Unit quiz' : 'Check your understanding'}</span> <span class="xq-status-label ${status(q)}">${statusName(q)}</span>`
      : `<a href="#c-${q.concept}">${esc(conceptName(q.concept))}</a> <span class="xq-status-label ${status(q)}">${statusName(q)}</span>`;
    if (!q.manual) return;
    let review = box.querySelector('.xq-review');
    if (!review) { review = document.createElement('div'); review.className = 'xq-review'; box.append(review); }
    const s = state[q.id] || {};
    review.innerHTML = (s.a && s.v) || s.s === 'reviewed'
      ? `<label><input type="checkbox" class="xq-rev"${s.s === 'reviewed' ? ' checked' : ''}> I checked my explanation against the reference answer.</label>`
      : '<p>To complete this explanation, submit your answer, then choose View Answer and compare it with the reference.</p>';
  }
  function wire(box, q) {
    box.querySelector('[data-act=submit]').addEventListener('click', () => submit(box, q));
    box.querySelector('[data-act=view]').addEventListener('click', () => {
      const sol = box.querySelector('.xq-solution');
      sol.parentElement.className = 'xq-solution-container solution';
      sol.innerHTML = solnHtml(q); typeset(sol);
      (state[q.id] = state[q.id] || {s: 'new'}).v = true; save(); badge(box, q);
      if (q.learn) learnAfter(q);
    });
    const inp = box.querySelector('input[type=text]');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(box, q); });
    box.addEventListener('change', e => {
      if (e.target.classList.contains('xq-rev')) {
        const s = state[q.id] = state[q.id] || {};
        s.s = e.target.checked ? 'reviewed' : 'attempted'; save(); badge(box, q); afterChange(q);
      }
    });
  }
  function submit(box, q) {
    const spec = q.spec, s = state[q.id] = state[q.id] || {s: 'new'};
    const score = box.querySelector('.xq-score'), msg = box.querySelector('.xq-message');
    let ok = false, text = '';
    if (spec.kind === 'multiplechoice') {
      const ins = [...box.querySelectorAll(`input[name="${q.name}_opts"]`)];
      if (spec.renderer === 'checkbox') {
        const picked = ins.map(i => i.checked);
        s.a = JSON.stringify(picked);
        ok = picked.every((v, k) => v === !!spec.soln[k]);
      } else {
        const k = ins.findIndex(i => i.checked);
        s.a = JSON.stringify(k < 0 ? null : k);
        ok = k >= 0 && spec.options[k] === spec.soln;
      }
    } else if (spec.kind === 'bigbox') {
      s.a = box.querySelector('textarea').value;
      if (s.s !== 'reviewed') s.s = s.a.trim() ? 'attempted' : s.s;
      save(); score.innerHTML = ''; msg.innerHTML = s.a.trim() ? '<i>Your answer was saved. Choose View Answer to compare it with the reference.</i>' : '';
      badge(box, q); afterChange(q);
      return;
    } else {
      s.a = box.querySelector('input[type=text]').value;
      const r = XQ.grade(spec.check, s.a);
      ok = r.score >= 1; text = r.msg;
    }
    if (ok) s.s = 'correct'; else if (s.s !== 'correct') s.s = 'attempted';
    save();
    score.innerHTML = scoreHtml(ok);
    msg.textContent = text;
    badge(box, q); afterChange(q);
  }
  function mountQuestions(pid) {
    document.querySelectorAll('#xq-problem .q').forEach(ph => {
      const q = byId[pid + '/' + ph.dataset.q];
      if (!q) return;
      ph.outerHTML = questionHtml(q);
      const box = document.getElementById('cs_qdiv_' + q.name);
      badge(box, q); wire(box, q);
    });
    problemChrome(pid);
    typeset($('#xq-problem'));
    const el = focusQ && document.getElementById('cs_qdiv_' + focusQ);
    if (el) el.scrollIntoView({block: 'center'}); else window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ Learn: course units
  // Learn questions use the same question boxes and progress store; their ids are learn/<unit>/<name>.
  // state['learn:<unit>'] = {at: index of the furthest step reached}
  let LEARN = {course: []}, UNITS = {};
  function unitQuestions(u) {
    return u.steps.filter(s => s.type === 'check').map(s => byId['learn/' + u.id + '/' + s.q.name]);
  }
  const unitCounts = u => { const qs = unitQuestions(u); return {total: qs.length, done: qs.filter(done).length}; };
  const unitState = u => (state['learn:' + u.id] = state['learn:' + u.id] || {at: 0});
  function viewHome() {
    document.title = '6.200 Exam Practice';
    const units = LEARN.course.filter(c => c.unit).map(c => c.unit);
    const lq = units.flatMap(unitQuestions), lc = {total: lq.length, done: lq.filter(done).length};
    const pc = counts(Q);
    const nextUnit = units.find(u => unitCounts(u).done < unitCounts(u).total) || units[0];
    return header('6.200 Circuits & Electronics') + `<div id="xq-practice">
      <p>Two ways to study: work through the course one idea at a time, or practice on problems from past 6.200 midterms and finals.</p>
      <div class="xq-concept-grid">
        <section class="xq-concept-card"><h2><a href="#learn">Learn the course</a></h2>
          <p>Short lessons that follow the Fall 2026 lectures. Each idea comes with a question to check it, and each unit ends with a quiz.</p>
          ${meter(lc.done, lc.total, 'Learn progress')}<div class="xq-concept-count">${lc.done} / ${lc.total} questions <span>${units.length} units</span></div>
          <a href="${nextUnit ? '#u-' + nextUnit.id : '#learn'}">${lc.done ? 'Continue learning' : 'Start learning'} →</a></section>
        <section class="xq-concept-card"><h2><a href="#practice">Practice past exams</a></h2>
          <p>${D.pages ? Object.keys(D.pages).length : ''} problems from 12 past exams, grouped by concept and graded as you go.</p>
          ${meter(pc.complete, pc.total, 'Practice progress')}<div class="xq-concept-count">${pc.complete} / ${pc.total} completed <span>${pc.total - pc.complete} remaining</span></div>
          <a href="#practice">Practice by concept →</a></section>
      </div>${note}</div>`;
  }
  function viewCourse() {
    document.title = 'Learn · 6.200';
    const weeks = [...new Set(LEARN.course.map(c => c.week))];
    return header('Learn the course') + `<div id="xq-practice">
      <p>Units follow the 6.200 Fall 2026 lecture schedule. Work through each unit's lessons in order; every step checks what you just read.</p>
      ${weeks.map(w => `<h2>Week ${w}</h2><div class="xq-unit-list">${LEARN.course.filter(c => c.week === w).map(c => {
        if (!c.unit) return `<section class="xq-practice-row xq-unit-later"><div class="xq-row-heading"><h3>${esc(c.title)}</h3><span>${esc(c.date)}</span></div><p class="xq-source">Coming later: lecture notes for this unit aren’t available yet.</p></section>`;
        const u = c.unit, n = unitCounts(u);
        return `<section class="xq-practice-row"><div class="xq-row-heading"><h3><a href="#u-${u.id}">${esc(u.title)}</a></h3><span>${n.done} / ${n.total} complete</span></div>
          <p class="xq-source">Lecture: ${esc(c.title)} · ${esc(c.date)}</p><p>${esc(u.intro)}</p>${meter(n.done, n.total, u.title)}</section>`;
      }).join('')}</div>`).join('')}${note}</div>`;
  }
  function viewUnit(u) {
    document.title = u.title + ' · 6.200';
    const list = LEARN.course.filter(c => c.unit).map(c => c.unit), i = list.indexOf(u);
    return header(u.title) + `<div class="xq-meta"><div>Week ${u.week} · ${esc(u.lecture)} · ${esc(u.date)}</div>
        <div class="xq-topics">Practice: <a class="xq-tag" href="#c-${u.practice}">${esc(conceptName(u.practice))}</a></div></div>
      <div class="xq-back"><a href="#learn">Back to the course</a></div>
      <div id="xq-problem-progress"></div><hr/>
      <p class="xq-unit-intro">${esc(u.intro)}</p><div id="xq-steps"></div>
      <div class="xq-nav">${i > 0 ? `<a href="#u-${list[i - 1].id}">← ${esc(list[i - 1].title)}</a>` : '<span></span>'}${i + 1 < list.length ? `<a href="#u-${list[i + 1].id}">${esc(list[i + 1].title)} →</a>` : '<span></span>'}</div>`;
  }
  const stepDone = (u, k) => { const s = u.steps[k]; if (s.type !== 'check') return true; const q = byId['learn/' + u.id + '/' + s.q.name]; return done(q) || !!(state[q.id] && state[q.id].v); };
  function renderSteps(u) {
    const box = $('#xq-steps'), st = unitState(u);
    st.at = Math.min(st.at, u.steps.length - 1);
    let html = '', quizShown = false;
    for (let k = 0; k <= st.at; k++) {
      const s = u.steps[k];
      if (s.type === 'check' && s.q.quiz && !quizShown) { quizShown = true; html += `<h2 class="xq-quiz-head">Unit quiz</h2><p>Check that it all fits together.</p>`; }
      if (s.type === 'read') html += `<section class="xq-lesson" id="xq-step-${k}"><h3>${esc(s.title)}</h3>${md(s.md)}</section>`;
      else html += `<div class="q" data-k="${k}"></div>`;
      if (k === st.at && k + 1 < u.steps.length) html += `<p class="xq-continue"><button class="btn btn-catsoop" id="xq-next"${stepDone(u, k) ? '' : ' disabled'}>Continue</button> <span class="xq-progress-note">${stepDone(u, k) ? '' : 'Answer the question (or choose View Answer) to continue.'}</span></p>`;
    }
    if (st.at === u.steps.length - 1 && stepDone(u, st.at)) {
      const n = unitCounts(u), list = LEARN.course.filter(c => c.unit).map(c => c.unit), next = list[list.indexOf(u) + 1];
      html += `<section class="xq-progress-overview xq-unit-done"><strong>${n.done === n.total ? 'Unit complete ✓' : 'You reached the end of this unit'}</strong>
        <p>${n.done} / ${n.total} questions answered correctly.${n.done < n.total ? ' Questions you revealed instead of answering stay open; go back and try them again.' : ''}</p>
        <p>${next ? `<a class="btn btn-catsoop" href="#u-${next.id}">Next unit: ${esc(next.title)}</a> ` : ''}<a href="#c-${u.practice}">Practice past exam problems on ${esc(conceptName(u.practice))} →</a></p></section>`;
    }
    box.innerHTML = withFigs(html, '');
    box.querySelectorAll('.q').forEach(ph => {
      const s = u.steps[+ph.dataset.k], q = byId['learn/' + u.id + '/' + s.q.name];
      ph.outerHTML = questionHtml(q);
      const el = document.getElementById('cs_qdiv_' + q.name);
      badge(el, q); wire(el, q);
    });
    const nextBtn = $('#xq-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      st.at++; save(); renderSteps(u);
      const el = document.getElementById('xq-step-' + st.at) || document.getElementById('cs_qdiv_' + (u.steps[st.at].q || {}).name);
      if (el) el.scrollIntoView({block: 'start', behavior: 'smooth'});
    });
    unitChrome(u);
    typeset(box);
  }
  function unitChrome(u) {
    const n = unitCounts(u), st = unitState(u);
    $('#xq-problem-progress').innerHTML = `<div class="xq-context-links"><a href="#learn">← All units</a><a href="#c-${u.practice}">Practice this topic</a></div>
      <div class="xq-progress-heading"><span><b>Step ${st.at + 1} of ${u.steps.length}</b></span><span>${n.done} / ${n.total} questions correct</span></div>${meter(st.at + 1, u.steps.length, u.title)}`;
  }
  function learnAfter(q) {
    const u = UNITS[q.unit], st = unitState(u), k = u.steps.findIndex(s => s.type === 'check' && s.q.name === q.name);
    if (k === st.at) {             // the current step just got answered: refresh the Continue button / end panel
      const keepY = window.scrollY;
      renderSteps(u);
      window.scrollTo(0, keepY);
    } else unitChrome(u);
  }

  // ------------------------------------------------------------ router
  async function route() {
    const h = location.hash.replace(/^#/, '');
    let m;
    if ((m = /^u-([\w-]+)$/.exec(h)) && UNITS[m[1]]) {
      app.innerHTML = viewUnit(UNITS[m[1]]); renderSteps(UNITS[m[1]]); window.scrollTo(0, 0);
      return;
    }
    if (h === 'learn') { app.innerHTML = viewCourse(); window.scrollTo(0, 0); return; }
    if (h === '' ) { app.innerHTML = viewHome(); window.scrollTo(0, 0); return; }
    if ((m = /^p-(\w+)-(p\d+)$/.exec(h)) && D.pages[`${m[1]}/${m[2]}`]) {
      const pid = `${m[1]}/${m[2]}`;
      await loadFigs(m[1]);
      app.innerHTML = viewProblem(pid); mountQuestions(pid);
      return;
    }
    if ((m = /^c-(\w+)$/.exec(h)) && D.concepts.some(c => c.id === m[1])) {
      app.innerHTML = viewList(m[1]); hookFilters(m[1]); activeConcept = m[1];
    } else if (h === 'progress') {
      if (filter === 'all') filter = 'unfinished';
      app.innerHTML = viewList(null); hookFilters(null);
    } else if (h === 'exams') app.innerHTML = viewExams();
    else if ((m = /^e-(\w+)$/.exec(h))) app.innerHTML = viewExam(m[1]);
    else app.innerHTML = viewConcepts();
    focusQ = null;
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a.xq-go');
    if (!a) return;
    e.preventDefault();
    focusQ = a.dataset.q || null;
    if (a.dataset.c) activeConcept = a.dataset.c;
    const hash = a.getAttribute('href').split('"')[0];
    if (location.hash === hash) route(); else location.hash = hash;
  });
  window.addEventListener('hashchange', () => route());

  // footer "Source Code" -> this site's GitHub repository
  const src = $('#xq-source');
  if (src) {
    const gh = /^([^.]+)\.github\.io$/.exec(location.hostname);
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (gh) src.href = `https://github.com/${gh[1]}/${repo && !repo.includes('.') ? repo : gh[1] + '.github.io'}`;
    else src.removeAttribute('href');
  }

  Promise.all([fetch('data.json').then(r => r.json()), fetch('learn.json').then(r => r.json()).catch(() => ({course: []}))]).then(([data, learn]) => {
    D = data; LEARN = learn;
    for (const c of LEARN.course) {
      if (!c.unit) continue;
      UNITS[c.unit.id] = c.unit;
      for (const s of c.unit.steps) {
        if (s.type !== 'check') continue;
        const q = {id: `learn/${c.unit.id}/${s.q.name}`, unit: c.unit.id, name: s.q.name, learn: true, manual: false,
          concept: c.unit.practice, prompt: s.q.prompt, spec: s.q};
        byId[q.id] = q;
      }
    }
    for (const [pid, p] of Object.entries(D.pages)) {
      for (const name of p.order) {
        const spec = p.questions[name];
        const q = {id: `${pid}/${name}`, page: pid, exam: p.exam, name, concept: spec.concept, manual: spec.kind === 'bigbox',
          prompt: spec.prompt.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), spec};
        Q.push(q); byId[q.id] = q;
      }
    }
    const order = D.concepts.map(c => c.id);
    Q.sort((a, b) => order.indexOf(a.concept) - order.indexOf(b.concept));
    route();
  }).catch(() => { app.innerHTML = '<p>The problems could not be loaded. Reload the page to try again.</p>'; });
})();
