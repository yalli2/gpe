/* 교재 도표·표·박스 재구성 렌더러 (원문 복제 아님 — 요약·재구성) */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = r => /^Figure/.test(r) ? 'fig' : /^Table/.test(r) ? 'tab' : 'box';
  const KIND_KO = { fig: '그림', tab: '표', box: '박스' };
  const all = () => window.GPE_VIS || [];
  const order = r => { const m = r.match(/^(Figure|Table|Box) (\d+)\.(\d+)/); return m ? ({ Figure: 0, Table: 1, Box: 2 }[m[1]]) * 1000 + +m[3] : 0; };
  const forCh = n => all().filter(v => v.ch === n).sort((a, b) => order(a.ref) - order(b.ref));

  const B = {};
  B.points = v => `<ul class="rv-pts">${v.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  B.terms = v => `<dl class="rv-terms">${v.items.map(x => `<div><dt>${esc(x.t)}</dt><dd>${esc(x.d)}</dd></div>`).join('')}</dl>`;
  B.compare = v => `<div class="rv-tw"><table class="rv-tab"><thead><tr>${v.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${v.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  B.flow = v => `<ol class="rv-flow">${v.steps.map((x, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(x.t)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</div></li>`).join('')}</ol>`;
  B.cycle = v => {
    const n = v.steps.length, R = 118, cx = 160, cy = 150;
    const pos = v.steps.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    const arcs = pos.map((p, i) => { const q = pos[(i + 1) % n]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; const dx = mx - cx, dy = my - cy, k = 1.25; return `<path d="M${p[0]} ${p[1]} Q${cx + dx * k} ${cy + dy * k} ${q[0]} ${q[1]}" fill="none" stroke="var(--pc,var(--grp))" stroke-width="2" marker-end="url(#rvA)" opacity=".7"/>`; }).join('');
    return `<div class="rv-cycle"><svg viewBox="0 0 320 300" aria-hidden="true"><defs><marker id="rvA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--pc,var(--grp))"/></marker></defs>${arcs}${pos.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="15" fill="var(--pc,var(--grp))"/><text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle" fill="#fff" font-weight="800" font-size="14">${i + 1}</text>`).join('')}</svg>
      <ol>${v.steps.map(x => `<li><b>${esc(x.t)}</b>${x.d ? ` — ${esc(x.d)}` : ''}</li>`).join('')}</ol></div>`;
  };
  B.matrix = v => `<div class="rv-mx"><span class="yh">${esc(v.y.high)} ▲</span><div class="g">${v.cells.map(c => `<div><b>${esc(c.t)}</b>${c.d ? `<small>${esc(c.d)}</small>` : ''}</div>`).join('')}</div><span class="yl">▼ ${esc(v.y.low)}</span><div class="xl"><span>◀ ${esc(v.x.l)}</span><span>${esc(v.x.r)} ▶</span></div></div>`;
  B.timeline = v => `<ol class="rv-tl">${v.items.map(x => `<li><span>${esc(x.y)}</span><p>${esc(x.t)}</p></li>`).join('')}</ol>`;
  B.hub = v => `<div class="rv-hub"><div class="c">${esc(v.center)}</div><div class="ns">${v.nodes.map(x => `<div><b>${esc(x.t)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</div>`).join('')}</div></div>`;
  B.bars = (v, id) => `<div class="rv-bars" data-rvid="${esc(id)}"></div>${v.source ? `<p class="rv-src">데이터 출처(교재 인용): ${esc(v.source)}</p>` : ''}`;

  function body(v, id) { return (B[v.type] || B.points)(v, id); }
  function card(v, opts) {
    opts = opts || {};
    const k = KIND(v.ref), id = 'rv-' + v.ref.replace(/\W+/g, '');
    return `<details class="rv rv-${k}" ${opts.open ? 'open' : ''} data-ref="${esc(v.ref)}" id="${id}">
      <summary><span class="rv-ref">${esc(v.ref)}</span><span class="rv-t"><b>${esc(v.title)}</b><small>${esc(v.note)}</small></span>${opts.chLabel ? `<span class="rv-ch">${esc(opts.chLabel)}</span>` : ''}</summary>
      <div class="rv-body">${body(v, id)}
        ${opts.extra || ''}
        <p class="rv-foot">교재 ${esc(v.ref)}${v.page ? ` (p.${esc(v.page)})` : ''}의 내용을 한국어로 요약·재구성한 학습 자료입니다. 원문 그대로가 아닙니다.</p></div></details>`;
  }
  // 펼칠 때 bars 차트 그리기
  function hydrate(root) {
    root.querySelectorAll('details.rv').forEach(d => {
      const draw = () => {
        const box = d.querySelector('.rv-bars'); if (!box || box.dataset.done) return;
        const v = all().find(x => x.ref === d.dataset.ref); if (!v) return;
        box.dataset.done = 1;
        const C = window.Viz.col();
        window.Viz.chart('rvb-' + v.ref, box, {
          type: 'bar',
          data: { labels: v.labels, datasets: v.series.map((s, i) => ({ label: s.name, data: s.values, backgroundColor: C.pal[i % 8], borderRadius: 3 })) },
          options: { scales: { y: { beginAtZero: true, title: { display: !!v.unit, text: v.unit || '', color: C.muted } } }, plugins: { legend: { display: v.series.length > 1, position: 'bottom', labels: { color: C.ink, boxWidth: 10 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw == null ? '—' : c.raw}${v.unit ? ' ' + v.unit : ''}` } } } }
        }, 260);
      };
      if (d.open) draw();
      d.addEventListener('toggle', () => { if (d.open) draw(); });
    });
  }
  window.RV = { forCh, card, hydrate, all, KIND, KIND_KO, order };
})();
