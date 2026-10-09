/* Штаб и Eva CRM на своём сервере: то, что в артефакте давала площадка Claude,
   здесь даёт сервер (club/v2/server/server.js). Этот файл сервер подключает
   к обеим страницам сам, перед кодом приложения.

   • EvaServer.db — общая база с тем же интерфейсом, что claude.use('db'):
     collection(c).onSnapshot / doc(id).set|update|delete; живые правки коллег —
     поток событий сервера;
   • EvaServer.auth — вход, приглашение, смена пароля: всё проверяет сервер;
   • window.claude.use(...) — Google Календарь (инструменты те же, что у
     коннектора Claude) и, для CRM, «кто открыл» — по учётке штаба. */

(() => {
  'use strict';
  const cfg = window.EVA || {app: 'hq', api: '/api'};
  const API = cfg.api, HQ_API = '/api';
  const fail = (code, message, extra) => Object.assign(new Error(message || code), {code}, extra || {});
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const CODES = {401: 'unauthenticated', 403: 'permission_denied', 404: 'invalid_argument', 413: 'quota_exceeded', 429: 'resource_exhausted'};
  const stash = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* без хранилища обойдёмся */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* то же */ } },
  };

  async function call(method, url, body) {
    let r;
    try { r = await fetch(url, {method, credentials: 'same-origin', headers: {'content-type': 'application/json', 'x-eva': '1'}, body: body === undefined ? undefined : JSON.stringify(body)}); }
    catch (e) { throw fail('unavailable', 'сервер не отвечает'); }
    let j = null;
    try { j = await r.json(); } catch (e) { /* пустой ответ */ }
    if (r.ok) return j || {};
    throw fail(CODES[r.status] || 'unavailable', (j && j.error) || 'HTTP ' + r.status, {status: r.status});
  }

  /* адрес: ?next=crm — после входа вернуться в CRM; ?gcal=ok — только что подключили календарь */
  const q = new URLSearchParams(location.search);
  if (cfg.app === 'hq' && q.get('next') === 'crm') {
    stash.set('eva-next', '/crm/' + location.hash);
    try { history.replaceState(null, '', '/'); } catch (e) { /* останется как есть */ }
  }
  if (q.get('gcal')) {
    stash.set('eva-gcal', q.get('gcal'));
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* останется как есть */ }
  }
  /* вошли — идём, куда собирались */
  function goNext() {
    const next = cfg.app === 'hq' ? stash.get('eva-next') : null;
    if (!next) return false;
    stash.del('eva-next');
    location.replace(next);
    return true;
  }
  const toLogin = () => { if (cfg.app === 'crm') location.replace('/?next=crm'); else location.reload(); };

  /* ── общая база ── */
  const data = {}, subs = {}, pending = {}, latest = {};
  const session = {me: null, empty: false, owner: false, crmRole: null};
  const snap = c => ({docs: Object.entries(data[c] || {}).map(([id, v]) => ({id, data: () => clone(v)})), metadata: {fromCache: false}});
  const emit = c => (subs[c] || []).forEach(fn => { try { fn(snap(c)); } catch (e) { console.error(e); } });
  const put = (c, id, doc) => { data[c] = data[c] || {}; if (doc === null || doc === undefined) delete data[c][id]; else data[c][id] = doc; };
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  function hashQuery() {
    if (cfg.app !== 'hq') return '';
    let h = '';
    try { h = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { return ''; }
    if (h.startsWith('join=')) return '?join=' + encodeURIComponent(h.slice(5));
    if (h.startsWith('reset=')) return '?reset=' + encodeURIComponent(h.slice(6));
    return '';
  }
  function take(j) {
    Object.assign(session, {me: j.me || null, empty: !!j.empty, owner: !!j.owner, crmRole: j.crmRole || null});
    const cols = j.collections || {};
    new Set([...Object.keys(data), ...Object.keys(cols)]).forEach(c => {
      const next = {...(cols[c] || {})};
      /* свои правки, которые ещё в пути, не затираем */
      Object.keys(pending).forEach(k => { if (pending[k] && k.startsWith(c + '/')) { const id = k.slice(c.length + 1); if (data[c] && id in data[c]) next[id] = data[c][id]; else delete next[id]; } });
      data[c] = next;
    });
  }
  let ready = null, es = null, opened = 0, checking = false;
  function load() {
    if (ready) return ready;
    ready = call('GET', API + '/state' + hashQuery()).then(j => {
      take(j);
      if (session.me && goNext()) return new Promise(() => {});   // уходим в CRM — дальше не рисуем
      if (session.me) listen();
    }, e => { if (cfg.app === 'crm' && e.code === 'unauthenticated') { toLogin(); return new Promise(() => {}); } throw e; });
    ready.catch(() => { ready = null; });
    return ready;
  }
  async function resync() {
    try { take(await call('GET', API + '/state')); }
    catch (e) { if (e.code === 'unauthenticated') toLogin(); return; }
    if (!session.me) { toLogin(); return; }
    Object.keys(data).forEach(emit);
  }
  let resyncTimer = null;
  const resyncSoon = () => { clearTimeout(resyncTimer); resyncTimer = setTimeout(resync, 150); };
  function listen() {
    if (es) return;
    es = new EventSource(API + '/events');
    /* связь вернулась после обрыва — перечитываем: правки за это время могли пройти мимо */
    es.onopen = () => { if (opened++) resync(); };
    es.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      if (m.reload) { location.reload(); return; }
      if (!m.col) return;
      const key = m.col + '/' + m.id;
      if (latest[key] && latest[key].rev >= m.rev) return;
      latest[key] = {rev: m.rev, doc: m.doc};
      if (pending[key]) return;   // своя правка этой записи ещё в пути — применим после ответа
      put(m.col, m.id, m.doc);
      emit(m.col);
    };
    es.onerror = () => {
      /* браузер переподключается сам; но если сессия кончилась — на вход */
      if (checking || es.readyState !== 2) return;
      checking = true;
      es = null;
      call('GET', API + '/state').then(j => { checking = false; if (!j.me) toLogin(); else { take(j); Object.keys(data).forEach(emit); listen(); } },
        e => { checking = false; if (e.code === 'unauthenticated') toLogin(); else setTimeout(listen, 5000); });
    };
  }
  function send(method, c, id, body, local) {
    const key = c + '/' + id;
    pending[key] = (pending[key] || 0) + 1;
    put(c, id, local);
    return call(method, `${API}/doc/${encodeURIComponent(c)}/${encodeURIComponent(id)}`, body).then(r => {
      pending[key]--;
      if (!latest[key] || latest[key].rev < r.rev) latest[key] = {rev: r.rev, doc: r.doc === undefined ? null : r.doc};
      if (!pending[key]) {
        const cur = (data[c] || {})[id], doc = latest[key].doc;
        put(c, id, doc);
        if (!same(cur, doc)) emit(c);
      }
      return r;
    }, e => {
      pending[key]--;
      if (e.code === 'unauthenticated') toLogin();
      /* сервер не принял правку — возвращаем на экран то, что лежит в базе */
      else if (e.code === 'permission_denied') resyncSoon();
      throw e;
    });
  }
  const db = {
    collection(c) {
      return {
        onSnapshot(cb, err) {
          (subs[c] = subs[c] || []).push(cb);
          load().then(() => cb(snap(c)), e => err && err(e));
          return () => { subs[c] = (subs[c] || []).filter(f => f !== cb); };
        },
        doc(id) {
          return {
            set: body => send('PUT', c, id, body, clone(body)),
            update: part => send('PATCH', c, id, part, mergeLocal((data[c] || {})[id], part)),
            delete: () => send('DELETE', c, id, undefined, null),
          };
        },
      };
    },
  };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function mergeLocal(a, b) {
    if (!a) return undefined;   // документа нет — сервер ответит «нет документа», приложение запишет целиком
    const o = {...a};
    Object.entries(b || {}).forEach(([k, v]) => { o[k] = isObj(v) && isObj(o[k]) ? mergeLocal(o[k], v) : clone(v); });
    return o;
  }

  /* ── вход ── */
  const post = (p, b) => call('POST', HQ_API + '/auth/' + p, b || {});
  /* вошли: страницу перезагружаем — сервер отдаст данные уже по роли */
  function enter(hash) {
    if (goNext()) return;
    try { history.replaceState(null, '', location.pathname + (hash ? '#' + hash : '')); } catch (e) { location.hash = hash || ''; }
    location.reload();
  }
  const auth = {
    login: (email, pw) => post('login', {email, pw}),
    logout: () => post('logout').then(() => { location.reload(); }, () => { location.reload(); }),
    owner: f => post('owner', f),
    join: f => post('join', f),
    reset: f => post('reset', f),
    issueReset: accId => post('issue-reset', {accId}).then(r => r.code),
    password: (old, pw) => post('password', {old, pw}),
    /* до входа: подтянуть приглашение по коду — без него анкету не открыть */
    peek(params) {
      return call('GET', HQ_API + '/peek?' + new URLSearchParams(params)).then(j => {
        Object.entries(j.collections || {}).forEach(([c, docs]) => { data[c] = {...(data[c] || {}), ...docs}; emit(c); });
        return j.collections || {};
      });
    },
    exportAll: secrets => call('GET', HQ_API + '/export' + (secrets ? '?secrets=1' : '')),
    importAll: (j, mode) => call('POST', HQ_API + '/import?mode=' + (mode === 'replace' ? 'replace' : 'merge'), j),
  };

  /* ── Google Календарь ── */
  const TOOLS = ['list_events', 'list_calendars', 'suggest_time', 'create_event', 'update_event', 'delete_event'];
  let gst = null;
  const gstatus = force => (gst && !force ? gst : (gst = call('GET', HQ_API + '/gcal/status').catch(() => ({configured: false, connected: false, email: ''}))));
  const gcal = {
    status: gstatus,
    connect() { location.href = HQ_API + '/gcal/connect' + (cfg.app === 'crm' ? '?back=crm' : ''); },
    disconnect() { return call('POST', HQ_API + '/gcal/disconnect', {}).then(() => { gst = null; }); },
    /* только что вернулись из Google: 'ok' | 'fail' | null — один раз */
    just() { const v = stash.get('eva-gcal'); if (v) stash.del('eva-gcal'); return v; },
  };
  const mcp = {
    async listTools() {
      const s = await gstatus();
      return {servers: [{server: 'Google Calendar', authStatus: s.connected ? 'connected' : 'not_connected', tools: TOOLS.map(name => ({name}))}]};
    },
    async callTool(server, tool, input) {
      const s = await gstatus();
      if (!s.connected) throw fail('connect_first', 'Google Календарь не подключён');
      let j;
      try { j = await call('POST', HQ_API + '/gcal/tool', {tool, input: input || {}}); }
      catch (e) { if (e.code === 'unauthenticated') toLogin(); throw fail(e.code === 'unavailable' ? 'server_unavailable' : e.code, e.message, {retryable: e.code === 'unavailable'}); }
      if (j.code) {
        if (j.code === 'connect_first') gst = null;
        throw fail(j.code, j.error, {retryable: !!j.retryable, retryAfterMs: j.retryAfterMs});
      }
      return {payload: j.payload};
    },
  };
  const permissions = {
    async state() { const s = await gstatus(); return !s.configured ? 'unavailable' : s.connected ? 'granted' : 'prompt'; },
  };

  /* ── сохранить файл (выгрузки CSV и JSON): обычной загрузкой браузера ── */
  const downloads = {
    async save({filename, data}) {
      const blob = new Blob([data], {type: /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : 'application/octet-stream'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
  };

  /* ── кто открыл CRM: учётка штаба ── */
  const user = {
    id: async () => { await load(); return session.me; },
    isOwner: async () => { await load(); return session.owner; },
    can: async () => { await load(); return true; },
    profiles: async ids => { const all = await call('GET', API + '/profiles'); return Object.fromEntries((ids || []).map(id => [id, all[id] || {}])); },
  };

  window.EvaServer = {app: cfg.app, urls: {hq: cfg.hq || '/', crm: cfg.crm || '/crm/'}, db, session, load, auth, gcal, enter};
  window.claude = {
    async use(cap) {
      if (cap === 'mcp') return (await gstatus()).configured ? mcp : null;
      if (cap === 'permissions') return permissions;
      if (cap === 'downloads') return downloads;
      if (cfg.app === 'crm' && cap === 'db') return db;
      if (cfg.app === 'crm' && cap === 'user') return user;
      return null;   // остального на своём сервере нет — приложение идёт запасным путём
    },
  };
})();
