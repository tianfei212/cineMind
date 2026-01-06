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
        if (data && data.type === 'heartbeat') {
          lastHeartbeat = Date.now();
        }
        onEvent(data as TaskEvent);
      } catch {}
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
    '16:9': { '480p': '854x480', '720p': '1280x720', '1k': '1920x1080', '2k': '2560x1440' },
    '4:3': { '480p': '640x480', '720p': '960x720', '1k': '1440x1080', '2k': '2048x1536' },
    '1:1': { '480p': '480x480', '720p': '720x720', '1k': '1024x1024', '2k': '2048x2048' },
    '2.35:1': { '480p': '854x363', '720p': '1280x545', '1k': '1920x817', '2k': '2560x1091' },
  };
  const byRatio = table[ratio] || table['16:9'];
  return byRatio[resolution] || byRatio['720p'];
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
  const finalPayload = {
    任务ID: payload.任务ID,
    图像比例: ratio,
    分辨率: wxh,
    内容: (payload as any)['内容'] || '',
  };
  const data = await request<{ task_id: string; queued_at: string }>(api.endpoints.generate || '/generate', {
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
