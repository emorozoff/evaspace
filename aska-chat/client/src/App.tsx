import { useEffect, useState } from 'react';
import { useStore } from './useStore.ts';
import { Welcome } from './components/Welcome.tsx';
import { ChatList } from './components/ChatList.tsx';
import { ChatView } from './components/ChatView.tsx';
import { NewChat } from './components/NewChat.tsx';
import { Settings } from './components/Settings.tsx';

type Route = { name: 'list' } | { name: 'chat'; chatId: string } | { name: 'settings' } | { name: 'new' };

function routeFromHash(): Route {
  const m = location.hash.match(/chat=([^&]+)/);
  return m ? { name: 'chat', chatId: decodeURIComponent(m[1]) } : { name: 'list' };
}

export default function App() {
  const s = useStore();
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    if (location.hash.includes('chat=')) history.replaceState(null, '', location.pathname);
    // Нажали на уведомление, а приложение уже открыто.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-chat' && typeof e.data.chatId === 'string') setRoute({ name: 'chat', chatId: e.data.chatId });
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (s.phase === 'ready' && location.hash.includes('invite=')) history.replaceState(null, '', location.pathname);
  }, [s.phase]);

  if (s.phase === 'loading') return <div className="screen splash" />;
  if (s.phase === 'welcome') return <Welcome />;

  const toList = () => setRoute({ name: 'list' });
  const openChat = (chatId: string) => setRoute({ name: 'chat', chatId });

  switch (route.name) {
    case 'chat':
      return <ChatView key={route.chatId} chatId={route.chatId} onBack={toList} />;
    case 'settings':
      return <Settings onBack={toList} />;
    case 'new':
      return <NewChat onBack={toList} onOpen={openChat} />;
    default:
      return <ChatList onOpen={openChat} onSettings={() => setRoute({ name: 'settings' })} onNew={() => setRoute({ name: 'new' })} />;
  }
}
