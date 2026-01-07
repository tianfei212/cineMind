import { AppConfig } from '../types';
import { logger } from '../utils/logger';

export let appConfig: AppConfig | null = null;

export const loadConfig = async (): Promise<AppConfig> => {
  if (appConfig) return appConfig;

  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error('Failed to load config');
    }
    appConfig = await response.json();
    // derive baseUrl if missing and backendHost/Port provided
    if (!appConfig.api.baseUrl && appConfig.api.backendHost && appConfig.api.backendPort) {
      appConfig.api.baseUrl = `http://${appConfig.api.backendHost}:${appConfig.api.backendPort}`;
    }
    // basic schema validation
    const validateNode = (node: any): boolean => {
      if (!node || typeof node.label !== 'string') return false;
      if (node.children) {
        if (!Array.isArray(node.children)) return false;
        for (const c of node.children) {
          if (!validateNode(c)) return false;
        }
      }
      return true;
    };
    if (!validateNode(appConfig.defaultData.cinematicTree)) {
      throw new Error('Invalid cinematicTree schema');
    }
    logger.info('配置加载成功');
    return appConfig!;
  } catch (error) {
    logger.error('配置加载失败', { error: String(error) });
    // Fallback default config if loading fails
    return {
      ui: {
        header: {
          title: "CineMind",
          subtitle: "AI 电影构图辅助系统",
          subtitleEn: "Professional Cinematography"
        },
        footer: {
          text: "CineMind Lab v3.0"
        },
        logo: {
          text: "Cine",
          highlight: "Mind",
          color: "text-blue-600",
          iconUrl: "/assets/logo.svg"
        },
        background: {
          url: "/assets/background.png"
        },
        blurIntensity: 10,
        mainOpacity: 5,
        aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "9:21", "16:9", "21:9"],
        resolutions: ["Standard"],
        levelLabels: ["影片类型", "环境背景", "角色个体", "精彩瞬间", "关键元素", "镜头语言", "年代"]
      },
      api: {
        baseUrl: "http://localhost:3000",
        timeout: 30000,
        endpoints: {
          generate: "/tasks/generate",
          nodes: "/nodes"
        },
        frontendPort: 3001,
        backendHost: "localhost",
        backendPort: 3000
      },
      defaultData: {
        cinematicTree: {
          label: "起点",
          children: []
        },
        is_from_db_load: false
      }
    };
  }
};

export const getConfig = (): AppConfig => {
  if (!appConfig) {
    throw new Error('Config not loaded yet');
  }
  return appConfig;
};
