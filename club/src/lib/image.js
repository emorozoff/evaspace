/* Картинки храним прямо в браузере, поэтому уменьшаем их до разумного
   размера. Читаем через createImageBitmap — он понимает больше форматов,
   чем <img> (в том числе HEIC с айфона там, где система умеет), и не гоняет
   мегабайты через data-URL. <img> остаётся запасным путём. */

const MAX_SIDE = 720;
const MAX_BYTES = 320 * 1024;

/** Что можно прикладывать: и «сфоткать», и выбрать из галереи. */
export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';

export async function readImage(file, { maxSide = MAX_SIDE, maxBytes = MAX_BYTES } = {}) {
  if (!file) throw new Error('Файл не выбран');
  if (file.type && !file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name || '')) {
    throw new Error('Это не картинка');
  }

  const source = await decode(file);
  let side = maxSide;
  let quality = 0.62;
  let data = draw(source, side, quality);
  // Шесть попыток хватает даже для снимка с современного телефона
  for (let i = 0; i < 6 && data.length > maxBytes; i++) {
    if (quality > 0.38) quality -= 0.1;
    else side = Math.round(side * 0.8);
    data = draw(source, side, quality);
  }
  source.close?.();
  if (data.length > maxBytes) throw new Error('Картинка слишком тяжёлая');
  return data;
}

/** Читаем файл двумя способами: сначала быстрым, потом совместимым. */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* формат не по зубам — пробуем через <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось открыть картинку. Сохраните её как JPEG и попробуйте снова'));
      img.src = url;
    });
  } finally {
    // Отпускаем ссылку в следующем кадре: Safari успевает дорисовать
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function draw(source, side, quality) {
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scale = Math.min(1, side / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
