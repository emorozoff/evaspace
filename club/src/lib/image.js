/* Скриншот-подтверждение храним прямо в браузере, поэтому уменьшаем
   картинку до разумного размера — иначе localStorage быстро закончится. */

const MAX_SIDE = 720;
const MAX_BYTES = 320 * 1024;

export function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Это не картинка'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось открыть картинку'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.6);
        if (data.length > MAX_BYTES) return reject(new Error('Картинка слишком тяжёлая — приложите ссылку'));
        resolve(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
