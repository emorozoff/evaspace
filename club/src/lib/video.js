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

/** Ссылка для встроенного плеера: смотрим внутри приложения, а не уходим на сервис. */
export function embedUrl(url = '') {
  const yt = videoId(url);
  if (/youtu/.test(url) && yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`;
  const kine = url.match(/kinescope\.io\/(?:embed\/)?([\w-]+)/);
  if (kine) return `https://kinescope.io/embed/${kine[1]}?autoplay=1`;
  const vk = url.match(/video(-?\d+)_(\d+)/);
  if (vk) return `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&autoplay=1`;
  return null;
}

export function service(url = '') {
  if (/youtu/.test(url)) return 'YouTube';
  if (/kinescope/.test(url)) return 'Kinescope';
  if (/vk\.com|vkvideo/.test(url)) return 'VK Видео';
  if (/drive\.google/.test(url)) return 'Google Drive';
  return 'Ссылка';
}
