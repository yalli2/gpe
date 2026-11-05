/* 실습 위젯: 입력 UI · 완료 판정 · 데모 샘플 생성 */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const items = a => a.items || a.axes || a.options || [];
  const keyOf = x => x.k || x.v;

  /* ---------- 완료 판정 ---------- */
  function isDone(a, v) {
    if (v === undefined || v === null) return false;
    switch (a.type) {
      case 'scale': case 'radar': case 'spectrum': return items(a).every(x => isNum(v[x.k]));
      case 'quadrant': return a.items.every(x => Array.isArray(v[x.k]));
      case 'allocate': return a.items.reduce((s, x) => s + (v[x.k] || 0), 0) === (a.total || 100);
      case 'rank': return Array.isArray(v) && v.length === a.items.length;
      case 'choice': case 'quiz': return typeof v === 'string' && v !== '';
      case 'multi': return Array.isArray(v) && v.length > 0;
      case 'text': return typeof v === 'string' && v.trim().length >= 2;
    }
    return false;
  }
  function chapterProgress(ch, d) {
    if (!d) return 0;
    const A = ch.activities || [];
    return A.length ? A.filter(a => isDone(a, d[a.id])).length / A.length : 0;
  }

  /* ---------- 샘플 ---------- */
  function rng(seed) { let s = seed >>> 0; return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const inR = (r, s, lo, hi) => { const a = s ? Math.max(lo, Math.min(hi, s[0])) : lo, b = s ? Math.max(lo, Math.min(hi, s[1])) : hi; return ri(r, Math.min(a, b), Math.max(a, b)); };
  const wpick = (r, opts, w) => { if (!w || w.length !== opts.length) return opts[ri(r, 0, opts.length - 1)]; let t = r() * w.reduce((x, y) => x + y, 0), k = 0; while (k < w.length - 1 && t >= w[k]) { t -= w[k]; k++; } return opts[k]; };
  function sampleOne(a, r, i) {
    switch (a.type) {
      case 'scale': { const o = {}; a.items.forEach(x => o[x.k] = inR(r, x.s, a.min || 1, a.max || 7)); return o; }
      case 'radar': { const o = {}; a.axes.forEach(x => o[x.k] = inR(r, x.s || [3, 9], 0, a.max || 10)); return o; }
      case 'spectrum': { const o = {}; a.items.forEach(x => o[x.k] = inR(r, x.s || [-4, 4], -5, 5)); return o; }
      case 'quadrant': { const o = {}; a.items.forEach(x => { const s = x.s || [[-4, 4], [-4, 4]]; o[x.k] = [inR(r, s[0], -5, 5), inR(r, s[1], -5, 5)]; }); return o; }
      case 'allocate': {
        const T = a.total || 100, n = a.items.length; let w = a.items.map(() => 0.4 + r() * 1.6), sw = w.reduce((x, y) => x + y, 0);
        let v = w.map(x => Math.round(x / sw * T / 5) * 5), diff = T - v.reduce((x, y) => x + y, 0); v[ri(r, 0, n - 1)] += diff;
        if (v.some(x => x < 0)) { v = a.items.map(() => 0); v[0] = T; }
        const o = {}; a.items.forEach((x, j) => o[x.k] = v[j]); return o;
      }
      case 'rank': { const k = a.items.map(x => ({ k: x.k, s: r() + a.items.indexOf(x) * 0.18 })); return k.sort((p, q) => p.s - q.s).map(x => x.k); }
      case 'choice': case 'quiz': return wpick(r, a.options, a.w).v;
      case 'multi': { const mx = a.max || a.options.length; let o = a.options.filter(() => r() < 0.45).map(x => x.v).slice(0, mx); return o.length ? o : [a.options[ri(r, 0, a.options.length - 1)].v]; }
      case 'text': { const s = a.samples || []; return s.length ? s[(i + ri(r, 0, 1)) % s.length] : ''; }
    }
  }
  function sampleChapter(ch, i) {
    const r = rng(ch.n * 1000 + i * 97 + 13), d = { _ts: Date.now() - ri(r, 1, 50) * 60000 };
    (ch.activities || []).forEach(a => { if (i >= 6 && a.type === 'text' && r() < 0.5) return; d[a.id] = sampleOne(a, r, i); });
    return d;
  }

  /* ---------- 입력 렌더러 ---------- */
  // onChange(value, {debounce:true}) 로 저장 요청
  const R = {};

  R.scale = (a, v, on) => {
    v = Object.assign({}, v || {});
    const box = h('div', 'w-scale');
    const lo = a.min || 1, hi = a.max || 7;
    box.appendChild(h('div', 'poles', `<span>${esc(a.left || '낮음')}</span><span>${esc(a.right || '높음')}</span>`));
    a.items.forEach(x => {
      const row = h('div', 'srow');
      row.appendChild(h('div', 'slabel', esc(x.label)));
      const pills = h('div', 'pills');
      for (let n = lo; n <= hi; n++) {
        const b = h('button', 'pill' + (v[x.k] === n ? ' on' : ''), String(n));
        b.type = 'button'; b.setAttribute('aria-label', `${x.label} ${n}점`);
        b.onclick = () => { v[x.k] = n; pills.querySelectorAll('.pill').forEach((p, j) => p.classList.toggle('on', j + lo === n)); on(Object.assign({}, v)); };
        pills.appendChild(b);
      }
      row.appendChild(pills); box.appendChild(row);
    });
    return box;
  };

  function sliderRow(label, val, min, max, left, right, onv) {
    const row = h('div', 'slrow' + (isNum(val) ? '' : ' untouched'));
    const top = h('div', 'sltop', `<span class="sll">${esc(label)}</span><b class="slv">${isNum(val) ? (val > 0 && min < 0 ? '+' + val : val) : '—'}</b>`);
    const inp = h('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = 1; inp.value = isNum(val) ? val : Math.round((min + max) / 2);
    inp.setAttribute('aria-label', label);
    const set = () => { const n = +inp.value; row.classList.remove('untouched'); top.querySelector('.slv').textContent = (n > 0 && min < 0 ? '+' + n : n); onv(n); };
    inp.oninput = set; inp.onchange = set;
    inp.onpointerdown = () => { if (row.classList.contains('untouched')) set(); };
    row.appendChild(top); row.appendChild(inp);
    if (left || right) row.appendChild(h('div', 'slpoles', `<span>${esc(left || '')}</span><span>${esc(right || '')}</span>`));
    return row;
  }
  R.radar = (a, v, on) => {
    v = Object.assign({}, v || {});
    const box = h('div', 'w-sliders');
    a.axes.forEach(x => box.appendChild(sliderRow(x.label, v[x.k], 0, a.max || 10, '', '', n => { v[x.k] = n; on(Object.assign({}, v), { debounce: true }); })));
    return box;
  };
  R.spectrum = (a, v, on) => {
    v = Object.assign({}, v || {});
    const box = h('div', 'w-sliders');
    a.items.forEach(x => box.appendChild(sliderRow(x.label, v[x.k], -5, 5, x.left, x.right, n => { v[x.k] = n; on(Object.assign({}, v), { debounce: true }); })));
    return box;
  };
  R.allocate = (a, v, on) => {
    const T = a.total || 100;
    v = Object.assign({}, v || {});
    a.items.forEach(x => { if (!isNum(v[x.k])) v[x.k] = 0; });
    const box = h('div', 'w-alloc');
    const meter = h('div', 'ameter');
    const upd = () => {
      const s = a.items.reduce((t, x) => t + v[x.k], 0), left = T - s;
      meter.innerHTML = `<div class="abar">${a.items.map((x, j) => `<i style="width:${v[x.k] / T * 100}%;background:var(--c${j % 8})"></i>`).join('')}</div>
        <div class="aleft ${left === 0 ? 'ok' : ''}">${left === 0 ? '✓ ' + T + '점 배분 완료' : '남은 점수 <b>' + left + '</b> / ' + T}</div>`;
      return left;
    };
    a.items.forEach((x, j) => {
      const row = h('div', 'arow');
      row.innerHTML = `<span class="adot" style="background:var(--c${j % 8})"></span><span class="al">${esc(x.label)}</span>`;
      const ctl = h('div', 'actl');
      const minus = h('button', 'step', '−'), plus = h('button', 'step', '+'), out = h('b', 'aval', v[x.k]);
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', x.label + ' 5점 빼기'); plus.setAttribute('aria-label', x.label + ' 5점 더하기');
      const change = d => {
        const s = a.items.reduce((t, y) => t + v[y.k], 0);
        let nv = v[x.k] + d; if (nv < 0) nv = 0; if (d > 0 && s + d > T) nv = v[x.k] + (T - s);
        if (nv === v[x.k]) return; v[x.k] = nv; out.textContent = nv; upd(); on(Object.assign({}, v), { debounce: true });
      };
      minus.onclick = () => change(-5); plus.onclick = () => change(5);
      ctl.append(minus, out, plus); row.appendChild(ctl); box.appendChild(row);
    });
    box.appendChild(meter); upd();
    return box;
  };
  R.rank = (a, v, on) => {
    let order = Array.isArray(v) && v.length === a.items.length ? v.slice() : a.items.map(x => x.k);
    const done = Array.isArray(v) && v.length === a.items.length;
    const box = h('div', 'w-rank');
    const list = h('ol', 'rlist');
    const lab = k => (a.items.find(x => x.k === k) || {}).label || k;
    const draw = () => {
      list.innerHTML = '';
      order.forEach((k, j) => {
        const li = h('li', 'ritem', `<span class="rno">${j + 1}</span><span class="rl">${esc(lab(k))}</span>`);
        const up = h('button', 'rbtn', '▲'), dn = h('button', 'rbtn', '▼');
        up.type = dn.type = 'button'; up.disabled = j === 0; dn.disabled = j === order.length - 1;
        up.setAttribute('aria-label', lab(k) + ' 위로'); dn.setAttribute('aria-label', lab(k) + ' 아래로');
        up.onclick = () => { [order[j - 1], order[j]] = [order[j], order[j - 1]]; draw(); if (done) on(order.slice()); };
        dn.onclick = () => { [order[j + 1], order[j]] = [order[j], order[j + 1]]; draw(); if (done) on(order.slice()); };
        li.append(up, dn); list.appendChild(li);
      });
    };
    draw(); box.appendChild(list);
    const ok = h('button', 'btn sm' + (done ? ' ghost' : ''), done ? '✓ 순위 제출됨 · 바꾸면 자동 반영' : '이 순서로 제출');
    ok.type = 'button';
    ok.onclick = () => { on(order.slice()); };
    box.appendChild(ok);
    return box;
  };
  function optionCards(a, v, on, multi) {
    const box = h('div', 'w-opts' + (a.type === 'quiz' ? ' quiz' : ''));
    let cur = multi ? (Array.isArray(v) ? v.slice() : []) : v;
    const answered = a.type === 'quiz' && typeof v === 'string' && v;
    a.options.forEach((o, j) => {
      const sel = multi ? cur.includes(o.v) : cur === o.v;
      let cls = 'opt' + (sel ? ' on' : '');
      if (answered) cls += o.v === a.answer ? ' right' : (sel ? ' wrong' : '');
      const b = h('button', cls, `<span class="ok">${multi ? (sel ? '☑' : '☐') : String.fromCharCode(65 + j)}</span><span class="ot"><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span>`);
      b.type = 'button'; b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      b.onclick = () => {
        if (multi) {
          const i = cur.indexOf(o.v);
          if (i >= 0) cur.splice(i, 1); else { if (a.max && cur.length >= a.max) return flash(box, `최대 ${a.max}개까지 고를 수 있어요`); cur.push(o.v); }
          on(cur.slice());
        } else on(o.v);
      };
      box.appendChild(b);
    });
    if (multi && a.max) box.appendChild(h('div', 'hint', `최대 ${a.max}개 선택`));
    if (answered) box.appendChild(h('div', 'explain ' + (v === a.answer ? 'good' : 'bad'), `<b>${v === a.answer ? '정답입니다.' : '정답은 ' + String.fromCharCode(65 + a.options.findIndex(o => o.v === a.answer)) + '입니다.'}</b> ${esc(a.explain || '')}`));
    return box;
  }
  function flash(box, msg) { let f = box.querySelector('.flash'); if (!f) { f = h('div', 'flash'); box.appendChild(f); } f.textContent = msg; clearTimeout(f._t); f._t = setTimeout(() => f.remove(), 1800); }
  R.choice = (a, v, on) => optionCards(a, v, on, false);
  R.quiz = (a, v, on) => optionCards(a, v, on, false);
  R.multi = (a, v, on) => optionCards(a, v, on, true);
  R.text = (a, v, on) => {
    const box = h('div', 'w-text');
    const ta = h('textarea'); ta.rows = 3; ta.maxLength = 300; ta.placeholder = a.placeholder || '생각을 적어 보세요'; ta.value = typeof v === 'string' ? v : '';
    ta.setAttribute('aria-label', a.title);
    const foot = h('div', 'tfoot');
    const cnt = h('span', 'cnt', `${ta.value.length}/300`);
    const st = h('span', 'tsaved', v ? '✓ 벽에 게시됨' : '');
    foot.append(cnt, st);
    ta.oninput = () => { cnt.textContent = `${ta.value.length}/300`; st.textContent = '입력 중…'; on(ta.value, { debounce: true, quiet: true }); };
    ta.onblur = () => { on(ta.value); st.textContent = ta.value.trim() ? '✓ 벽에 게시됨' : ''; };
    box.append(ta, foot);
    return box;
  };
  R.quadrant = (a, v, on) => {
    v = JSON.parse(JSON.stringify(v || {}));
    const box = h('div', 'w-quad');
    let act = (a.items.find(x => !Array.isArray(v[x.k])) || a.items[0]).k;
    const chips = h('div', 'qchips');
    const pad = h('div', 'qpad');
    const drawChips = () => {
      chips.innerHTML = '';
      a.items.forEach((x, j) => {
        const b = h('button', 'qchip' + (x.k === act ? ' on' : '') + (Array.isArray(v[x.k]) ? ' set' : ''), `<i style="background:var(--c${j % 8})"></i>${esc(x.label)}${Array.isArray(v[x.k]) ? ' ✓' : ''}`);
        b.type = 'button'; b.onclick = () => { act = x.k; drawChips(); };
        chips.appendChild(b);
      });
    };
    const q = a.quads || [];
    pad.innerHTML = `<div class="qaxis qx"></div><div class="qaxis qy"></div>
      ${q.length === 4 ? `<span class="qq tl">${esc(q[0])}</span><span class="qq tr">${esc(q[1])}</span><span class="qq bl">${esc(q[2])}</span><span class="qq br">${esc(q[3])}</span>` : ''}
      <span class="qp top">${esc(a.y.high)} ▲</span><span class="qp bot">▼ ${esc(a.y.low)}</span><span class="qp lft">◀ ${esc(a.x.left)}</span><span class="qp rgt">${esc(a.x.right)} ▶</span>`;
    const dots = h('div', 'qdots'); pad.appendChild(dots);
    const drawDots = () => {
      dots.innerHTML = '';
      a.items.forEach((x, j) => {
        if (!Array.isArray(v[x.k])) return;
        const [px, py] = v[x.k];
        const d = h('span', 'qdot', `<em>${esc(x.label)}</em>`);
        d.style.left = ((px + 5) / 10 * 100) + '%'; d.style.top = ((5 - py) / 10 * 100) + '%'; d.style.background = `var(--c${j % 8})`;
        dots.appendChild(d);
      });
    };
    const place = e => {
      const r = pad.getBoundingClientRect();
      const px = Math.max(-5, Math.min(5, Math.round(((e.clientX - r.left) / r.width) * 10 - 5)));
      const py = Math.max(-5, Math.min(5, Math.round(5 - ((e.clientY - r.top) / r.height) * 10)));
      v[act] = [px, py]; drawDots(); drawChips(); return true;
    };
    let dragging = false;
    pad.addEventListener('pointerdown', e => { dragging = true; pad.setPointerCapture(e.pointerId); place(e); });
    pad.addEventListener('pointermove', e => { if (dragging) place(e); });
    pad.addEventListener('pointerup', () => {
      if (!dragging) return; dragging = false; on(JSON.parse(JSON.stringify(v)));
      const nxt = a.items.find(x => !Array.isArray(v[x.k])); if (nxt) { act = nxt.k; drawChips(); }
    });
    box.appendChild(h('div', 'hint', '항목을 고른 뒤 지도 위를 눌러 위치를 정하세요 (끌어서 조정)'));
    box.append(chips, pad);
    box.appendChild(h('div', 'qlegend', `<span>가로: ${esc(a.x.label || '')}</span><span>세로: ${esc(a.y.label || '')}</span>`));
    drawChips(); drawDots();
    return box;
  };

  function render(a, v, on) { return (R[a.type] || (() => h('div', '', '지원하지 않는 활동')))(a, v, on); }
  const TYPE_LABEL = { scale: '척도 평가', radar: '레이더 진단', choice: '하나 고르기', multi: '여러 개 고르기', quadrant: '4분면 지도', spectrum: '스펙트럼 위치', allocate: '100점 배분', rank: '순위 매기기', quiz: '개념 퀴즈', text: '생각 나누기' };

  window.W = { render, isDone, chapterProgress, sampleChapter, TYPE_LABEL, esc };
})();
