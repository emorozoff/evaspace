// Пуш-уведомления через Web Push (на iPhone их доставляет Apple).
// В уведомление кладём только шифр короткого превью: Apple и сервер текста не видят,
// расшифровывает его service worker на телефоне.
import webpush from 'web-push';
import { getSetting, setSetting } from './db.js';

const PUSH_HOSTS = ['.push.apple.com', 'fcm.googleapis.com', '.push.services.mozilla.com', '.notify.windows.com'];

export function isAllowedEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    return PUSH_HOSTS.some((h) => (h.startsWith('.') ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}

export function createPush({ db, publicUrl, sender, log }) {
  let keys = JSON.parse(getSetting(db, 'vapid') || 'null');
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    setSetting(db, 'vapid', JSON.stringify(keys));
  }
  const subject = process.env.PUSH_SUBJECT || (publicUrl?.startsWith('https://') ? publicUrl : 'mailto:admin@localhost');

  const send = sender || ((sub, payload, opts) => webpush.sendNotification(sub, payload, {
    ...opts,
    vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
  }));

  async function notify(userId, data) {
    const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').all(userId);
    if (!subs.length) return;
    let payload = JSON.stringify(data);
    if (payload.length > 3000) {
      const { pn, pc, ...rest } = data;
      payload = JSON.stringify(rest);
    }
    await Promise.all(subs.map(async (s) => {
      try {
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint);
        } else {
          log('push error', e.statusCode || '', e.body || e.message);
        }
      }
    }));
  }

  return { publicKey: keys.publicKey, notify };
}
