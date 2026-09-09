/* Видео не храним и не кодируем — только ссылка на внешний сервис.
   Для превью пробуем достать обложку YouTube, при отсутствии сети
   карточка просто показывает кнопку play. */

export function videoId(url = '') {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export function preview(url = '') {
  const id = videoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function service(url = '') {
  if (/youtu/.test(url)) return 'YouTube';
  if (/kinescope/.test(url)) return 'Kinescope';
  if (/vk\.com|vkvideo/.test(url)) return 'VK Видео';
  if (/drive\.google/.test(url)) return 'Google Drive';
  return 'Ссылка';
}
