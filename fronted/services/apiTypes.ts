export interface GenerateRequestKV {
  任务ID: string;
  影片类型: string;
  环境背景: string;
  图像比例: string;
  分辨率: string;
  [key: string]: string;
}

export interface GenerateAccepted {
  taskId: string;
  accepted: boolean;
  queuedAt: string;
}

export type TaskEvent =
  | { type: 'queued'; taskId: string; position: number }
  | { type: 'running'; taskId: string; progress: number }
  | { type: 'completed'; taskId: string; imageId: string }
  | { type: 'failed'; taskId: string; error: { code: string; message: string } }
  | { type: 'heartbeat'; ts: string };

export interface NodeItem {
  id: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  createdAt: string;
  thumbnailUrl: string;
  status: 'completed' | 'running' | 'failed' | 'queued';
}

export interface PageResult {
  page: number;
  size: 20;
  total: number;
  items: NodeItem[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFail {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFail;

