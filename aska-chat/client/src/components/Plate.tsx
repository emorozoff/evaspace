// Номер АСЬКИ — как настоящий номер машины своей страны: Россия [А 001 МР | 777 RUS], Беларусь, Казахстан,
// Армения, Грузия, Германия (синяя полоса ЕС), США (Калифорния, Нью-Йорк), ОАЭ (Дубай), Великобритания.
// Уровень улучшения (серебро, неон, голограмма, платина, бриллиант) — рамка и свечение; золотая серия АМР — золотая рамка.
import type { User } from '../lib/store.ts';
import { regionOf } from '../lib/places.ts';
import type { RegionShow } from '../lib/places.ts';

interface Parts { main: string; region?: string }

export function plateParts(country: string, code: string): Parts | null {
  let m: RegExpExecArray | null;
  switch (country) {
    case 'RU': m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(code); return m && { main: `${m[1]}|${m[2]}|${m[3]}`, region: m[4] };
    case 'BY': m = /^(\d{4})([A-Z]{2})-(\d)$/.exec(code); return m && { main: `${m[1]} ${m[2]}-${m[3]}` };
    case 'KZ': m = /^(\d{3})([A-Z]{3})(\d{2})$/.exec(code); return m && { main: `${m[1]} ${m[2]}`, region: m[3] };
    case 'AM': m = /^(\d{2})([A-Z]{2})(\d{3})$/.exec(code); return m && { main: `${m[1]} ${m[2]} ${m[3]}` };
    case 'GE': m = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(code); return m && { main: `${m[1]}-${m[2]}-${m[3]}` };
    case 'DE': m = /^(B|M|HH|K|F)-([A-Z]{1,2})(\d{1,4})$/.exec(code); return m && { main: `${m[1]} ${m[2]} ${m[3]}` };
    case 'US':
      if (/^\d[A-Z]{3}\d{3}$/.test(code)) return { main: code, region: 'CA' };
      m = /^([A-Z]{3})(\d{4})$/.exec(code); return m && { main: `${m[1]}-${m[2]}`, region: 'NY' };
    case 'AE': m = /^([A-Z])(\d{1,5})$/.exec(code); return m && { main: `${m[1]} ${m[2]}` };
    case 'GB': m = /^(L[A-Z])(\d{2})([A-Z]{3})$/.exec(code); return m && { main: `${m[1]}${m[2]} ${m[3]}` };
    default: return null;
  }
}

export function plateText(plate?: string | null, country = 'RU') {
  const p = plate ? plateParts(country, plate) : null;
  if (!p) return plate || '';
  return country === 'RU' ? `${p.main.replace(/\|/g, ' ')} ${p.region}` : `${p.main}${p.region && country === 'KZ' ? ` ${p.region}` : ''}`;
}

export const isGoldPlate = (plate?: string | null, country = 'RU') => country === 'RU' && /^А\d{3}МР\d{2,3}$/.test(plate || '');

const BAND: Record<string, string> = { BY: 'BY', KZ: 'KZ', AM: 'AM', GE: 'GE', DE: 'D', GB: 'UK' };

interface PlateProps {
  plate?: string | null;
  country?: string;
  level?: number;
  size?: 's' | 'm' | 'l';
  onClick?: () => void;
  region?: RegionShow | null; // регион «где я» или VIP 777/888 вместо региона токена
}

// Окошко региона: цифры и RUS с флагом, у мест за границей — код и флаг (BALI 🇮🇩), у VIP — золотое 777/888
export function RegionBox({ region, fallback }: { region?: RegionShow | null; fallback?: string }) {
  if (!region) return <span className="reg"><b>{fallback}</b><small>RUS<em className="flag f-RU" /></small></span>;
  const cls = `reg${region.vip ? ' reg-vip' : ''}${region.ru ? '' : ' reg-world'}${region.place?.key === 'spb' && !region.vip ? ' reg-spb' : ''}${region.place?.theme ? ` reg-${region.place.theme}` : ''}`;
  return (
    <span className={cls} title={region.vip ? `VIP-регион ${region.code}` : region.place?.name}>
      <b>{region.code}</b>
      <small>{region.ru ? <>RUS<em className="flag f-RU" /></> : <i className="reg-flag">{region.flag}</i>}</small>
    </span>
  );
}

export function Plate({ plate, country = 'RU', level = 0, size = 'm', onClick, region }: PlateProps) {
  const p = plate ? plateParts(country, plate) : null;
  if (!p) return null;
  const gold = isGoldPlate(plate, country) || Boolean(region?.vip);
  const cls = `aska-plate c-${country} ${size} lvl-${level}${gold ? ' gold' : ''}${onClick ? ' click' : ''}`;
  const shown = region && country === 'RU' ? `${p.main.replace(/\|/g, ' ')} ${region.code}` : plateText(plate, country);
  const label = `номер ${shown}`;
  if (country === 'RU') {
    const [a, num, bc] = p.main.split('|');
    return (
      <span className={cls} role="img" aria-label={label} title={shown} onClick={onClick}>
        <span className="main"><i>{a}</i><b>{num}</b><i>{bc}</i></span>
        <RegionBox region={region} fallback={p.region} />
      </span>
    );
  }
  return (
    <span className={cls} role="img" aria-label={label} title={plateText(plate, country)} onClick={onClick}>
      {BAND[country] && <span className="band"><em className={`flag f-${country}`} /><small>{BAND[country]}</small></span>}
      {country === 'US' && <span className="top">{p.region === 'NY' ? 'NEW YORK' : 'California'}</span>}
      {country === 'AE' && <span className="band ae"><small>DUBAI</small><small>دبي</small></span>}
      <span className="main"><b>{p.main}</b></span>
      {country === 'KZ' && <span className="reg"><b>{p.region}</b></span>}
    </span>
  );
}

// Основной номер человека: регион — где он сейчас (у Голд и Блэк — 777 или 888)
export function UserPlate({ user, size = 'm', onClick }: { user?: User; size?: 's' | 'm' | 'l'; onClick?: () => void }) {
  if (!user?.plate) return null;
  const country = user.plateCountry || 'RU';
  return <Plate plate={user.plate} country={country} level={user.plateLevel || 0} size={size} onClick={onClick} region={country === 'RU' ? regionOf(user) : null} />;
}

// Значок уровня у имени: ★ Голд (золотая), ◆ Блэк (чёрная)
export function Gold({ user, big }: { user?: User; big?: boolean }) {
  if (!user?.gold) return null;
  if (user.tier === 'black') return <span className={`aska-gold black${big ? ' big' : ''}`} title="Блэк — закрытый уровень АСЬКИ" aria-label="Блэк">◆</span>;
  return <span className={`aska-gold${big ? ' big' : ''}`} title="Голд — VIP-уровень АСЬКИ" aria-label="голд">★</span>;
}

export const RARITY_CLASS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
