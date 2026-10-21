// Номер АСЬКИ в виде автомобильного: [А 001 МР | 777 RUS]. Буквы чуть ниже цифр — как на настоящем номере.
export function splitPlate(plate?: string | null) {
  const m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(plate || '');
  return m ? { a: m[1], num: m[2], bc: m[3], region: m[4] } : null;
}

export const plateText = (plate?: string | null) => {
  const p = splitPlate(plate);
  return p ? `${p.a} ${p.num} ${p.bc} ${p.region}` : '';
};

export function Plate({ plate, size = 'm', onClick }: { plate?: string | null; size?: 's' | 'm' | 'l'; onClick?: () => void }) {
  const p = splitPlate(plate);
  if (!p) return null;
  return (
    <span className={`aska-plate ${size}`} role="img" aria-label={`номер ${plateText(plate)}`} title={plateText(plate)} onClick={onClick}>
      <span className="main"><i>{p.a}</i><b>{p.num}</b><i>{p.bc}</i></span>
      <span className="reg"><b>{p.region}</b><small>RUS<em className="flag" /></small></span>
    </span>
  );
}
