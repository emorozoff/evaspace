/* Свой сервер штаба (club/v2/server/server.js). Страницу отдаёт он же и
   подключает перед кодом штаба server/public/eva-server.js: общая база с тем
   же интерфейсом, что у Claude (collection(c).onSnapshot / doc(id).set|update|
   delete), вход по почте и паролю и Google Календарь. Признак — window.EVA_API.
   На сервере вход проверяет сервер: до входа в браузер не приходит ни одной
   записи, а после — только то, что положено роли. */

const onServer = () => !!(window.EVA_API && window.EvaServer);
function httpDb() { return window.EvaServer.db; }
/* штаб ещё пуст (нет ни одной учётки)? До входа на сервере учёток в браузере нет — спрашиваем сервер */
const hqEmpty = () => (onServer() ? window.EvaServer.session.empty : !Store.count('accounts'));
