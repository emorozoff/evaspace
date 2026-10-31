// Пиксельные НФТ-аватары Ночи: 96 штук, каждый собирается из номера токена (#1…#96) — фон, кто это (человек,
// пришелец, робот, кот, зомби, обезьяна, призрак), глаза, рот, шапка и украшение. Квадратные пиксели, моргают.
// Всё нарисовано здесь же — своё, без чужих картинок.
import { memo } from 'react';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BG = ['#1b1f3b', '#2d1b3d', '#0f3b2e', '#3b2a0f', '#123c55', '#3d1b1b', '#26263a', '#1f3b1b', '#3b1b33', '#0d2b3d', '#3a3a14', '#1b3b3b'];
const SPECIES = [
  { key: 'human', name: 'человек', skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'], w: 34 },
  { key: 'alien', name: 'пришелец', skin: ['#7ee081', '#5ad0c0'], w: 10 },
  { key: 'robot', name: 'робот', skin: ['#9aa4b2', '#b8c2cc'], w: 12 },
  { key: 'cat', name: 'кот', skin: ['#f4a259', '#d9d9d9', '#3b3b3b'], w: 14 },
  { key: 'zombie', name: 'зомби', skin: ['#9bc4a0'], w: 9 },
  { key: 'ape', name: 'обезьяна', skin: ['#8b5a2b'], w: 12 },
  { key: 'ghost', name: 'призрак', skin: ['#eef0f7'], w: 6 },
];
const EYES = ['dots', 'wide', 'shades', 'laser', 'vr', 'sleepy'];
const MOUTH = ['smile', 'flat', 'o', 'smirk'];
const HATS = ['none', 'cap', 'crown', 'phones', 'beanie', 'mohawk', 'halo', 'horns'];
const ACC = ['none', 'none', 'earring', 'mask', 'chain', 'pipe'];
const pickW = <T extends { w: number }>(r: () => number, list: T[]) => { let x = r() * list.reduce((n, i) => n + i.w, 0); for (const i of list) { x -= i.w; if (x < 0) return i; } return list[0]; };

export interface NftTraits { id: number; bg: string; species: string; speciesName: string; skin: string; eyes: string; mouth: string; hat: string; acc: string; rare: number }
export function traitsOf(id: number): NftTraits {
  const r = rng(id * 7919 + 13);
  const sp = pickW(r, SPECIES);
  const t = {
    id, bg: BG[Math.floor(r() * BG.length)], species: sp.key, speciesName: sp.name, skin: sp.skin[Math.floor(r() * sp.skin.length)],
    eyes: EYES[Math.floor(r() * EYES.length)], mouth: MOUTH[Math.floor(r() * MOUTH.length)], hat: HATS[Math.floor(r() * HATS.length)], acc: ACC[Math.floor(r() * ACC.length)], rare: 0,
  };
  // редкость: необычные существа, лазерные глаза, корона и нимб
  t.rare = (sp.w < 10 ? 2 : sp.w < 15 ? 1 : 0) + (t.eyes === 'laser' || t.eyes === 'vr' ? 1 : 0) + (t.hat === 'crown' || t.hat === 'halo' ? 1 : 0);
  return t;
}
export const rarityName = (n: number) => ['обычный', 'редкий', 'эпический', 'легендарный', 'мифический'][Math.min(4, n)];

type Px = [number, number, string, string?];
function pixels(t: NftTraits): Px[] {
  const p: Px[] = [];
  const box = (x0: number, y0: number, x1: number, y1: number, c: string, cls?: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.push([x, y, c, cls]); };
  const dark = t.species === 'ghost' ? '#7a7f99' : '#111';
  // голова и шея
  if (t.species === 'ghost') { box(3, 3, 8, 10, t.skin); p.push([3, 11, t.skin], [5, 11, t.skin], [7, 11, t.skin]); }
  else { box(3, 3, 8, 10, t.skin); box(5, 11, 6, 11, t.skin); }
  if (t.species === 'cat') { p.push([3, 2, t.skin], [8, 2, t.skin], [3, 1, t.skin], [8, 1, t.skin]); }
  if (t.species === 'ape') box(4, 7, 7, 10, '#c69c6d');
  if (t.species === 'robot') { box(3, 3, 8, 3, '#6b7480'); p.push([2, 6, '#6b7480'], [9, 6, '#6b7480'], [5, 1, '#6b7480'], [5, 2, '#6b7480'], [5, 0, '#ff4d4d']); }
  if (t.species === 'alien') { p.push([3, 3, t.bg], [8, 3, t.bg]); }
  if (t.species === 'zombie') { p.push([4, 4, '#6f9a74'], [7, 9, '#6f9a74']); }
  // глаза (моргают)
  switch (t.eyes) {
    case 'dots': p.push([4, 6, dark, 'e'], [7, 6, dark, 'e']); break;
    case 'wide': p.push([4, 6, '#fff', 'e'], [5, 6, dark, 'e'], [7, 6, '#fff', 'e'], [8, 6, dark, 'e']); break;
    case 'shades': box(3, 6, 8, 6, '#0b0b0b'); p.push([4, 6, '#3a6fff'], [7, 6, '#3a6fff']); break;
    case 'laser': p.push([4, 6, '#ff2a2a', 'e'], [7, 6, '#ff2a2a', 'e'], [9, 6, '#ff2a2a', 'z'], [10, 6, '#ff7a7a', 'z'], [11, 6, '#ffc4c4', 'z']); break;
    case 'vr': box(3, 5, 8, 6, '#26e0e0'); box(4, 6, 7, 6, '#0a8f8f'); break;
    case 'sleepy': p.push([4, 6, dark], [5, 6, dark], [7, 6, dark], [8, 6, dark]); break;
  }
  // рот
  const lip = t.species === 'robot' ? '#3a3f47' : '#7a2e2e';
  if (t.acc !== 'mask') {
    switch (t.mouth) {
      case 'smile': p.push([4, 8, lip], [5, 9, lip], [6, 9, lip], [7, 8, lip]); break;
      case 'flat': p.push([5, 9, lip], [6, 9, lip]); break;
      case 'o': p.push([5, 8, lip], [6, 8, lip], [5, 9, lip], [6, 9, lip]); break;
      case 'smirk': p.push([5, 9, lip], [6, 9, lip], [7, 8, lip]); break;
    }
  }
  // шапка
  switch (t.hat) {
    case 'cap': box(3, 2, 8, 3, '#e8443a'); box(8, 3, 10, 3, '#b8322a'); break;
    case 'crown': box(3, 2, 8, 2, '#f6c83a'); p.push([3, 1, '#f6c83a'], [5, 1, '#f6c83a'], [6, 1, '#ff4d6d'], [8, 1, '#f6c83a']); break;
    case 'phones': box(3, 2, 8, 2, '#222'); box(2, 5, 2, 7, '#222'); box(9, 5, 9, 7, '#222'); p.push([2, 6, '#ff3ea5'], [9, 6, '#ff3ea5']); break;
    case 'beanie': box(3, 1, 8, 3, '#3a6fff'); box(3, 3, 8, 3, '#2a4fbf'); p.push([5, 0, '#fff'], [6, 0, '#fff']); break;
    case 'mohawk': box(5, 0, 6, 3, '#ff3ea5'); break;
    case 'halo': box(3, 0, 8, 0, '#ffe37a'); p.push([2, 1, '#ffe37a'], [9, 1, '#ffe37a']); break;
    case 'horns': p.push([3, 2, '#c81e1e'], [8, 2, '#c81e1e'], [2, 1, '#c81e1e'], [9, 1, '#c81e1e']); break;
  }
  // украшение
  switch (t.acc) {
    case 'earring': p.push([9, 8, '#f6c83a']); break;
    case 'mask': box(3, 8, 8, 9, '#e9eef5'); break;
    case 'chain': box(4, 11, 7, 11, '#f6c83a'); break;
    case 'pipe': p.push([7, 9, '#5a3a1a'], [8, 9, '#5a3a1a'], [9, 9, '#5a3a1a'], [9, 8, '#5a3a1a'], [9, 7, '#cfcfcf', 'z']); break;
  }
  return p;
}

export const NftArt = memo(function NftArt({ id, size = 40, className = '' }: { id: number; size?: number; className?: string }) {
  const t = traitsOf(id);
  const px = pixels(t);
  return (
    <svg className={`aska-nft r${Math.min(4, t.rare)} ${className}`} viewBox="0 0 12 12" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={`НФТ #${id}: ${t.speciesName}`}>
      <rect width="12" height="12" fill={t.bg} />
      {px.filter(([, , , c]) => !c).map(([x, y, c], i) => <rect key={`b${i}`} x={x} y={y} width="1" height="1" fill={c} />)}
      <g className="nft-eyes">{px.filter(([, , , c]) => c === 'e').map(([x, y, c], i) => <rect key={`e${i}`} x={x} y={y} width="1" height="1" fill={c} />)}</g>
      <g className="nft-fx">{px.filter(([, , , c]) => c === 'z').map(([x, y, c], i) => <rect key={`z${i}`} x={x} y={y} width="1" height="1" fill={c} />)}</g>
    </svg>
  );
});
