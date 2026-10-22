// Хранилище на телефоне (IndexedDB). Отсюда же читает service worker, чтобы расшифровать уведомление.
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Body } from './protocol.ts';

export interface Session { token: string; userId: number; username: string }
export interface Keys { pk: string; sk: string }
// kind: human — человек (для всех, в том числе ИИ-люди: кто есть кто — секрет игры), aska — Аська, twin — личный ИИ
export interface LocalUser {
  id: number; username: string; displayName: string; pk: string; keyChanged?: boolean; keyRotated?: boolean;
  plate?: string | null; about?: string; city?: string; kind?: 'human' | 'aska' | 'twin'; ownerId?: number; prevPks?: string[];
  gold?: boolean; blocked?: boolean; plateId?: number; plateCountry?: string; plateLevel?: number; plateRarity?: number;
}
export interface Member { userId: number; readUpTo: number }
export interface LocalChat {
  id: string; kind: 'general' | 'dm' | 'group' | 'circle' | 'twin'; title: string | null; members: Member[]; lastId: number;
  emoji?: string; about?: string; isPublic?: boolean; createdBy?: number | null; twin?: { twinId: number; anon: boolean };
}

export interface StoredMsg {
  id: number;
  chatId: string;
  senderId: number;
  uuid: string;
  createdAt: number;
  body: Body | null; // null — не удалось расшифровать
}

interface KV {
  session: Session;
  keys: Keys;
  users: Record<number, LocalUser>;
  chats: Record<string, LocalChat>;
  lastSeq: number;
}

let dbp: Promise<IDBPDatabase> | null = null;

export function local() {
  if (!dbp) {
    dbp = openDB('svoi', 1, {
      upgrade(db) {
        db.createObjectStore('kv');
        const m = db.createObjectStore('messages', { keyPath: 'id' });
        m.createIndex('chat', ['chatId', 'id']);
      },
    });
  }
  return dbp;
}

export async function kvGet<K extends keyof KV>(key: K): Promise<KV[K] | undefined> {
  return (await local()).get('kv', key);
}

export async function kvSet<K extends keyof KV>(key: K, value: KV[K]) {
  await (await local()).put('kv', value, key);
}

export async function allMessages(): Promise<StoredMsg[]> {
  return (await local()).getAll('messages');
}

export async function putMessages(msgs: StoredMsg[]) {
  if (!msgs.length) return;
  const tx = (await local()).transaction('messages', 'readwrite');
  await Promise.all([...msgs.map((m) => tx.store.put(m)), tx.done]);
}

export async function wipeLocal() {
  const db = await local();
  const tx = db.transaction(['kv', 'messages'], 'readwrite');
  await Promise.all([tx.objectStore('kv').clear(), tx.objectStore('messages').clear(), tx.done]);
}
