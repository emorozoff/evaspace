/* =====================================================================
   НАПОМИНАНИЯ НА ТЕЛЕФОН
   Письмо от Евы лежит в приложении и ждёт, пока женщина зайдёт сама.
   А не заходят как раз те, кого мы теряем. Уведомление достаёт их —
   но только пока ему верят, поэтому обещание здесь жёсткое и одно:
   не чаще двух раз в неделю и только от Евы. Итоги в понедельник,
   напоминание в субботу. Ничего про акции, курсы и мероприятия.

   Как это устроено технически. Приложение ставится на экран телефона —
   это и есть «веб-версия», отдельного приложения из магазина не нужно.
   На Android и в Chrome уведомления работают и во вкладке. На iPhone,
   начиная с iOS 16.4, — только у приложения, добавленного на экран
   «Домой»: во вкладке Safari кнопки разрешения просто нет. Поэтому
   на айфоне сначала предлагаем поставить, а разрешение спрашиваем уже
   внутри установленного приложения.
   ===================================================================== */

const PUSH_PROMISE = 'Не чаще двух раз в неделю и только от Евы: итоги в понедельник ' +
  'и напоминание в субботу. Ни акций, ни рекламы курсов — это обещание.';

let pushKey = null;                       // публичный ключ сервера, берём один раз

const pushApi = () => 'serviceWorker' in navigator &&
  'PushManager' in window && 'Notification' in window;

/* Почему нельзя — человеческим языком, а не «not supported» */
function pushWhy(){
  if(!window.isSecureContext && location.protocol !== 'http:')
    return 'Уведомления работают только на защищённом соединении (https)';
  if(isIOS() && !isStandalone())
    return 'На айфоне уведомления приходят приложению с экрана «Домой». Поставь Eva Space — и вернись сюда';
  if(!pushApi())
    return 'Этот браузер уведомления не умеет. Попробуй Chrome или Safari';
  if(Notification.permission === 'denied')
    return 'Уведомления запрещены в настройках телефона. Разреши их для Eva Space и вернись';
  return '';
}

/* off — можно включить, on — включены, no — нельзя и почему */
function pushState(){
  if(!S.user) return 'no';
  if(pushWhy()) return 'no';
  if(Notification.permission !== 'granted') return 'off';
  return S.pushOn ? 'on' : 'off';
}

const b64ToBytes = s => {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

async function pushServerKey(){
  if(pushKey) return pushKey;
  const r = await apiCall('push_key', null, {silent:true});
  pushKey = r && r.key ? r.key : null;
  return pushKey;
}

/* Включение. Вызывается только по нажатию — иначе браузер не покажет
   запрос разрешения, а на айфоне просто откажет. */
async function pushOn(){
  const why = pushWhy();
  if(why){
    if(isIOS() && !isStandalone()) return openSheet('install');
    return toast(why);
  }
  if(SYNC.alive === false) return toast('Нужен сервер: без него напоминание некому отправить');

  let perm = Notification.permission;
  if(perm !== 'granted') perm = await Notification.requestPermission();
  if(perm !== 'granted'){
    render();
    return toast(perm === 'denied' ? 'Уведомления запрещены — можно разрешить в настройках телефона'
                                   : 'Хорошо, не буду напоминать');
  }

  const key = await pushServerKey();
  if(!key) return toast('Сервер не отдал ключ — попробуй позже');

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe(
      {userVisibleOnly:true, applicationServerKey:b64ToBytes(key)});
    const j = sub.toJSON();
    const r = await apiCall('push_save', {
      endpoint: sub.endpoint,
      p256dh: (j.keys || {}).p256dh || '',
      auth:   (j.keys || {}).auth || ''
    }, {silent:true});
    if(!r) return toast('Не получилось сохранить — попробуй ещё раз');
    S.pushOn = true; schedulePersist(); render();
    toast('Договорились. Ева напишет в понедельник');
  } catch(e){
    console.error('[Eva] уведомления:', e);
    toast('Телефон не дал подписаться на уведомления');
  }
}

async function pushOff(){
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      await apiCall('push_drop', {endpoint: sub.endpoint}, {silent:true});
      await sub.unsubscribe();
    } else {
      await apiCall('push_drop', {endpoint: ''}, {silent:true});
    }
  } catch(e){}
  S.pushOn = false; schedulePersist(); render();
  toast('Больше не напоминаю');
}

function pushToggle(){ return S.pushOn ? pushOff() : pushOn(); }

/* Проверка «дошло или нет»: женщина нажимает сама и видит уведомление
   своими глазами. Без этого включение — акт веры. */
async function pushCheck(){
  const r = await apiCall('push_test', {}, {silent:true});
  if(!r) return toast('Не получилось — проверь связь');
  toast(r.sent ? 'Отправила, посмотри на экран телефона'
               : 'Ни одного устройства не подписано');
}

/* ---------- где предлагаем ---------- */

/* Строка в настройках: всегда честная — и когда включено, и когда нельзя */
function pushRow(){
  if(!S.user || S.role !== 'user') return '';
  const st = pushState();
  const why = pushWhy();
  return `<button class="uline" style="width:100%;text-align:left" onclick="${
      st === 'no' ? (isIOS() && !isStandalone() ? "openSheet('install')" : "toast('" + attJs(why) + "')")
                  : 'pushToggle()'}">
      <span style="flex:1;font-size:13.5px;font-weight:600">Напоминания от Евы
        <span class="small muted" style="display:block;font-weight:400;margin-top:2px">${
          st === 'on' ? 'Включены · два раза в неделю' : (why || 'Итоги недели и напоминание в субботу')}</span></span>
      <span class="${st === 'on' ? 'pill on' : 'muted'}">${st === 'on' ? 'вкл' : (st === 'no' ? '' : '›')}</span></button>
    ${st === 'on' ? `<button class="uline" style="width:100%;text-align:left" onclick="pushCheck()">
      <span style="flex:1;font-size:13.5px">Проверить, доходят ли</span><span class="muted">›</span></button>` : ''}`;
}

/* Предложение включить — один раз и в правильный момент: сразу после
   того, как она прочитала первое письмо Евы про неделю. Раньше просить
   рано: непонятно, о чём вообще будут напоминать. */
function pushOffer(){
  if(S.pushAsked || S.pushOn) return '';
  if(!S.user || S.role !== 'user') return '';
  if(pushWhy() && !(isIOS() && !isStandalone())) return '';
  return `<div class="pushoffer">
      <b>Присылать это на телефон?</b>
      <p>${esc(PUSH_PROMISE)}</p>
      <div class="row" style="gap:8px">
        <button class="btn xs acc" onclick="pushFromOffer()">Присылать</button>
        <button class="btn xs" onclick="pushNoThanks()">Не надо</button>
      </div>
    </div>`;
}
function pushFromOffer(){ S.pushAsked = true; schedulePersist(); pushOn(); }
function pushNoThanks(){ S.pushAsked = true; schedulePersist(); render(); toast('Хорошо, не буду'); }

/* при входе восстанавливаем отметку: подписка могла отвалиться сама */
async function pushSync(){
  if(!S.pushOn || !pushApi()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(!sub || Notification.permission !== 'granted'){ S.pushOn = false; schedulePersist(); }
  } catch(e){}
}

/* Все модули расставили значения по умолчанию — запоминаем чистое состояние,
   чтобы вход в другой аккаунт начинался с него, а не с чужих данных. */
keepPristine();
