import asyncio
import json
import os
import sys

# Add the project root to sys.path
sys.path.append("/home/ubuntu/codes/cineMind")

from backend.app.services.zimage_client import ZImageClient

async def main():
    client = ZImageClient(timeout_ms=120000)
    
    # Prompt from user
    prompt_zh = "请创建一幅16:9比例的城市夜景动作场景，展现繁华都市夜晚的动感与活力。画面中应有明显的动态元素如行驶中的车辆或奔跑的人物，背景为高楼大厦及霓虹灯光，光源主要来自城市灯光和车灯，形成强烈的对比和光影效果。构图上采用三分法则，突出主体的同时保持整体画面的平衡感。镜头语言上追求速度感和紧张氛围，风格偏向现代都市风。"
    
    # Translation (approximate)
    prompt_en = "Create a 16:9 ratio urban night action scene, showing the dynamism and vitality of a bustling city at night. The scene should have obvious dynamic elements such as moving vehicles or running figures, with a background of skyscrapers and neon lights. The light sources mainly come from city lights and car lights, forming a strong contrast and light and shadow effects. The composition uses the rule of thirds, highlighting the subject while maintaining the overall balance of the picture. The camera language pursues a sense of speed and tension, and the style leans towards modern urban style."

    prompts = {
        "zh": prompt_zh,
        "en": prompt_en
    }
    
    params = {
        "ratio": "16:9",
        # ZImageClient infers resolution from ratio if not provided
    }
    
    print(f"Generating image with prompt (EN): {prompt_en[:50]}...")
    try:
        result = await client.generate_image(prompts, params)
        print("Image generated successfully!")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
