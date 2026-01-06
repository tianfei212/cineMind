import { AppConfig } from '../types';

export let appConfig: AppConfig | null = null;

export const loadConfig = async (): Promise<AppConfig> => {
  if (appConfig) return appConfig;

  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error('Failed to load config');
    }
    appConfig = await response.json();
    return appConfig!;
  } catch (error) {
    console.error('Error loading config:', error);
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
        mainOpacity: 5
      },
      api: {
        baseUrl: "http://localhost:3000",
        timeout: 30000,
        endpoints: {
          generate: "/generate",
          nodes: "/nodes"
        }
      },
      defaultData: {
        cinematicTree: {
          label: "起点",
          children: []
        }
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
