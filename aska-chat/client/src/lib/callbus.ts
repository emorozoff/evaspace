// События звонков с сервера → модуль звонков (lib/calls.ts). Отдельно, чтобы store.ts и calls.ts не ссылались друг на друга.
export interface CallView { id: string; chatId: string; by: number; at: number; members: number[]; ringing: number[] }
export type CallEvent =
  | { type: 'call'; call: CallView }
  | { type: 'calls'; calls: CallView[] }
  | { type: 'call_end'; chatId: string; id: string; reason: 'end' | 'no_answer' | 'declined' }
  | { type: 'call_signal'; chatId: string; from: number; data: { n: string; c: string } }
  | { type: 'call_error'; chatId: string; error: string };

const listeners = new Set<(e: CallEvent) => void>();
export function onCall(fn: (e: CallEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitCall(e: CallEvent) { for (const fn of listeners) fn(e); }
