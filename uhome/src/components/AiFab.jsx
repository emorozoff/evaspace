import { go } from '../lib/router.jsx';
import { assistantOf } from '../lib/assistant.js';
import { unreadOf } from '../lib/select.js';
import { AvatarPortrait } from './AvatarArt.jsx';

/* Ассистент всегда под рукой: портрет над таб-баром на каждой вкладке. */
export default function AiFab({ app }) {
  const A = assistantOf(app);
  return (
    <button className="aifab" onClick={() => go('/ai')} aria-label={`Спросить ${A.acc}`}>
      <AvatarPortrait who={A.id} size={58} />
      {unreadOf(app, 'ai') > 0 && <i className="aifab__dot" />}
    </button>
  );
}
