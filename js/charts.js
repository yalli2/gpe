/* 결과 시각화: 활동 유형별 실시간 차트 (나 vs 참가자 전체) */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const col = () => ({ me: css('--me'), grp: css('--grp'), ink: css('--ink'), muted: css('--muted'), line: css('--line'), ok: css('--ok'), bg: css('--card'), pal: Array.from({ length: 8 }, (_, i) => css('--c' + i)) });
  const alpha = (hex, a) => { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(x => x + x).join(''); const n = parseInt(hex, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const avg = a => { a = a.filter(isNum); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const r1 = x => x == null ? '—' : (Math.round(x * 10) / 10);
  const wrap = (s, n) => { s = String(s); if (s.length <= n) return s; const out = []; let cur = ''; s.split(' ').forEach(w => { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out.length > 1 ? out : [s.slice(0, n), s.slice(n)]; };

  const reg = {};
  function chart(key, holder, cfg, height) {
    let c = reg[key];
    if (c && c.canvas && c.canvas.isConnected && holder.contains(c.canvas) && c.config.type === cfg.type) {
      c.data.labels = cfg.data.labels;
      cfg.data.datasets.forEach((d, i) => { if (c.data.datasets[i]) Object.assign(c.data.datasets[i], d); else c.data.datasets.push(d); });
      c.data.datasets.length = cfg.data.datasets.length;
      c.options = cfg.options; c.update('none'); return c;
    }
    if (c) { try { c.destroy(); } catch (e) { } }
    holder.innerHTML = '';
    const box = document.createElement('div'); box.className = 'cbox'; box.style.height = (height || 260) + 'px';
    const cv = document.createElement('canvas'); box.appendChild(cv); holder.appendChild(box);
    cfg.options = cfg.options || {};
    cfg.options.responsive = true; cfg.options.maintainAspectRatio = false;
    reg[key] = new Chart(cv, cfg);
    return reg[key];
  }
  function base(C) {
    Chart.defaults.font.family = "'Pretendard Variable', Pretendard, system-ui, sans-serif";
    Chart.defaults.color = C.muted; Chart.defaults.animation.duration = 450; Chart.defaults.borderColor = C.line;
  }
  const legendOpt = C => ({ display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: C.ink, font: { size: 12 } } });

  /* 공통 헤더: 참여 인원 + 한 줄 인사이트 */
  function head(n, insight) { return `<div class="rhead"><span class="rcount">참여 <b>${n}</b>명</span>${insight ? `<span class="rins">${insight}</span>` : ''}</div>`; }

  const V = {};

  V.scale = (key, a, P, el) => {
    const C = col(); base(C);
    const me = P.find(p => p.isMe), labels = a.items.map(x => wrap(x.label, 16));
    const g = a.items.map(x => avg(P.map(p => p.v && p.v[x.k])));
    const m = a.items.map(x => me && me.v ? me.v[x.k] : null);
    let gap = null; a.items.forEach((x, i) => { if (isNum(m[i]) && isNum(g[i])) { const d = m[i] - g[i]; if (!gap || Math.abs(d) > Math.abs(gap.d)) gap = { d, l: x.label }; } });
    el.innerHTML = head(P.length, gap && Math.abs(gap.d) >= 1 ? `나와 그룹 차이가 가장 큰 문항: <b>${esc(gap.l)}</b> (${gap.d > 0 ? '+' : ''}${r1(gap.d)})` : (me ? '그룹 평균과 비슷한 패턴이에요' : '')) + '<div class="ch"></div>';
    chart(key, el.querySelector('.ch'), {
      type: 'bar',
      data: { labels, datasets: [{ label: '그룹 평균', data: g, backgroundColor: alpha(C.grp, .75), borderRadius: 4, barPercentage: .9, categoryPercentage: .7 }, { label: '나', data: m, backgroundColor: C.me, borderRadius: 4, barPercentage: .9, categoryPercentage: .7 }] },
      options: { indexAxis: 'y', scales: { x: { min: a.min || 1, max: a.max || 7, ticks: { stepSize: 1 } }, y: { ticks: { color: C.ink, font: { size: 12 } } } }, plugins: { legend: legendOpt(C) } }
    }, 70 + a.items.length * 52);
  };

  V.radar = (key, a, P, el) => {
    const C = col(); base(C);
    const me = P.find(p => p.isMe);
    const g = a.axes.map(x => avg(P.map(p => p.v && p.v[x.k])));
    const m = a.axes.map(x => me && me.v && isNum(me.v[x.k]) ? me.v[x.k] : null);
    const top = a.axes.map((x, i) => ({ l: x.label, g: g[i] })).filter(x => isNum(x.g)).sort((p, q) => q.g - p.g)[0];
    el.innerHTML = head(P.length, top ? `그룹이 가장 높게 본 축: <b>${esc(top.l)}</b> (${r1(top.g)})` : '') + '<div class="ch"></div>';
    chart(key, el.querySelector('.ch'), {
      type: 'radar',
      data: { labels: a.axes.map(x => wrap(x.label, 10)), datasets: [{ label: '그룹 평균', data: g, backgroundColor: alpha(C.grp, .18), borderColor: C.grp, pointBackgroundColor: C.grp, borderWidth: 2 }, { label: '나', data: m, backgroundColor: alpha(C.me, .12), borderColor: C.me, pointBackgroundColor: C.me, borderWidth: 2, spanGaps: true }] },
      options: { scales: { r: { min: 0, max: a.max || 10, ticks: { stepSize: 2, backdropColor: 'transparent', color: C.muted }, grid: { color: C.line }, angleLines: { color: C.line }, pointLabels: { color: C.ink, font: { size: 12 } } } }, plugins: { legend: legendOpt(C) } }
    }, 320);
  };

  function optBars(key, a, P, el, multi) {
    const C = col(); base(C);
    const me = P.find(p => p.isMe);
    const mine = me ? (multi ? (me.v || []) : [me.v]) : [];
    const counts = a.options.map(o => P.filter(p => multi ? (p.v || []).includes(o.v) : p.v === o.v).length);
    const quiz = a.type === 'quiz';
    let ins = '';
    if (quiz) { const ok = P.filter(p => p.v === a.answer).length; ins = `정답률 <b>${P.length ? Math.round(ok / P.length * 100) : 0}%</b>`; }
    else { const mx = Math.max(...counts); if (mx > 0) { const o = a.options[counts.indexOf(mx)]; ins = `가장 많은 선택: <b>${esc(o.label)}</b> (${mx}명)`; if (me && !multi && me.v) ins += me.v === o.v ? ' · 나도 다수파' : ' · 나는 소수 의견'; } }
    const showAns = quiz && me && me.v;
    el.innerHTML = head(P.length, ins) + '<div class="ch"></div>' + (quiz && !showAns ? '<p class="note">답을 고르면 정답과 해설이 공개됩니다.</p>' : '');
    const colors = a.options.map(o => showAns && o.v === a.answer ? C.ok : mine.includes(o.v) ? C.me : alpha(C.grp, .75));
    chart(key, el.querySelector('.ch'), {
      type: 'bar',
      data: { labels: a.options.map((o, j) => wrap((quiz ? String.fromCharCode(65 + j) + '. ' : '') + o.label, 18)), datasets: [{ label: '인원', data: counts, backgroundColor: colors, borderRadius: 4 }] },
      options: { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 }, suggestedMax: Math.max(3, P.length) }, y: { ticks: { color: C.ink, font: { size: 12 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}명 · ${P.filter(p => multi ? (p.v || []).includes(a.options[c.dataIndex].v) : p.v === a.options[c.dataIndex].v).map(p => p.name).join(', ')}` } } } }
    }, 60 + a.options.length * 44);
    if (!quiz || showAns) el.insertAdjacentHTML('beforeend', `<div class="keyrow"><span><i style="background:${C.me}"></i>내 선택</span>${showAns ? `<span><i style="background:${C.ok}"></i>정답</span>` : ''}<span><i style="background:${alpha(C.grp, .75)}"></i>다른 선택</span></div>`);
  }
  V.choice = (k, a, P, el) => optBars(k, a, P, el, false);
  V.quiz = (k, a, P, el) => optBars(k, a, P, el, false);
  V.multi = (k, a, P, el) => optBars(k, a, P, el, true);

  const quadPlugin = {
    id: 'quadBg',
    beforeDatasetsDraw(c, _, o) {
      const { ctx, chartArea: ca, scales: { x, y } } = c; if (!o || !o.quads) return;
      ctx.save();
      ctx.strokeStyle = o.line; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x.getPixelForValue(0), ca.top); ctx.lineTo(x.getPixelForValue(0), ca.bottom); ctx.moveTo(ca.left, y.getPixelForValue(0)); ctx.lineTo(ca.right, y.getPixelForValue(0)); ctx.stroke();
      ctx.fillStyle = o.color; ctx.font = "600 12px 'Pretendard Variable', Pretendard, sans-serif";
      const q = o.quads, pad = 8;
      if (q.length === 4) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(q[0], ca.left + pad, ca.top + pad);
        ctx.textAlign = 'right'; ctx.fillText(q[1], ca.right - pad, ca.top + pad);
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(q[2], ca.left + pad, ca.bottom - pad);
        ctx.textAlign = 'right'; ctx.fillText(q[3], ca.right - pad, ca.bottom - pad);
      }
      ctx.restore();
    }
  };
  V.quadrant = (key, a, P, el) => {
    const C = col(); base(C);
    const jit = (s, i) => ((Math.sin(s * 9301 + i * 49297) * 233280) % 1) * 0.28;
    const ds = a.items.map((x, j) => {
      const pts = P.filter(p => p.v && Array.isArray(p.v[x.k])).map((p, i) => ({ x: p.v[x.k][0] + (p.isMe ? 0 : jit(j + 1, i)), y: p.v[x.k][1] + (p.isMe ? 0 : jit(i + 3, j)), name: p.name, me: p.isMe }));
      const cx = avg(pts.map(p => p.x)), cy = avg(pts.map(p => p.y));
      return { x, j, pts, cx, cy };
    });
    const ins = ds.filter(d => d.pts.length).map(d => `${esc(d.x.label)} (${r1(d.cx)}, ${r1(d.cy)})`).join(' · ');
    el.innerHTML = head(P.length, ins ? '그룹 평균 위치 ' + ins : '') + '<div class="ch"></div>';
    chart(key, el.querySelector('.ch'), {
      type: 'scatter',
      data: {
        datasets: ds.flatMap(d => [{
          label: d.x.label, data: d.pts, backgroundColor: d.pts.map(p => p.me ? C.pal[d.j % 8] : alpha(C.pal[d.j % 8], .45)),
          borderColor: d.pts.map(p => p.me ? C.ink : 'transparent'), borderWidth: d.pts.map(p => p.me ? 2.5 : 0),
          pointRadius: d.pts.map(p => p.me ? 9 : 6), pointHoverRadius: 10
        }, { label: d.x.label + ' 평균', data: isNum(d.cx) ? [{ x: d.cx, y: d.cy, name: '그룹 평균' }] : [], pointStyle: 'crossRot', pointRadius: 11, borderColor: C.pal[d.j % 8], borderWidth: 3, backgroundColor: 'transparent' }])
      },
      options: {
        scales: { x: { min: -5.5, max: 5.5, ticks: { display: false }, grid: { display: false }, title: { display: true, text: `◀ ${a.x.left}   ·   ${a.x.right} ▶`, color: C.muted } }, y: { min: -5.5, max: 5.5, ticks: { display: false }, grid: { display: false }, title: { display: true, text: `▼ ${a.y.low}   ·   ${a.y.high} ▲`, color: C.muted } } },
        plugins: { quadBg: { quads: a.quads || [], line: C.line, color: alpha(C.ink, .45) }, legend: { display: true, position: 'bottom', labels: { filter: i => !/ 평균$/.test(i.text), usePointStyle: true, boxWidth: 10, color: C.ink, generateLabels: ch => ds.map((d, i) => ({ text: d.x.label, fillStyle: C.pal[d.j % 8], strokeStyle: C.pal[d.j % 8], pointStyle: 'circle', datasetIndex: i * 2, hidden: false })) } }, tooltip: { callbacks: { label: c => `${c.raw.name}${c.raw.me ? ' (나)' : ''} · ${c.dataset.label.replace(/ 평균$/, '')}: (${r1(c.raw.x)}, ${r1(c.raw.y)})` } } }
      },
      plugins: [quadPlugin]
    }, 380);
    el.insertAdjacentHTML('beforeend', `<div class="keyrow"><span><i class="ring"></i>테두리 = 나</span><span>✕ = 그룹 평균</span></div>`);
  };

  V.spectrum = (key, a, P, el) => {
    const C = col();
    const me = P.find(p => p.isMe);
    let ins = '';
    const rows = a.items.map((x, j) => {
      const vals = P.map(p => ({ v: p.v && p.v[x.k], name: p.name, me: p.isMe })).filter(q => isNum(q.v));
      const g = avg(vals.map(q => q.v));
      const bins = {}; vals.forEach(q => { (bins[q.v] = bins[q.v] || []).push(q); });
      const W = 600, X = v => 30 + (v + 5) / 10 * (W - 60);
      let dots = '';
      Object.keys(bins).forEach(b => bins[b].sort((p, q) => (p.me ? -1 : 1)).forEach((q, i) => {
        const cy = 40 - i * 11; if (cy < 4) return;
        dots += `<circle cx="${X(+b)}" cy="${cy}" r="${q.me ? 7 : 5}" fill="${q.me ? C.me : alpha(C.grp, .6)}" ${q.me ? `stroke="${C.ink}" stroke-width="1.5"` : ''}><title>${esc(q.name)}${q.me ? ' (나)' : ''}: ${q.v > 0 ? '+' : ''}${q.v}</title></circle>`;
      }));
      const ticks = Array.from({ length: 11 }, (_, i) => `<line x1="${X(i - 5)}" x2="${X(i - 5)}" y1="44" y2="${i === 5 ? 54 : 50}" stroke="${C.line}" stroke-width="${i === 5 ? 2 : 1}"/>`).join('');
      const gm = isNum(g) ? `<path d="M${X(g)} 60 l-6 9 h12z" fill="${C.ink}"/><text x="${X(g)}" y="82" text-anchor="middle" font-size="11" fill="${C.ink}" font-weight="700">평균 ${g > 0 ? '+' : ''}${r1(g)}</text>` : '';
      if (me && me.v && isNum(me.v[x.k]) && isNum(g) && !ins) { const d = me.v[x.k] - g; ins = Math.abs(d) < 1 ? '나는 그룹 평균 근처에 있어요' : `나는 평균보다 <b>${d > 0 ? esc(x.right) : esc(x.left)}</b> 쪽 (${d > 0 ? '+' : ''}${r1(d)})`; }
      return `<div class="srow2"><div class="sq">${esc(x.label)}</div>
        <svg viewBox="0 0 600 86" class="strip" role="img" aria-label="${esc(x.label)} 분포">
          <line x1="30" x2="570" y1="47" y2="47" stroke="${C.line}" stroke-width="2"/>${ticks}${dots}${gm}
        </svg>
        <div class="spoles"><span>◀ ${esc(x.left)}</span><span>${esc(x.right)} ▶</span></div></div>`;
    }).join('');
    el.innerHTML = head(P.length, ins) + rows + `<div class="keyrow"><span><i style="background:${C.me}"></i>나</span><span><i style="background:${alpha(C.grp, .6)}"></i>참가자</span><span>▲ 그룹 평균</span></div>`;
  };

  V.allocate = (key, a, P, el) => {
    const C = col(); base(C);
    const me = P.find(p => p.isMe);
    const others = P.filter(p => !p.isMe).slice(0, 10);
    const rowsP = [{ name: '그룹 평균', avg: true }].concat(me ? [me] : [], others);
    const g = a.items.map(x => avg(P.map(p => p.v && p.v[x.k])) || 0);
    const top = a.items.map((x, i) => ({ l: x.label, g: g[i] })).sort((p, q) => q.g - p.g)[0];
    el.innerHTML = head(P.length, top && P.length ? `그룹이 가장 많이 배분: <b>${esc(top.l)}</b> (평균 ${r1(top.g)}점)` : '') + '<div class="ch"></div>';
    chart(key, el.querySelector('.ch'), {
      type: 'bar',
      data: {
        labels: rowsP.map(p => p.avg ? '▣ 그룹 평균' : p.isMe ? '★ 나' : p.name),
        datasets: a.items.map((x, j) => ({ label: x.label, data: rowsP.map(p => p.avg ? Math.round(g[j] * 10) / 10 : (p.v && p.v[x.k]) || 0), backgroundColor: C.pal[j % 8], borderColor: C.bg, borderWidth: 1 }))
      },
      options: { indexAxis: 'y', scales: { x: { stacked: true, max: a.total || 100, ticks: { callback: v => v + '' } }, y: { stacked: true, ticks: { color: C.ink, font: c => ({ size: 12, weight: c.index < 2 ? '700' : '400' }) } } }, plugins: { legend: legendOpt(C), tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}점` } } } }
    }, 90 + rowsP.length * 30);
  };

  V.rank = (key, a, P, el) => {
    const C = col(); base(C);
    const n = a.items.length, me = P.find(p => p.isMe);
    const sc = a.items.map(x => ({ x, s: avg(P.map(p => Array.isArray(p.v) && p.v.includes(x.k) ? n - p.v.indexOf(x.k) : null)), r: avg(P.map(p => Array.isArray(p.v) && p.v.includes(x.k) ? p.v.indexOf(x.k) + 1 : null)) })).sort((p, q) => (q.s || 0) - (p.s || 0));
    el.innerHTML = head(P.length, sc[0] && isNum(sc[0].r) ? `그룹 1순위: <b>${esc(sc[0].x.label)}</b> (평균 ${r1(sc[0].r)}위)` : '') + '<div class="ch"></div>';
    const myR = k => me && Array.isArray(me.v) ? me.v.indexOf(k) + 1 : 0;
    chart(key, el.querySelector('.ch'), {
      type: 'bar',
      data: { labels: sc.map(o => wrap(o.x.label + (myR(o.x.k) ? `  (나: ${myR(o.x.k)}위)` : ''), 20)), datasets: [{ label: '평균 순위 점수', data: sc.map(o => o.s ? Math.round(o.s * 10) / 10 : 0), backgroundColor: sc.map(o => myR(o.x.k) === 1 ? C.me : alpha(C.grp, .75)), borderRadius: 4 }] },
      options: { indexAxis: 'y', scales: { x: { min: 0, max: n, title: { display: true, text: '순위 점수 (높을수록 상위)', color: C.muted } }, y: { ticks: { color: C.ink, font: { size: 12 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `평균 ${r1(sc[c.dataIndex].r)}위` } } } }
    }, 70 + n * 44);
  };

  V.text = (key, a, P, el) => {
    const list = P.filter(p => typeof p.v === 'string' && p.v.trim()).sort((p, q) => (q.isMe - p.isMe) || ((q.ts || 0) - (p.ts || 0)));
    el.innerHTML = head(list.length, list.length ? '함께 나눈 생각' : '') + (list.length ? `<div class="wall">${list.map(p => `<div class="card-note${p.isMe ? ' me' : ''}"><p>${esc(p.v)}</p><span>— ${esc(p.name)}${p.isMe ? ' (나)' : ''}</span></div>`).join('')}</div>` : '<p class="empty">아직 게시된 생각이 없습니다. 첫 번째로 남겨 보세요.</p>');
  };

  function render(key, a, P, el) { (V[a.type] || (() => { el.textContent = ''; }))(key, a, P, el); }
  function destroyAll() { Object.keys(reg).forEach(k => { try { reg[k].destroy(); } catch (e) { } delete reg[k]; }); }
  window.Viz = { render, destroyAll, chart, col, alpha, avg, r1, esc };
})();
