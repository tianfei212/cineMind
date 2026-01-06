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
