/* 데이터 저장소: Firebase Realtime Database(REST 폴링) 또는 localStorage 데모 모드
 * 구조: rooms/{room}/users/{uid} = {name, ts}
 *       rooms/{room}/c{n}/{uid}   = {활동id: 값, _ts}
 */
(function () {
  const cfg = window.GPE_CONFIG || {};
  const DB = (cfg.firebaseDatabaseURL || '').replace(/\/+$/, '');
  const NS = 'gpe50';
  const SAMPLE_NAMES = ['서윤', '지훈', '하린', '도현', '민재', '수아', '태윤', '예린'];
  const SAMPLE_CUT = [1, 0.9, 0.78, 0.66, 0.55, 0.42, 0.3, 0.2]; // 진행도 차이

  const S = {
    remote: !!DB, room: null, uid: null, name: null,
    state: { users: {}, ch: {} }, subs: [], timer: null, error: null, scope: 'all', lastSync: null
  };
  const CHS = () => (window.GPE_CH || []).map(c => c.n);
  const cleanRoom = s => (s || '').trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g, '').slice(0, 30) || 'public';
  const lsKey = () => NS + ':room:' + S.room;
  const rid = () => 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };

  function normalize(raw) {
    raw = raw || {};
    const st = { users: raw.users || {}, ch: {} };
    CHS().forEach(c => st.ch[c] = raw['c' + c] || {});
    return st;
  }
  function notify() { S.subs.forEach(fn => { try { fn(S.state); } catch (e) { console.error(e); } }); }

  /* ---------- 데모(local) ---------- */
  let memRaw = null; // localStorage 사용 불가 시 대비
  function readLocal() { const v = lsGet(lsKey()); if (v) { try { return JSON.parse(v); } catch (e) { } } return memRaw; }
  function writeLocal(raw) { memRaw = raw; if (!lsSet(lsKey(), JSON.stringify(raw))) S.error = null; }
  function seedLocal() {
    const raw = { users: {} };
    const list = window.GPE_CH || [];
    SAMPLE_NAMES.forEach((n, i) => {
      const id = 'sample' + i;
      raw.users[id] = { name: n, ts: Date.now() - (i + 1) * 70000, sample: true };
      list.forEach((ch, j) => {
        if (j / Math.max(1, list.length - 1) > SAMPLE_CUT[i] + 0.001) return;
        raw['c' + ch.n] = raw['c' + ch.n] || {};
        raw['c' + ch.n][id] = window.W.sampleChapter(ch, i);
      });
    });
    return raw;
  }
  function loadLocal() {
    let raw = readLocal();
    if (!raw) { raw = seedLocal(); writeLocal(raw); }
    S.state = normalize(raw);
  }

  /* ---------- 원격(Firebase REST) ---------- */
  const base = () => `${DB}/rooms/${encodeURIComponent(S.room)}`;
  async function getJSON(path) {
    const r = await fetch(`${base()}${path}.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function fetchRemote() {
    try {
      if (S.scope === 'all') {
        const raw = await getJSON('');
        S.state = normalize(raw);
      } else {
        const n = S.scope;
        const [users, cn] = await Promise.all([getJSON('/users'), getJSON('/c' + n)]);
        S.state.users = users || {};
        S.state.ch[n] = cn || {};
      }
      if (S.uid && !S.state.users[S.uid]) S.state.users[S.uid] = { name: S.name, ts: Date.now() };
      S.error = null; S.lastSync = Date.now(); notify();
    } catch (e) { S.error = '서버에 연결할 수 없습니다 (' + e.message + ')'; notify(); }
  }
  async function putRemote(path, value) {
    const r = await fetch(`${base()}/${path}.json`, {
      method: value === null ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json' },
      body: value === null ? undefined : JSON.stringify(value)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
  function startPolling() {
    clearInterval(S.timer);
    if (!S.remote) return;
    const sec = Math.max(2, cfg.pollSeconds || 4) * (S.scope === 'all' ? 2.5 : 1);
    S.timer = setInterval(fetchRemote, sec * 1000);
  }

  /* ---------- 공개 API ---------- */
  S.join = async function (room, name) {
    S.room = cleanRoom(room);
    S.name = (name || '').trim().slice(0, 16) || '참가자';
    const key = NS + ':uid:' + S.room;
    S.uid = lsGet(key);
    if (!S.uid) { S.uid = rid(); lsSet(key, S.uid); }
    lsSet(NS + ':last', JSON.stringify({ room: S.room, name: S.name }));
    const me = { name: S.name, ts: Date.now() };
    if (S.remote) {
      S.scope = 'all';
      await fetchRemote();
      try { await putRemote('users/' + S.uid, me); } catch (e) { S.error = '참가 등록 실패: ' + e.message; }
      S.state.users[S.uid] = me;
      startPolling();
    } else {
      loadLocal();
      const raw = readLocal(); raw.users[S.uid] = me; writeLocal(raw);
      S.state = normalize(raw);
    }
    notify();
  };
  /* 지금 보고 있는 화면 범위 — 챕터 번호 또는 'all' (원격 모드에서 폴링 대상) */
  S.focus = function (scope) {
    if (S.scope === scope) return;
    S.scope = scope;
    if (S.remote && S.room) { fetchRemote(); startPolling(); }
  };
  S.refresh = function () { if (S.remote) fetchRemote(); };
  S.leave = function () { clearInterval(S.timer); S.room = S.uid = S.name = null; S.state = { users: {}, ch: {} }; lsDel(NS + ':last'); };
  S.restore = function () { try { const l = JSON.parse(lsGet(NS + ':last')); return l && l.room ? l : null; } catch (e) { return null; } };
  S.myData = function (n) { return (S.state.ch[n] || {})[S.uid] || null; };
  S.save = function (n, data) {
    const payload = Object.assign({}, data, { _ts: Date.now() });
    S.state.ch[n] = S.state.ch[n] || {};
    S.state.ch[n][S.uid] = payload;
    if (S.remote) {
      putRemote('c' + n + '/' + S.uid, payload).catch(e => { S.error = '저장 실패: ' + e.message; notify(); });
    } else {
      const raw = readLocal() || { users: {} };
      raw['c' + n] = raw['c' + n] || {};
      raw['c' + n][S.uid] = payload;
      raw.users[S.uid] = raw.users[S.uid] || { name: S.name, ts: Date.now() };
      writeLocal(raw);
    }
    notify();
  };
  S.resetMine = function () {
    CHS().forEach(c => { if (S.state.ch[c]) delete S.state.ch[c][S.uid]; });
    if (S.remote) CHS().forEach(c => putRemote(`c${c}/${S.uid}`, null).catch(() => { }));
    else { const raw = readLocal(); if (raw) { CHS().forEach(c => delete (raw['c' + c] || {})[S.uid]); writeLocal(raw); } }
    notify();
  };
  S.resetDemo = function () {
    if (S.remote) return;
    lsDel(lsKey()); memRaw = null; loadLocal();
    const raw = readLocal(); raw.users[S.uid] = { name: S.name, ts: Date.now() }; writeLocal(raw);
    S.state = normalize(raw); notify();
  };
  S.subscribe = function (fn) { S.subs.push(fn); return () => { S.subs = S.subs.filter(f => f !== fn); }; };
  window.addEventListener('storage', e => { // 같은 PC의 다른 탭 동기화 (데모 모드)
    if (!S.remote && S.room && e.key === lsKey()) { const raw = readLocal(); if (raw) { S.state = normalize(raw); notify(); } }
  });
  window.Store = S;
})();
