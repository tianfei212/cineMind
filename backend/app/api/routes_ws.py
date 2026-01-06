from fastapi import APIRouter, WebSocket
from datetime import datetime
import asyncio

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/tasks")
async def ws_tasks(ws: WebSocket):
    await ws.accept()
    try:
        last = datetime.utcnow()
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                await ws.send_json({"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
            except asyncio.TimeoutError:
                await ws.send_json({"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
    except Exception:
        await ws.close()

