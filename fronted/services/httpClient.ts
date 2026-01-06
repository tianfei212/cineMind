import { loadConfig, getConfig } from './configService';

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  constructor(message: string, status: number, code?: string, details?: unknown, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

type RequestOptions = Omit<RequestInit, 'signal'> & { timeout?: number; retry?: number };

const ensureConfig = async () => {
  try {
    getConfig();
  } catch {
    await loadConfig();
  }
};

const buildUrl = (path: string) => {
  const { api } = getConfig();
  const base = api.baseUrl || `http://${api.backendHost}:${api.backendPort}`;
  return `${base}${path}`;
};

export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  await ensureConfig();
  const { api } = getConfig();
  const controller = new AbortController();
  const timeoutMs = options.timeout ?? api.timeout ?? 30000;
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const headers = { 'Content-Type': 'application/json', 'X-Request-Id': id, ...(options.headers || {}) };
  const retry = Math.max(0, options.retry ?? 0);
  const url = buildUrl(path);

  const run = async (): Promise<T> => {
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json && json.success === true) return json.data as T;
        if (json && typeof json.code === 'number') {
          if (json.code === 0) return json.data as T;
          throw new HttpError(json.message || 'Request failed', res.status, String(json.code), json.data, id);
        }
        const error = json && json.error ? json.error : {};
        throw new HttpError(error.message || 'Request failed', res.status, error.code, error.details, id);
      } else if (res.ok) {
        const blob = await res.blob();
        return blob as unknown as T;
      } else {
        throw new HttpError('Non-JSON error', res.status, undefined, undefined, id);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw new HttpError('Request timeout', 408, 'TIMEOUT', undefined, id);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  let attempt = 0;
  while (true) {
    try {
      return await run();
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 0;
      if (status >= 500 && attempt < retry) {
        attempt += 1;
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
};

export const buildWsUrl = (path: string, query?: Record<string, string | number | boolean>) => {
  const { api } = getConfig();
  const base = api.baseUrl || `http://${api.backendHost}:${api.backendPort}`;
  const proto = base.startsWith('https') ? 'wss' : 'ws';
  const u = new URL(base);
  const q = query ? new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString() : '';
  return `${proto}://${u.host}${path}${q ? `?${q}` : ''}`;
};
