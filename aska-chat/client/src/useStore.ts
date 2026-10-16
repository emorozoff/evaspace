import { useSyncExternalStore } from 'react';
import { store } from './lib/store.ts';

const subscribe = (cb: () => void) => {
  const off = store.subscribe(cb);
  return () => { off(); };
};

export const useStore = () => useSyncExternalStore(subscribe, store.get);
