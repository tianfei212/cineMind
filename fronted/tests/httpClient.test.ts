import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, HttpError } from '../services/httpClient';

vi.mock('../services/configService', () => {
  return {
    getConfig: () => ({
      api: {
        baseUrl: 'http://localhost:3000',
        timeout: 30000,
        endpoints: { generate: '/generate', nodes: '/nodes' },
      },
    }),
    loadConfig: vi.fn(async () => {}),
  };
});

const jsonHeaders = { get: () => 'application/json' } as any;

describe('httpClient', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  it('returns data on JSON success envelope', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: jsonHeaders,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    const res = await request<{ ok: boolean }>('/test', { method: 'GET' });
    expect(res.ok).toBe(true);
  });

  it('throws HttpError on JSON failure envelope', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: jsonHeaders,
      json: async () => ({ success: false, error: { code: 'INVALID_PARAM', message: 'bad' } }),
    });
    await expect(request('/test', { method: 'GET' })).rejects.toBeInstanceOf(HttpError);
  });

  it('times out and throws HttpError with TIMEOUT', async () => {
    (globalThis as any).fetch.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 20);
    }));
    await expect(request('/slow', { method: 'GET', timeout: 10 })).rejects.toMatchObject({ code: 'TIMEOUT', status: 408 });
  });
});
