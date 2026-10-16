// Всё шифрование приложения. Используем проверенные библиотеки, ничего своего:
// tweetnacl — NaCl box/secretbox (X25519 + XSalsa20-Poly1305), @noble/hashes — scrypt и SHA-256.
import nacl from 'tweetnacl';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';

export type Bytes = Uint8Array;
export interface KeyPair { pk: Bytes; sk: Bytes }
export interface Sealed { n: string; c: string }

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Bytes): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(s: string): Bytes {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const utf8 = (s: string): Bytes => enc.encode(s);
export const fromUtf8 = (b: Bytes): string => dec.decode(b);
export const randomBytes = (n: number): Bytes => nacl.randomBytes(n);

export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair();
  return { pk: kp.publicKey, sk: kp.secretKey };
}

export function publicFromSecret(sk: Bytes): Bytes {
  return nacl.box.keyPair.fromSecretKey(sk).publicKey;
}

// Пароль → два независимых ключа: encKey шифрует резервную копию и никогда не уходит с телефона,
// authKey отправляется серверу для входа. Из authKey пароль и encKey не восстановить.
export const KDF = { N: 2 ** 15, r: 8, p: 1 };

export async function deriveFromPassword(password: string, salt: Bytes, onProgress?: (p: number) => void) {
  const out = await scryptAsync(utf8(password.normalize('NFKC')), salt, { ...KDF, dkLen: 64, onProgress });
  return { encKey: out.slice(0, 32), authKey: out.slice(32, 64) };
}

export function sealSecret(plain: Bytes, key: Bytes): Sealed {
  const n = randomBytes(24);
  return { n: toB64(n), c: toB64(nacl.secretbox(plain, n, key)) };
}

export function openSecret(s: Sealed, key: Bytes): Bytes | null {
  return nacl.secretbox.open(fromB64(s.c), fromB64(s.n), key);
}

// Сообщение для одного получателя: только он может открыть, и он уверен, что писал именно отправитель.
const sharedCache = new Map<string, Bytes>();
function shared(theirPk: Bytes, mySk: Bytes): Bytes {
  const key = toB64(theirPk) + toB64(mySk.subarray(0, 8));
  let k = sharedCache.get(key);
  if (!k) {
    k = nacl.box.before(theirPk, mySk);
    sharedCache.set(key, k);
  }
  return k;
}

export function boxFor(plain: Bytes, theirPk: Bytes, mySk: Bytes): Sealed {
  const n = randomBytes(24);
  return { n: toB64(n), c: toB64(nacl.box.after(plain, n, shared(theirPk, mySk))) };
}

export function openFrom(s: Sealed, theirPk: Bytes, mySk: Bytes): Bytes | null {
  try {
    return nacl.box.open.after(fromB64(s.c), fromB64(s.n), shared(theirPk, mySk));
  } catch {
    return null;
  }
}

// Файл (фото): шифруем случайным ключом, ключ кладём внутрь сообщения.
export function encryptFile(data: Bytes) {
  const key = randomBytes(32);
  const nonce = randomBytes(24);
  return { key: toB64(key), nonce: toB64(nonce), ct: nacl.secretbox(data, nonce, key), hash: toB64(sha256(data)) };
}

export function decryptFile(ct: Bytes, key: string, nonce: string, hash?: string): Bytes | null {
  const plain = nacl.secretbox.open(ct, fromB64(nonce), fromB64(key));
  if (!plain) return null;
  if (hash && toB64(sha256(plain)) !== hash) return null;
  return plain;
}

// Код безопасности: 20 цифр из отпечатка открытого ключа. Друзья сверяют его при встрече.
export function safetyCode(pk: Bytes): string {
  const h = sha256(pk);
  const groups: string[] = [];
  for (let i = 0; i < 5; i++) {
    const v = ((h[i * 3] << 16) | (h[i * 3 + 1] << 8) | h[i * 3 + 2]) % 10000;
    groups.push(String(v).padStart(4, '0'));
  }
  return groups.join(' ');
}
