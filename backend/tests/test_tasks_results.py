from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_tasks_generate_and_status():
    payload = {
        "任务ID": "00000000-0000-0000-0000-000000000001",
        "影片类型": "科幻",
        "环境背景": "城市夜景",
        "图像比例": "16:9",
        "分辨率": "512x512",
        "光照风格": "冷光",
        "镜头语言": "远景",
    }
    r = client.post("/tasks/generate", json=payload)
    assert r.status_code == 200
    task_id = r.json()["data"]["task_id"]
    r = client.get(f"/tasks/{task_id}")
    assert r.status_code == 200
