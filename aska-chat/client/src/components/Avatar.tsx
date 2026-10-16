import { initials } from '../lib/format.ts';
import { PeopleIcon } from './Icons.tsx';

export function Avatar({ name, size = 48, group }: { name?: string; id?: number; size?: number; group?: boolean }) {
  if (group) {
    return (
      <div className="avatar avatar-group" style={{ width: size, height: size }}>
        <PeopleIcon size={size * 0.5} />
      </div>
    );
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name || '?')}
    </div>
  );
}
