import requests
import json
import uuid

def test_generate_task():
    url = "http://localhost:3002/tasks/generate"
    
    # 模拟前端发送的 Payload，包含中文字段和潜在的冗余字段
    payload = {
        "任务ID": str(uuid.uuid4()),
        "影片类型": "动作电影",
        "环境背景": "雨中街头",
        "主角类型": "硬汉",
        "角色个体": "警察",
        "精彩瞬间": "秘密潜入",
        "关键元素": "打斗",
        "镜头语言": "广角镜头",
        "年代": "经典动作片",
        "图像比例": "16:9",
        "分辨率": "854x480",
        "resolutionKey": "480p", # 冗余字段，测试后端是否正确忽略或处理
        "关键词_环境背景": ["城市夜景", "高楼大厦"], # 冗余字段，测试是否被过滤或不影响
        "内容": "动作电影，雨中街头，硬汉，警察，秘密潜入，打斗，广角镜头，经典动作片"
    }
    
    print(f"Sending request to {url} with payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    try:
        response = requests.post(url, json=payload)
        print(f"\nResponse Status Code: {response.status_code}")
        print("Response Body:")
        print(response.text)
        
        if response.status_code == 200:
            print("\n✅ Test Passed: Task successfully queued.")
        else:
            print("\n❌ Test Failed: Backend returned error.")
            
    except Exception as e:
        print(f"\n❌ Test Failed: Exception occurred: {e}")

if __name__ == "__main__":
    test_generate_task()
