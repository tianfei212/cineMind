from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import engine
from backend.app.models.base import Base
from backend.app.models.mind_node import MindNode  # noqa

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_create_get_update_delete_node():
    r = client.post("/nodes", json={"content": "测试节点", "status": 1})
    assert r.status_code == 200
    node_id = r.json()["data"]["node_id"]
    r = client.get(f"/nodes/{node_id}")
    assert r.status_code == 200
    etag = r.headers.get("ETag")
    r304 = client.get(f"/nodes/{node_id}", headers={"If-None-Match": etag})
    assert r304.status_code == 304
    r = client.put(f"/nodes/{node_id}", json={"content": "更新内容"})
    assert r.status_code == 200
    r = client.delete(f"/nodes/{node_id}")
    assert r.status_code == 200

