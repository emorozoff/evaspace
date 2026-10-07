/* Хранилище на своём сервере (club/v2/server/server.js) — тот же интерфейс,
   что у общей базы Claude: collection(c).onSnapshot / doc(id).set|update|delete.
   Включается, когда страницу отдаёт сервер штаба: он подставляет
   window.EVA_API. Живые обновления — поток событий сервера (EventSource).
   Если на сервере задан ключ доступа, его передают один раз в адресе
   (?key=…) — дальше он помнится в этом браузере. */

function httpDb(base) {
  const key = (() => {
    const m = /[?&]key=([^&#]+)/.exec(location.search);
    if (m) { Local.set('eva-hq-key', decodeURIComponent(m[1])); return decodeURIComponent(m[1]); }
    return Local.get('eva-hq-key', '');
  })();
  const url = p => `${base.replace(/\/$/, '')}/${p}`;
  const headers = {'content-type': 'application/json', ...(key ? {'x-eva-key': key} : {})};
  const data = {};
  const subs = {};
  const fail = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const snap = c => ({docs: Object.entries(data[c] || {}).map(([id, v]) => ({id, data: () => clone(v)})), metadata: {fromCache: false}});
  const emit = c => (subs[c] || []).forEach(fn => { try { fn(snap(c)); } catch (e) { console.error(e); } });
  let ready = null;
  function load() {
    if (ready) return ready;
    ready = fetch(url('state'), {headers}).then(r => {
      if (r.status === 401) throw fail('invalid_argument', 'нужен ключ доступа');
      if (!r.ok) throw fail('unavailable', 'HTTP ' + r.status);
      return r.json();
    }).then(j => {
      Object.entries(j.collections || {}).forEach(([c, docs]) => { data[c] = docs || {}; });
      /* живые правки коллег */
      try {
        const es = new EventSource(url('events') + (key ? '?key=' + encodeURIComponent(key) : ''));
        es.onmessage = ev => {
          let m;
          try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (!m || !m.col) return;
          if (m.reset) { data[m.col] = m.docs || {}; emit(m.col); return; }
          data[m.col] = data[m.col] || {};
          if (m.doc === null) delete data[m.col][m.id]; else data[m.col][m.id] = m.doc;
          emit(m.col);
        };
      } catch (e) { /* без потока — обновится при следующей загрузке */ }
    });
    return ready;
  }
  const send = (method, c, id, body) => fetch(url(`doc/${encodeURIComponent(c)}/${encodeURIComponent(id)}`), {method, headers, body: body === undefined ? undefined : JSON.stringify(body)})
    .catch(() => { throw fail('unavailable', 'сервер не отвечает'); })
    .then(r => {
      if (r.status === 404) throw fail('invalid_argument', 'документа нет');
      if (r.status === 401 || r.status === 403) throw fail('invalid_argument', 'нет доступа на запись');
      if (r.status === 413) throw fail('quota_exceeded');
      if (!r.ok) throw fail('unavailable', 'HTTP ' + r.status);
      return r.json().catch(() => ({}));
    });
  return {
    collection(c) {
      return {
        onSnapshot(cb, err) {
          (subs[c] = subs[c] || []).push(cb);
          load().then(() => cb(snap(c)), e => err && err(e));
          return () => { subs[c] = (subs[c] || []).filter(f => f !== cb); };
        },
        doc(id) {
          return {
            set: body => send('PUT', c, id, body).then(() => { (data[c] = data[c] || {})[id] = clone(body); }),
            update: part => send('PATCH', c, id, part).then(r => { if (r && r.doc) (data[c] = data[c] || {})[id] = r.doc; }),
            delete: () => send('DELETE', c, id).then(() => { if (data[c]) delete data[c][id]; }),
          };
        },
      };
    },
  };
}
