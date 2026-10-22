// Номер АСЬКИ — как настоящий номер машины своей страны: Россия [А 001 МР | 777 RUS], Беларусь, Казахстан,
// Армения, Грузия, Германия (синяя полоса ЕС), США (Калифорния, Нью-Йорк), ОАЭ (Дубай), Великобритания.
// Уровень улучшения (серебро, неон, голограмма, платина, бриллиант) — рамка и свечение; золотая серия АМР — золотая рамка.
import type { User } from '../lib/store.ts';

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
}

export function Plate({ plate, country = 'RU', level = 0, size = 'm', onClick }: PlateProps) {
  const p = plate ? plateParts(country, plate) : null;
  if (!p) return null;
  const gold = isGoldPlate(plate, country);
  const cls = `aska-plate c-${country} ${size} lvl-${level}${gold ? ' gold' : ''}${onClick ? ' click' : ''}`;
  const label = `номер ${plateText(plate, country)}`;
  if (country === 'RU') {
    const [a, num, bc] = p.main.split('|');
    return (
      <span className={cls} role="img" aria-label={label} title={plateText(plate, country)} onClick={onClick}>
        <span className="main"><i>{a}</i><b>{num}</b><i>{bc}</i></span>
        <span className="reg"><b>{p.region}</b><small>RUS<em className="flag f-RU" /></small></span>
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

// Основной номер человека
export function UserPlate({ user, size = 'm', onClick }: { user?: User; size?: 's' | 'm' | 'l'; onClick?: () => void }) {
  if (!user?.plate) return null;
  return <Plate plate={user.plate} country={user.plateCountry || 'RU'} level={user.plateLevel || 0} size={size} onClick={onClick} />;
}

// Золотой значок голд-пользователя (админа)
export function Gold({ user, big }: { user?: User; big?: boolean }) {
  if (!user?.gold) return null;
  return <span className={`aska-gold${big ? ' big' : ''}`} title="Голд — администратор АСЬКИ" aria-label="голд">★</span>;
}

export const RARITY_CLASS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
