/* 앱: 라우팅 · 화면 렌더링 */
(function () {
  const M = window.GPE_META, S = window.Store, W = window.W, V = window.Viz;
  const esc = W.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const CH = () => (window.GPE_CH || []).slice().sort((a, b) => a.n - b.n);
  const chByN = n => CH().find(c => c.n === n);
  const partOf = c => M.parts[c.part] || M.parts[0];
  const chLabel = c => c.n === 0 ? '서론' : c.n + '장';
  let view = null, pending = {}, renderTimer = null, lastSig = '';

  /* ---------- 공통 ---------- */
  function participants(n, aid) {
    const d = S.state.ch[n] || {}, U = S.state.users || {};
    return Object.keys(d).filter(uid => d[uid] && d[uid][aid] !== undefined && d[uid][aid] !== null && d[uid][aid] !== '')
      .map(uid => ({ uid, name: (U[uid] && U[uid].name) || '참가자', isMe: uid === S.uid, v: d[uid][aid], ts: d[uid]._ts }));
  }
  function userIds() { const ids = new Set(Object.keys(S.state.users || {})); if (S.uid) ids.add(S.uid); return [...ids]; }
  function progressOf(uid, c) { return W.chapterProgress(c, (S.state.ch[c.n] || {})[uid]); }
  function ring(p, size, color) {
    const r = (size - 6) / 2, C = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color || 'var(--me)'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * p} ${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${p >= 1 && size < 60 ? `<path d="M${size * .3} ${size * .52} l${size * .14} ${size * .14} l${size * .26} -${size * .3}" fill="none" stroke="${color || 'var(--me)'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
  }
  function header(active) {
    const n = userIds().length;
    return `<header class="top">
      <a class="brand" href="#/map"><span class="logo" aria-hidden="true">${logo()}</span><span><b>${esc(M.name)}</b><small>${esc(M.nameEn)} · GPE</small></span></a>
      <nav class="nav">
        <a href="#/map" class="${active === 'map' ? 'on' : ''}">챕터 지도</a>
        <a href="#/visuals" class="${active === 'visuals' ? 'on' : ''}">도표 모음</a>
        <a href="#/compass" class="${active === 'compass' ? 'on' : ''}">GPE 나침반</a>
        <a href="#/room" class="${active === 'room' ? 'on' : ''}">진행 현황</a>
      </nav>
      <div class="who">
        <span class="sess ${S.remote ? 'live' : 'demo'}" title="${S.remote ? '실시간 공유 모드' : '데모 모드'}"><i></i>${esc(S.room)} · ${n}명</span>
        <button class="btn ghost sm" id="menuBtn" aria-haspopup="true" aria-expanded="false">${esc(S.name)} ▾</button>
        <div class="menu" id="menu" hidden>
          <button data-act="copy">초대 링크 복사</button>
          <button data-act="resetMine">내 응답 모두 지우기</button>
          ${S.remote ? '' : '<button data-act="resetDemo">데모 데이터 초기화</button>'}
          <button data-act="leave">세션 나가기</button>
        </div>
      </div>
    </header>${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}`;
  }
  function logo() { return `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3 20h34M20 3c-6 5-6 29 0 34M20 3c6 5 6 29 0 34" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55"/><path d="M8 27c6-9 15-1 24-12" fill="none" stroke="var(--me)" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="15" r="3" fill="var(--me)"/></svg>`; }
  function bindHeader() {
    const b = $('#menuBtn'), m = $('#menu'); if (!b) return;
    b.onclick = e => { e.stopPropagation(); m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
    document.addEventListener('click', () => { if (m) m.hidden = true; }, { once: true });
    m.onclick = e => {
      const act = e.target.dataset.act; if (!act) return;
      if (act === 'copy') { const url = location.origin + location.pathname + '?room=' + encodeURIComponent(S.room); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('초대 링크를 복사했습니다'), () => toast(url)); }
      if (act === 'resetMine' && confirm('이 세션에서 내가 입력한 모든 응답을 지울까요?')) { S.resetMine(); toast('내 응답을 지웠습니다'); route(); }
      if (act === 'resetDemo' && confirm('데모 데이터를 처음 상태로 되돌릴까요?')) { S.resetDemo(); route(); }
      if (act === 'leave') { S.leave(); location.hash = ''; route(); }
    };
  }
  function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }

  /* ---------- 입장 ---------- */
  function joinView() {
    const qs = new URLSearchParams(location.search), last = S.restore();
    const room = qs.get('room') || (last && last.room) || '';
    const total = CH().length, acts = CH().reduce((s, c) => s + (c.activities || []).length, 0);
    app.innerHTML = `<main class="join">
      <section class="jhero">
        <div class="jtext">
          <p class="eyebrow">HR 성인교육 · 글로벌 정치경제 실시간 워크숍</p>
          <h1>${esc(M.name)}<span>${esc(M.nameEn)}</span></h1>
          <p class="lead">${esc(M.tagline)}</p>
          <p class="sub">공급망, 환율, 무역전쟁, 탈성장, 자동화와 일자리, 조세와 이주까지 — 뉴스 속 세계경제 뒤에 있는 <b>권력의 흐름</b>을 함께 읽습니다. 챕터·논문마다 직접 판단하고 배분하고 지도에 찍어 보면, 내 생각과 동료들의 생각이 곧바로 도표로 그려집니다.</p>
          <ul class="stats"><li><b>${total}</b>개 논문</li><li><b>${M.parts.length - 1}</b>개 파트 + 서론</li><li><b>${acts}</b>개 실습</li><li><b>6</b>축 GPE 나침반</li></ul>
        </div>
        <form class="jform" id="jf">
          <h2>세션 입장</h2>
          <label>세션 코드<input id="jr" required maxlength="30" placeholder="예) hr2026" value="${esc(room)}" autocomplete="off"></label>
          <label>닉네임<input id="jn" required maxlength="16" placeholder="예) 서윤" value="${esc((last && last.name) || '')}" autocomplete="nickname"></label>
          <button class="btn" type="submit">입장하기 →</button>
          <p class="mode ${S.remote ? 'live' : 'demo'}">${S.remote ? '● 실시간 공유 모드 — 같은 세션 코드의 참가자와 결과가 공유됩니다.' : '● 데모 모드 — 이 브라우저에만 저장되며 샘플 참가자 8명이 함께 표시됩니다. (실시간 공유는 README의 Firebase 설정 참고)'}</p>
          <p class="priv">닉네임만 사용하세요. 개인정보나 회사 기밀은 적지 마세요.</p>
        </form>
      </section>
      <section class="jparts">${M.parts.map(p => `<div class="jp" style="--pc:${p.color}"><span>${esc(p.no)}</span><b>${esc(p.ko)}</b><small>${esc(p.desc)}</small></div>`).join('')}</section>
      <footer class="foot">교재: ${esc(M.book)}</footer>
    </main>`;
    $('#jf').onsubmit = async e => { e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true; b.textContent = '입장 중…'; await S.join($('#jr').value, $('#jn').value); if (!location.hash || location.hash === '#/') location.hash = '#/map'; route(); };
  }

  /* ---------- 챕터 지도 ---------- */
  function mapView() {
    S.focus('all');
    const list = CH();
    const myP = list.map(c => progressOf(S.uid, c));
    const overall = myP.length ? myP.reduce((s, x) => s + x, 0) / myP.length : 0;
    const next = list.find((c, i) => myP[i] < 1);
    const html = `${header('map')}<main class="wrap">
      <section class="mhero">
        <div><p class="eyebrow">${esc(S.name)}님의 여정</p><h1>세계를 움직이는 ${list.length}개의 대화</h1><p class="lead">원하는 챕터부터 시작하세요. 각 실습을 마치면 결과가 곧바로 모두의 화면에 반영됩니다.</p>
        ${next ? `<a class="btn" href="#/ch/${next.n}">${myP.some(x => x > 0) ? '이어서 하기' : '시작하기'} · ${chLabel(next)} ${esc(next.ko)} →</a>` : '<span class="done-all">모든 챕터를 완료했습니다 🎉</span>'}</div>
        <div class="mring">${ring(overall, 132)}<div><b>${Math.round(overall * 100)}%</b><small>전체 진행</small></div></div>
      </section>
      ${M.parts.map(p => {
      const cs = list.filter(c => c.part === p.id); if (!cs.length) return '';
      const pp = cs.reduce((s, c) => s + progressOf(S.uid, c), 0) / cs.length;
      return `<section class="part" style="--pc:${p.color}">
          <div class="phead"><span class="pno">${esc(p.no)}</span><div><h2>${esc(p.ko)}</h2><p>${esc(p.en)} — ${esc(p.desc)}</p></div><span class="ppct">${Math.round(pp * 100)}%</span></div>
          <div class="cards">${cs.map(c => {
        const pr = progressOf(S.uid, c), cnt = Object.keys(S.state.ch[c.n] || {}).length;
        return `<a class="ccard ${pr >= 1 ? 'done' : ''}" href="#/ch/${c.n}">
              <div class="ctop"><span class="cno">${c.n === 0 ? '서론' : String(c.n).padStart(2, '0')}</span><span class="chip">${esc(c.tag)}</span>${ring(pr, 34, p.color)}</div>
              <h3>${esc(c.ko)}</h3><p class="cen">${esc(c.en)}</p>
              <div class="cfoot"><span>${esc(c.authors)}</span><span>${cnt}명 참여</span></div></a>`;
      }).join('')}</div></section>`;
    }).join('')}
      <footer class="foot">교재: ${esc(M.book)}</footer></main>`;
    app.innerHTML = html; bindHeader();
  }

  /* ---------- 챕터 ---------- */
  function chapterView(n) {
    const c = chByN(n); if (!c) { location.hash = '#/map'; return; }
    S.focus(n);
    const p = partOf(c), list = CH(), idx = list.indexOf(c), prev = list[idx - 1], next = list[idx + 1];
    const figActs = {}; (c.activities || []).forEach(a => { if (a.fig) figActs[a.fig] = a; });
    app.innerHTML = `${header('ch')}<main class="wrap chap" style="--pc:${p.color}">
      <div class="crumb"><a href="#/map">챕터 지도</a> / ${esc(p.no)} ${esc(p.ko)}</div>
      <section class="chead">
        <div class="cnum">${c.n === 0 ? '서론' : c.n}</div>
        <div class="ctitle"><span class="chip">${esc(c.tag)}</span><h1>${esc(c.ko)}</h1><p class="en">${esc(c.en)}</p><p class="by">${esc(c.authors)} · pp. ${esc(c.pages)}</p></div>
        <div class="cprog" id="cprog"></div>
      </section>
      <section class="hook"><span>오늘의 질문</span><p>${esc(c.hook)}</p></section>
      <section class="brief">
        <div class="thesis"><h2>핵심 주장</h2><p>${esc(c.thesis)}</p><ul>${(c.points || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="concepts"><h2>핵심 개념</h2>${(c.concepts || []).map(k => `<details><summary>${esc(k.t)}</summary><p>${esc(k.d)}</p></details>`).join('')}</div>
        ${visualsBlock(c, figActs)}
      </section>
      <h2 class="sect">실습 <small>입력하면 자동 저장되고, 오른쪽 결과가 실시간으로 갱신됩니다</small></h2>
      <div id="acts"></div>
      <section class="discuss"><span>그룹 토론</span><p>${esc(c.discuss)}</p></section>
      <nav class="pager">${prev ? `<a href="#/ch/${prev.n}">← ${chLabel(prev)} ${esc(prev.ko)}</a>` : '<span></span>'}${next ? `<a href="#/ch/${next.n}">${chLabel(next)} ${esc(next.ko)} →</a>` : '<a href="#/compass">GPE 나침반 보기 →</a>'}</nav>
    </main>`;
    bindHeader();
    if (window.RV) { RV.hydrate(app); const ra = $('#rvAll'); if (ra) ra.onclick = () => { const ds = app.querySelectorAll('details.rv'); const open = ![...ds].every(d => d.open); ds.forEach(d => d.open = open); ra.textContent = open ? '모두 접기' : '모두 펼치기'; }; }
    const box = $('#acts');
    (c.activities || []).forEach((a, i) => {
      const el = document.createElement('article'); el.className = 'act'; el.id = 'act-' + a.id;
      el.innerHTML = `<div class="ain"><div class="ahead"><span class="ano">${i + 1}</span><span class="atype">${W.TYPE_LABEL[a.type] || ''}</span>${a.fig ? `<span class="afig">교재 ${esc(a.fig)} 재현</span>` : ''}<span class="adone" hidden>✓ 완료</span></div>
        <h3>${esc(a.title)}</h3><p class="aprompt">${esc(a.prompt)}${a.src ? ` <small>(${esc(a.src)})</small>` : ''}</p><div class="aw"></div></div>
        <div class="aout"><div class="aouthead"><span>실시간 결과</span><button class="zoom" title="크게 보기" aria-label="결과 크게 보기">⤢</button></div><div class="res"></div></div>`;
      box.appendChild(el);
      drawInput(c, a, el);
      el.querySelector('.zoom').onclick = () => openZoom(c, a);
    });
    drawResults(c);
  }
  function visualsBlock(c, figActs) {
    const rv = window.RV ? RV.forCh(c.n) : [];
    const link = ref => figActs[ref] ? `<a href="#act-${figActs[ref].id}" class="tolink">→ 실습 「${esc(figActs[ref].title)}」에서 직접 해보기</a>` : '';
    if (rv.length) return `<div class="visuals"><div class="vh"><h2>교재 속 도표·표·박스 <small>${rv.length}개 · 요약·재구성</small></h2><button class="btn ghost sm" id="rvAll">모두 펼치기</button></div>${rv.map(v => RV.card(v, { extra: link(v.ref) })).join('')}</div>`;
    if (!(c.visuals || []).length) return '';
    return `<div class="visuals"><h2>교재 속 도표</h2>${c.visuals.map(v => `<div class="vis"><span class="ref">${esc(v.ref)}</span><div><b>${esc(v.title)}</b><small>${esc(v.note || '')}</small>${link(v.ref)}</div></div>`).join('')}</div>`;
  }
  function drawInput(c, a, el) {
    const d = S.myData(c.n) || {};
    const w = el.querySelector('.aw'); w.innerHTML = '';
    w.appendChild(W.render(a, d[a.id], (val, opt) => onInput(c, a, el, val, opt || {})));
    el.querySelector('.adone').hidden = !W.isDone(a, d[a.id]);
  }
  function onInput(c, a, el, val, opt) {
    const key = c.n + ':' + a.id;
    const commit = () => {
      delete pending[key];
      const d = Object.assign({}, S.myData(c.n) || {}); d[a.id] = val; delete d._ts;
      S.save(c.n, d);
      el.querySelector('.adone').hidden = !W.isDone(a, val);
      if (['choice', 'quiz', 'multi', 'rank'].includes(a.type)) drawInput(c, a, el);
    };
    clearTimeout(pending[key]);
    if (opt.debounce) pending[key] = setTimeout(commit, opt.quiet ? 700 : 300); else commit();
  }
  function drawResults(c) {
    if (!c) return;
    (c.activities || []).forEach(a => {
      const el = $('#act-' + a.id + ' .res'); if (!el) return;
      V.render('c' + c.n + a.id, a, participants(c.n, a.id), el);
    });
    const cp = $('#cprog');
    if (cp) { const pr = progressOf(S.uid, c), cnt = Object.keys(S.state.ch[c.n] || {}).length; cp.innerHTML = `${ring(pr, 64, partOf(c).color)}<div><b>${Math.round(pr * 100)}%</b><small>내 진행 · ${cnt}명 참여</small></div>`; }
    const z = $('#zoom'); if (z && z._a) V.render('zoom', z._a, participants(c.n, z._a.id), z.querySelector('.zres'));
  }
  function openZoom(c, a) {
    closeZoom();
    const z = document.createElement('div'); z.id = 'zoom'; z.className = 'zoom-wrap';
    z.innerHTML = `<div class="zbox" role="dialog" aria-modal="true" aria-label="${esc(a.title)}"><div class="zhead"><div><small>${chLabel(c)} · ${esc(c.ko)}</small><h3>${esc(a.title)}</h3><p>${esc(a.prompt)}</p></div><button class="btn ghost sm" id="zclose">닫기 ✕</button></div><div class="zres res"></div></div>`;
    z._a = a; document.body.appendChild(z); document.body.classList.add('noscroll');
    z.onclick = e => { if (e.target === z) closeZoom(); };
    $('#zclose').onclick = closeZoom;
    document.addEventListener('keydown', escClose);
    V.render('zoom', a, participants(c.n, a.id), z.querySelector('.zres'));
  }
  function escClose(e) { if (e.key === 'Escape') closeZoom(); }
  function closeZoom() { const z = $('#zoom'); if (z) { z.remove(); document.body.classList.remove('noscroll'); document.removeEventListener('keydown', escClose); } }

  /* ---------- GPE 나침반 ---------- */
  function compassScores() {
    const out = {}; // uid -> axis -> {sum, n}
    const items = {}; M.axes.forEach(x => items[x.k] = []);
    CH().forEach(c => (c.activities || []).forEach(a => {
      if (a.type !== 'spectrum') return;
      a.items.forEach(it => {
        if (!it.axis || !items[it.axis]) return;
        items[it.axis].push({ c, a, it });
        const d = S.state.ch[c.n] || {};
        Object.keys(d).forEach(uid => {
          const v = d[uid] && d[uid][a.id] && d[uid][a.id][it.k];
          if (typeof v !== 'number') return;
          const o = (out[uid] = out[uid] || {}), s = (o[it.axis] = o[it.axis] || { sum: 0, n: 0 });
          s.sum += v * (it.dir === -1 ? -1 : 1); s.n++;
        });
      });
    }));
    return { out, items };
  }
  let cmpX = 'SM', cmpY = 'OC';
  function compassView() {
    S.focus('all');
    const { out, items } = compassScores(), U = S.state.users || {}, C = V.col();
    const val = (uid, k) => out[uid] && out[uid][k] ? out[uid][k].sum / out[uid][k].n : null;
    const uids = Object.keys(out);
    const mine = M.axes.map(x => ({ x, v: val(S.uid, x.k), n: out[S.uid] && out[S.uid][x.k] ? out[S.uid][x.k].n : 0 }));
    const lean = v => v == null ? '아직 응답 없음' : Math.abs(v) < 0.75 ? '균형' : (v < 0 ? '◀ ' : '') + (Math.abs(v) < 2 ? '약간 ' : Math.abs(v) < 3.5 ? '' : '강하게 ') + (v < 0 ? '' : '') + '' + (v > 0 ? ' ▶' : '');
    const leanTxt = (x, v) => v == null ? '아직 응답 없음' : Math.abs(v) < 0.75 ? '균형 잡힌 위치' : `${Math.abs(v) < 2 ? '약간 ' : Math.abs(v) < 3.5 ? '' : '뚜렷하게 '}${v < 0 ? x.l : x.r} 쪽`;
    const strip = x => {
      const W0 = 640, X = v => 30 + (v + 5) / 10 * (W0 - 60);
      const vals = uids.map(u => ({ u, v: val(u, x.k) })).filter(o => o.v != null);
      const g = V.avg(vals.map(o => o.v));
      const dots = vals.sort((p, q) => (p.u === S.uid) - (q.u === S.uid)).map((o, i) => { const me = o.u === S.uid; return `<circle cx="${X(o.v)}" cy="${me ? 34 : 34 + ((i % 5) - 2) * 6}" r="${me ? 8 : 5}" fill="${me ? C.me : V.alpha(C.grp, .55)}" ${me ? `stroke="${C.ink}" stroke-width="1.5"` : ''}><title>${esc((U[o.u] && U[o.u].name) || '참가자')}: ${V.r1(o.v)}</title></circle>`; }).join('');
      return `<svg viewBox="0 0 ${W0} 74" class="strip"><rect x="30" y="31" width="${W0 - 60}" height="6" rx="3" fill="url(#gr)"/><line x1="${X(0)}" x2="${X(0)}" y1="18" y2="50" stroke="${C.line}" stroke-width="2"/>${dots}${g != null ? `<path d="M${X(g)} 56 l-6 9 h12z" fill="${C.ink}"/>` : ''}</svg>`;
    };
    app.innerHTML = `${header('compass')}<main class="wrap">
      <section class="mhero"><div><p class="eyebrow">프로그램 전체 종합</p><h1>GPE 나침반</h1><p class="lead">챕터 곳곳의 ‘스펙트럼’ 실습 중 6개 핵심 축에 연결된 문항(${Object.values(items).reduce((s, a) => s + a.length, 0)}개)을 모아, 내가 세계 정치경제를 바라보는 관점의 좌표를 그립니다. 응답이 쌓일수록 정확해집니다.</p></div></section>
      <svg width="0" height="0" style="position:absolute"><defs><linearGradient id="gr"><stop offset="0" stop-color="${C.grp}" stop-opacity=".35"/><stop offset=".5" stop-color="${C.line}"/><stop offset="1" stop-color="${C.me}" stop-opacity=".35"/></linearGradient></defs></svg>
      <section class="axes">${M.axes.map((x, i) => `<div class="axis"><div class="axh"><b>${esc(x.ko)}</b><span class="mylean">${esc(leanTxt(x, mine[i].v))}${mine[i].v != null ? ` <em>${mine[i].v > 0 ? '+' : ''}${V.r1(mine[i].v)}</em>` : ''}</span></div>${strip(x)}<div class="spoles"><span>◀ ${esc(x.l)}</span><span>${esc(x.r)} ▶</span></div><details class="axsrc"><summary>연결된 문항 ${items[x.k].length}개 · 내 응답 ${mine[i].n}개</summary><ul>${items[x.k].map(o => `<li><a href="#/ch/${o.c.n}">${chLabel(o.c)}</a> ${esc(o.it.label)}</li>`).join('') || '<li>아직 없음</li>'}</ul></details></div>`).join('')}</section>
      <section class="panel"><div class="ph"><h2>참가자 관점 지도</h2><div class="sel"><label>가로 <select id="sx">${M.axes.map(x => `<option value="${x.k}" ${x.k === cmpX ? 'selected' : ''}>${esc(x.ko)}</option>`).join('')}</select></label><label>세로 <select id="sy">${M.axes.map(x => `<option value="${x.k}" ${x.k === cmpY ? 'selected' : ''}>${esc(x.ko)}</option>`).join('')}</select></label></div></div><div id="cmap"></div></section>
      <section class="panel"><h2>관점 레이더 <small>(각 축에서 오른쪽 극으로 기운 정도, 0~10)</small></h2><div id="cradar"></div></section>
    </main>`;
    bindHeader();
    const drawMap = () => {
      const ax = M.axes.find(x => x.k === cmpX), ay = M.axes.find(x => x.k === cmpY);
      const pts = uids.map(u => ({ x: val(u, cmpX), y: val(u, cmpY), name: (U[u] && U[u].name) || '참가자', me: u === S.uid })).filter(p => p.x != null && p.y != null);
      V.chart('cmap', $('#cmap'), {
        type: 'scatter',
        data: { datasets: [{ label: '참가자', data: pts, backgroundColor: pts.map(p => p.me ? C.me : V.alpha(C.grp, .6)), borderColor: pts.map(p => p.me ? C.ink : 'transparent'), borderWidth: pts.map(p => p.me ? 2 : 0), pointRadius: pts.map(p => p.me ? 10 : 7) }] },
        options: { scales: { x: { min: -5, max: 5, title: { display: true, text: `◀ ${ax.l} · ${ax.r} ▶`, color: C.muted } }, y: { min: -5, max: 5, title: { display: true, text: `▼ ${ay.l} · ${ay.r} ▲`, color: C.muted } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.name}${c.raw.me ? ' (나)' : ''}: (${V.r1(c.raw.x)}, ${V.r1(c.raw.y)})` } } } },
        plugins: [{ id: 'names', afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "12px 'Pretendard Variable', sans-serif"; ctx.fillStyle = C.ink; ch.getDatasetMeta(0).data.forEach((el, i) => ctx.fillText(pts[i].name + (pts[i].me ? ' (나)' : ''), el.x + 10, el.y + 4)); ctx.restore(); } }]
      }, 420);
    };
    $('#sx').onchange = e => { cmpX = e.target.value; V.destroyAll(); drawMap(); drawRadar(); };
    $('#sy').onchange = e => { cmpY = e.target.value; V.destroyAll(); drawMap(); drawRadar(); };
    const drawRadar = () => {
      const g = M.axes.map(x => { const a = V.avg(uids.map(u => val(u, x.k))); return a == null ? null : Math.round((a + 5) * 10) / 10; });
      const m = M.axes.map(x => { const a = val(S.uid, x.k); return a == null ? null : Math.round((a + 5) * 10) / 10; });
      V.chart('cradar', $('#cradar'), {
        type: 'radar',
        data: { labels: M.axes.map(x => x.r), datasets: [{ label: '그룹 평균', data: g, borderColor: C.grp, backgroundColor: V.alpha(C.grp, .18), borderWidth: 2 }, { label: '나', data: m, borderColor: C.me, backgroundColor: V.alpha(C.me, .12), borderWidth: 2 }] },
        options: { scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, backdropColor: 'transparent' }, pointLabels: { color: C.ink, font: { size: 12 } } } }, plugins: { legend: { position: 'bottom', labels: { color: C.ink } } } }
      }, 360);
    };
    drawMap(); drawRadar();
  }

  /* ---------- 진행 현황 ---------- */
  function roomView() {
    S.focus('all');
    const list = CH(), U = S.state.users || {};
    const ids = userIds().map(u => ({ u, name: (U[u] && U[u].name) || (u === S.uid ? S.name : '참가자'), p: list.map(c => progressOf(u, c)) }))
      .map(o => Object.assign(o, { tot: o.p.reduce((s, x) => s + x, 0) / list.length })).sort((a, b) => (b.u === S.uid) - (a.u === S.uid) || b.tot - a.tot);
    const C = V.col();
    app.innerHTML = `${header('room')}<main class="wrap">
      <section class="mhero"><div><p class="eyebrow">세션 「${esc(S.room)}」</p><h1>진행 현황</h1><p class="lead">참가자 ${ids.length}명 · 칸을 누르면 해당 챕터로 이동합니다. 진행자는 이 화면을 띄워 놓고 속도를 조절하세요.</p></div>
      <div class="mring">${ring(V.avg(ids.map(o => o.tot)) || 0, 132, C.grp)}<div><b>${Math.round((V.avg(ids.map(o => o.tot)) || 0) * 100)}%</b><small>평균 진행</small></div></div></section>
      <section class="panel"><h2>챕터별 참여 인원</h2><div id="rbar"></div></section>
      <section class="panel"><h2>참가자 × 챕터 매트릭스</h2><div class="mx-wrap"><table class="mx"><thead><tr><th>참가자</th>${list.map(c => `<th style="--pc:${partOf(c).color}"><a href="#/ch/${c.n}" title="${esc(c.ko)}">${c.n === 0 ? '서' : c.n}</a></th>`).join('')}<th>계</th></tr></thead>
        <tbody>${ids.map(o => `<tr class="${o.u === S.uid ? 'me' : ''}"><th>${esc(o.name)}${o.u === S.uid ? ' (나)' : ''}</th>${o.p.map((p, i) => `<td><a href="#/ch/${list[i].n}" style="--a:${p}" title="${esc(list[i].ko)} ${Math.round(p * 100)}%"></a></td>`).join('')}<td class="tot">${Math.round(o.tot * 100)}%</td></tr>`).join('')}</tbody></table></div>
        <div class="keyrow"><span><i style="background:var(--line)"></i>미시작</span><span><i style="background:${V.alpha(C.grp, .45)}"></i>진행 중</span><span><i style="background:${C.grp}"></i>완료</span></div></section>
    </main>`;
    bindHeader();
    const cnt = list.map(c => Object.keys(S.state.ch[c.n] || {}).length);
    V.chart('rbar', $('#rbar'), {
      type: 'bar',
      data: { labels: list.map(c => c.n === 0 ? '서론' : c.n), datasets: [{ label: '참여 인원', data: cnt, backgroundColor: list.map(c => partOf(c).color), borderRadius: 3 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { autoSkip: false, font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => { const c = list[i[0].dataIndex]; return `${chLabel(c)} ${c.ko}`; } } } } }
    }, 220);
  }

  /* ---------- 도표 모음 ---------- */
  let vf = { part: 'all', kind: 'all', q: '' };
  function visualsView() {
    S.focus('all');
    const list = (window.RV ? RV.all() : []).slice().sort((a, b) => a.ch - b.ch || RV.order(a.ref) - RV.order(b.ref));
    const cnt = k => list.filter(v => RV.KIND(v.ref) === k).length;
    app.innerHTML = `${header('visuals')}<main class="wrap">
      <section class="mhero"><div><p class="eyebrow">교재를 펼치지 않고 바로 찾아보기</p><h1>도표 모음</h1><p class="lead">교재의 그림 ${cnt('fig')}개 · 표 ${cnt('tab')}개 · 박스 ${cnt('box')}개를 한국어로 요약·재구성했습니다. 원문을 그대로 옮긴 것이 아니라 학습용으로 다시 정리한 자료이며, 각 항목에 교재 쪽수를 표시했습니다.</p></div></section>
      <section class="vfilter">
        <input id="vq" type="search" placeholder="검색: 헤게모니, 가치사슬, BRICS, 조세…" value="${esc(vf.q)}" aria-label="도표 검색">
        <div class="seg" id="vk">${[['all', '전체'], ['fig', '그림'], ['tab', '표'], ['box', '박스']].map(([k, l]) => `<button data-k="${k}" class="${vf.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <select id="vp" aria-label="파트 선택"><option value="all">모든 파트</option>${M.parts.map(p => `<option value="${p.id}" ${String(vf.part) === String(p.id) ? 'selected' : ''}>${esc(p.no)} ${esc(p.ko)}</option>`).join('')}</select>
        <button class="btn ghost sm" id="vopen">모두 펼치기</button>
      </section>
      <div id="vlist"></div></main>`;
    bindHeader();
    const draw = () => {
      const q = vf.q.trim().toLowerCase();
      const f = list.filter(v => { const c = chByN(v.ch); if (!c) return false;
        if (vf.part !== 'all' && String(c.part) !== String(vf.part)) return false;
        if (vf.kind !== 'all' && RV.KIND(v.ref) !== vf.kind) return false;
        return !q || JSON.stringify(v).toLowerCase().includes(q) || c.ko.toLowerCase().includes(q); });
      const groups = []; f.forEach(v => { let g = groups[groups.length - 1]; if (!g || g.n !== v.ch) groups.push(g = { n: v.ch, items: [] }); g.items.push(v); });
      $('#vlist').innerHTML = f.length ? groups.map(g => { const c = chByN(g.n), p = partOf(c);
        return `<section class="vgroup" style="--pc:${p.color}"><h2><a href="#/ch/${c.n}"><span>${chLabel(c)}</span> ${esc(c.ko)}</a><small>${esc(c.authors)}</small></h2>${g.items.map(v => RV.card(v, { open: !!q })).join('')}</section>`; }).join('') : '<p class="empty">조건에 맞는 항목이 없습니다.</p>';
      RV.hydrate($('#vlist'));
    };
    let t; $('#vq').oninput = e => { clearTimeout(t); t = setTimeout(() => { vf.q = e.target.value; draw(); }, 200); };
    $('#vk').onclick = e => { const k = e.target.dataset.k; if (!k) return; vf.kind = k; $('#vk').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); draw(); };
    $('#vp').onchange = e => { vf.part = e.target.value; draw(); };
    $('#vopen').onclick = e => { const ds = $('#vlist').querySelectorAll('details.rv'); const open = ![...ds].every(d => d.open); ds.forEach(d => d.open = open); e.target.textContent = open ? '모두 접기' : '모두 펼치기'; };
    draw();
  }

  /* ---------- 라우터 ---------- */
  function route() {
    closeZoom();
    V.destroyAll();
    if (!S.room) {
      const last = S.restore(), qs = new URLSearchParams(location.search);
      if (last && (!qs.get('room') || qs.get('room') === last.room)) { S.join(last.room, last.name).then(route); return; }
      view = 'join'; joinView(); return;
    }
    const h = location.hash.replace(/^#\/?/, '');
    const m = h.match(/^ch\/(\d+)/);
    if (m) { view = 'ch:' + m[1]; chapterView(+m[1]); }
    else if (h === 'compass') { view = 'compass'; compassView(); }
    else if (h === 'room') { view = 'room'; roomView(); }
    else if (h.startsWith('visuals')) { view = 'visuals'; visualsView(); }
    else { view = 'map'; mapView(); }
    if (!m) window.scrollTo(0, 0);
  }
  // 데이터 변경 시: 챕터 화면은 결과만 갱신(입력 포커스 유지), 그 외 화면은 다시 그림
  S.subscribe(() => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (!view || view === 'join') return;
      if (view.startsWith('ch:')) { drawResults(chByN(+view.slice(3))); const e = $('.err'); if (S.error && !e) { const hd = $('header.top'); if (hd) hd.insertAdjacentHTML('afterend', `<div class="err">${esc(S.error)}</div>`); } else if (!S.error && e) e.remove(); const s = $('.sess'); if (s) s.innerHTML = `<i></i>${esc(S.room)} · ${userIds().length}명`; }
      else if (view === 'visuals' || (document.activeElement && document.activeElement.tagName === 'SELECT')) return;
      else { const sig = JSON.stringify(S.state).length + ':' + userIds().length + ':' + (S.error || ''); if (sig === lastSig) return; lastSig = sig; const y = window.scrollY; route(); window.scrollTo(0, y); }
    }, 120);
  });
  window.addEventListener('hashchange', () => { route(); if (location.hash.startsWith('#/ch/')) window.scrollTo(0, 0); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => route());
  route();
})();
