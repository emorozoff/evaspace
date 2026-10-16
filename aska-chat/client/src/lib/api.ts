// Запросы к серверу.
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };
export const getToken = () => token;

async function request<T>(method: string, path: string, body?: unknown, raw?: Uint8Array): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (raw) {
    headers['content-type'] = 'application/octet-stream';
    payload = raw as unknown as BodyInit;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    let code = 'error';
    try { code = (await res.json()).error || code; } catch { /* пусто */ }
    throw new ApiError(res.status, code);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: (data: Uint8Array) => request<{ id: string }>('POST', '/blobs', undefined, data),
  async download(id: string): Promise<Uint8Array> {
    const res = await fetch(`/api/blobs/${id}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'blob');
    return new Uint8Array(await res.arrayBuffer());
  },
};
