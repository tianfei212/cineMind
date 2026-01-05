
import { GoogleGenAI } from "@google/genai";
import { getConfig } from './configService';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// 预定义类别序列，用于引导思维导图生成
export const CATEGORIES = [
  "环境背景", "气氛", "场景", "角色个体", "精彩瞬间", "关键元素", "镜头语言", "年代"
];

export const generateCinematicImage = async (prompt: string, ratio: string): Promise<string | null> => {
  const config = getConfig();
  
  // Use config endpoint if needed, for now keeping Gemini implementation
  // but using config for potential future API adjustments
  
  const ai = getAI();
  try {
    let ar: any = "1:1";
    if (ratio === "16:9") ar = "16:9";
    if (ratio === "4:3") ar = "4:3";
    if (ratio === "2.35:1") ar = "16:9"; 

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: `A high-end cinematic masterpiece. Scene prompt: ${prompt}. Professional cinematography, high budget film look, shot on IMAX, anamorphic lenses, stunning color grading, detailed textures, 8k resolution.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: ar,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("图像生成失败", error);
    // You could fallback to a backend API call here using config.api.baseUrl
    return null;
  }
};

