import { getConfig } from './configService';
import { request, buildWsUrl } from './httpClient';
import { GenerateRequestKV, ApiResponse, GenerateAccepted, PageResult, TaskEvent } from './apiTypes';

export const submitGenerate = async (payload: GenerateRequestKV): Promise<ApiResponse<GenerateAccepted>> => {
  const { api } = getConfig();
  const data = await request<GenerateAccepted>(api.endpoints.generate, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { success: true, data };
};

type Subscription = { close: () => void };

export const subscribeTask = (taskId: string, onEvent: (e: TaskEvent) => void, onError?: (e: any) => void): Subscription => {
  const { api } = getConfig();
  const timeout = api.timeout ?? 30000;
  let ws: WebSocket | null = null;
  let lastHeartbeat = Date.now();
  let closed = false;
  const connect = () => {
    const url = buildWsUrl('/ws/tasks', { taskId });
    ws = new WebSocket(url);
    ws.onopen = () => {};
    ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data);
        console.log('[WS] Received:', data); // Add logging
        if (data && data.type === 'heartbeat') {
          lastHeartbeat = Date.now();
        }
        onEvent(data as TaskEvent);
      } catch (e) {
          console.error('[WS] Message parse error:', e);
      }
    };
    ws.onerror = e => {
      if (onError) onError(e);
    };
    ws.onclose = () => {
      if (closed) return;
      setTimeout(connect, 1000);
    };
  };
  connect();
  const interval = setInterval(() => {
    if (Date.now() - lastHeartbeat > timeout * 2) {
      try {
        ws && ws.close();
      } catch {}
    }
  }, Math.max(5000, timeout));
  return {
    close: () => {
      closed = true;
      clearInterval(interval);
      try {
        ws && ws.close();
      } catch {}
    },
  };
};

export const listNodes = async (page: number = 1): Promise<ApiResponse<PageResult>> => {
  const { api } = getConfig();
  const p = new URLSearchParams({ page: String(Math.max(1, page)) }).toString();
  const data = await request<PageResult>(`${api.endpoints.nodes}?${p}`, { method: 'GET' });
  return { success: true, data };
};

export const getNodeImage = async (id: string): Promise<Blob> => {
  const { api } = getConfig();
  return await request<Blob>(`${api.endpoints.nodes}/${id}`, { method: 'GET' });
};

export const getCinematicTree = async (): Promise<any> => {
  const { api } = getConfig();
  const data = await request<any>(`/pages/tree`, { method: 'GET' });
  return data;
};

export const aiSuggest = async (labels: string[], top: number = 10): Promise<{ labels: string[]; prompts: { zh: string; en: string; styleHints: string[] }; keywords: string[] }> => {
  const data = await request<{ labels: string[]; prompts: { zh: string; en: string; styleHints: string[] }; keywords: string[] }>(`/nodes/ai-suggest`, {
    method: 'POST',
    body: JSON.stringify({ labels, top }),
  });
  return data;
};

export const stepSuggest = async (items: { type: string; label: string }[], targetType: string, top: number = 10): Promise<{ target_type: string; items: string[] }> => {
  const data = await request<{ target_type: string; items: string[] }>(`/nodes/actions/step-suggest`, {
    method: 'POST',
    body: JSON.stringify({ items, target_type: targetType, top }),
  });
  return data;
};

const resolutionToWxH = (resolution: string, ratio: string): string => {
  const table: Record<string, Record<string, string>> = {
    '1:1': { 'Standard': '1536x1536' },
    '2:3': { 'Standard': '1248x1872' },
    '3:2': { 'Standard': '1872x1248' },
    '3:4': { 'Standard': '1296x1728' },
    '4:3': { 'Standard': '1728x1296' },
    '7:9': { 'Standard': '1344x1728' },
    '9:7': { 'Standard': '1728x1344' },
    '9:16': { 'Standard': '1152x2048' },
    '9:21': { 'Standard': '864x2016' },
    '16:9': { 'Standard': '2048x1152' },
    '21:9': { 'Standard': '2016x864' },
    '2.35:1': { 'Standard': '2048x870' } // Keeping a reasonable default for 2.35:1 based on 2k width
  };
  
  // Fallback for legacy resolution keys if needed, but primarily use 'Standard'
  const legacyTable: Record<string, Record<string, string>> = {
    '16:9': { '480p': '854x480', '720p': '1280x720', '1k': '1920x1080', '2k': '2560x1440' },
    '4:3': { '480p': '640x480', '720p': '960x720', '1k': '1440x1080', '2k': '2048x1536' },
    '1:1': { '480p': '480x480', '720p': '720x720', '1k': '1024x1024', '2k': '2048x2048' },
    '2.35:1': { '480p': '854x363', '720p': '1280x545', '1k': '1920x817', '2k': '2560x1091' },
  };

  const byRatio = table[ratio];
  if (byRatio && byRatio['Standard']) {
      return byRatio['Standard'];
  }
  
  // Fallback to legacy behavior if not in new table or resolution is not Standard
  const legacyByRatio = legacyTable[ratio] || legacyTable['16:9'];
  return legacyByRatio[resolution] || legacyByRatio['720p'];
};

const makeUuid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const s = `${hex(8)}-${hex(4)}-4${hex(3)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${hex(3)}-${hex(12)}`;
  return s;
};

export interface GenerateTaskPayload {
  任务ID: string;
  影片类型: string;
  环境背景: string;
  主角类型?: string;
  角色个体?: string;
  精彩瞬间?: string;
  关键元素?: string;
  镜头语言?: string;
  年代?: string;
  图像比例: string;
  分辨率: string;
  关键词_影片类型?: string[];
  关键词_环境背景?: string[];
  关键词_主角类型?: string[];
  关键词_角色个体?: string[];
  关键词_精彩瞬间?: string[];
  关键词_关键元素?: string[];
  关键词_镜头语言?: string[];
  关键词_年代?: string[];
}

export const generateImageTask = async (payload: Omit<GenerateTaskPayload, '分辨率'> & { 分辨率: string; ratioKey?: string; resolutionKey?: string }) => {
  const { ui, api } = getConfig();
  const ratio = payload.图像比例 || ui.aspectRatios?.[0] || '16:9';
  const resKey = payload.resolutionKey || ui.resolutions?.[1] || '720p';
  const wxh = resolutionToWxH(resKey, ratio);
  
  // Filter out keys starting with "关键词_"
  const filteredPayload: Record<string, any> = {};
  Object.keys(payload).forEach(key => {
    if (!key.startsWith('关键词_')) {
      filteredPayload[key] = (payload as any)[key];
    }
  });

  const finalPayload = {
    ...filteredPayload,
    任务ID: (payload.任务ID && typeof payload.任务ID === 'string' && payload.任务ID.length === 36) ? payload.任务ID : makeUuid(),
    图像比例: ratio,
    分辨率: wxh,
    内容: (payload as any)['内容'] || '',
  };
  
  // Clean up utility keys that shouldn't be sent if they exist in payload but not filtered
  delete (finalPayload as any).resolutionKey;
  delete (finalPayload as any).ratioKey;

  const data = await request<{ task_id: string; queued_at: string }>(api.endpoints.generate || '/tasks/generate', {
    method: 'POST',
    body: JSON.stringify(finalPayload),
  });
  return data;
};
export const createMindNode = async (content: string): Promise<{ node_id: string }> => {
  const { api } = getConfig();
  const data = await request<{ node_id: string }>(`/nodes`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 1 }),
  });
  return data;
};

export const getKeywords = async (nodeId: string, top: number = 10): Promise<{ node_id: string; source: string; items: string[] }> => {
  const data = await request<{ node_id: string; source: string; items: string[] }>(`/nodes/${nodeId}/keywords?top=${top}`, { method: 'GET' });
  return data;
};

export const getAiContent = async (nodeId: string): Promise<{ node_id: string; prompts: { zh: string; en: string; styleHints: string[] } }> => {
  const data = await request<{ node_id: string; prompts: { zh: string; en: string; styleHints: string[] } }>(`/nodes/${nodeId}/ai-content`, { method: 'GET' });
  return data;
};

export interface GalleryItem {
  id: string;
  thumbUrl: string;
  url: string;
  createTime: string;
  dimensions: string;
  prompt: string;
  params?: any;
}

export interface GalleryPage {
  items: GalleryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const getGallery = async (page: number = 1, pageSize: number = 20): Promise<GalleryPage> => {
  const { api } = getConfig();
  const host = api.backendHost || 'localhost';
  const port = api.backendPort || 3002;
  const base = api.baseUrl || `http://${host}:${port}`;
  const data = await request<GalleryPage>(`${base}/api/media?page=${page}&pageSize=${pageSize}&sort=createTime,desc`, { method: 'GET' });
  return data;
};
