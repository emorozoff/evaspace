/* Картинки храним прямо в браузере, поэтому уменьшаем их до разумного
   размера. Если после сжатия файл всё ещё тяжёлый, снижаем качество
   и сторону дальше — лучше чуть мягче картинка, чем отказ загрузить. */

const MAX_SIDE = 720;
const MAX_BYTES = 320 * 1024;

export function readImage(file, { maxSide = MAX_SIDE, maxBytes = MAX_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Это не картинка'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось открыть картинку'));
      img.onload = () => {
        let side = maxSide;
        let quality = 0.62;
        let data = draw(img, side, quality);
        // Шесть попыток хватает даже для снимка с современного телефона
        for (let i = 0; i < 6 && data.length > maxBytes; i++) {
          if (quality > 0.38) quality -= 0.1;
          else side = Math.round(side * 0.8);
          data = draw(img, side, quality);
        }
        if (data.length > maxBytes) return reject(new Error('Картинка слишком тяжёлая'));
        resolve(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function draw(img, side, quality) {
  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
