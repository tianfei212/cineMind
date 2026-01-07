
export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "7:9" | "9:7" | "9:16" | "9:21" | "16:9" | "21:9" | "2.35:1";

export type Resolution = "480p" | "720p" | "1k" | "2k" | "Standard";

export interface GeneratedImage {
  id: string;
  url: string;
  fullUrl?: string;
  timestamp: number;
  prompt: string;
  params?: any;
  config: {
    ratio: AspectRatio;
    resolution: Resolution;
  };
}

export interface CinematicNode {
  label: string;
  children?: CinematicNode[];
  desc?: string;
}

export interface MindNode {
  id: string;
  label: string;
  parentId?: string;
  x: number;
  y: number;
  isSelected?: boolean;
  level: number;
}

export interface AppConfig {
  ui: {
    header: {
      title: string;
      subtitle: string;
      subtitleEn: string;
    };
    footer: {
      text: string;
    };
    logo: {
      text: string;
      highlight: string;
      color: string;
      iconUrl?: string;
    };
    background: {
      url: string;
    };
    blurIntensity?: number;
    mainOpacity?: number;
    aspectRatios?: AspectRatio[];
    resolutions?: Resolution[];
    levelLabels?: string[];
  };
  api: {
    baseUrl: string;
    timeout: number;
    endpoints: {
      generate: string;
      nodes: string;
    };
    frontendPort?: number;
    backendHost?: string;
    backendPort?: number;
  };
  defaultData: {
    cinematicTree: CinematicNode;
    is_from_db_load?: boolean;
  };
}
