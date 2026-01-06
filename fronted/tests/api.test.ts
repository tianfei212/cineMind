import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitGenerate, listNodes, getNodeImage, subscribeTask } from '../services/api';
import type { TaskEvent } from '../services/apiTypes';

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

describe('api module', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submitGenerate sends key-value payload and receives acceptance', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 202,
      headers: jsonHeaders,
      json: async () => ({ success: true, data: { taskId: 't1', accepted: true, queuedAt: new Date().toISOString() } }),
    });
    const res = await submitGenerate({ 任务ID: 't1', 影片类型: '科幻', 环境背景: '城市夜景', 图像比例: '16:9', 分辨率: '1024x576' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.accepted).toBe(true);
  });

  it('listNodes returns top 20 descending', async () => {
    const now = Date.now();
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: jsonHeaders,
      json: async () => ({
        success: true,
        data: {
          page: 1,
          size: 20,
          total: 40,
          items: [
            { id: 'a', prompt: 'p', aspectRatio: '16:9', resolution: '1920x1080', createdAt: new Date(now).toISOString(), thumbnailUrl: 'u', status: 'completed' },
            { id: 'b', prompt: 'p', aspectRatio: '16:9', resolution: '1920x1080', createdAt: new Date(now - 1000).toISOString(), thumbnailUrl: 'u', status: 'completed' },
          ],
        },
      }),
    });
    const res = await listNodes(1);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.size).toBe(20);
      const a = new Date(res.data.items[0].createdAt).getTime();
      const b = new Date(res.data.items[1].createdAt).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it('getNodeImage returns blob', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      blob: async () => new Blob(['x'], { type: 'image/png' }),
    });
    const blob = await getNodeImage('img_1');
    expect(blob instanceof Blob).toBe(true);
    expect(blob.type).toBe('image/png');
  });

  it('subscribeTask receives events and supports close', async () => {
    class MockWS {
      url: string;
      onopen: ((this: WebSocket, ev: Event) => any) | null = null;
      onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
      onerror: ((this: WebSocket, ev: Event) => any) | null = null;
      onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.onopen && this.onopen(new Event('open'));
          this.onmessage && this.onmessage(new MessageEvent('message', { data: JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() }) }));
          this.onmessage && this.onmessage(new MessageEvent('message', { data: JSON.stringify({ type: 'queued', taskId: 't1', position: 1 }) }));
        }, 10);
      }
      close() {
        this.onclose && this.onclose(new CloseEvent('close'));
      }
    }
    (globalThis as any).WebSocket = MockWS as any;
    const events: TaskEvent[] = [];
    const sub = subscribeTask('t1', e => events.push(e));
    await new Promise(r => setTimeout(r, 50));
    expect(events.some(e => e.type === 'queued')).toBe(true);
    sub.close();
  });
});

