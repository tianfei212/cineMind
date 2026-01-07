from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from datetime import datetime
import asyncio
import json
from ..services.ws_manager import manager

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/tasks")
async def ws_tasks(ws: WebSocket, taskId: str = Query(None)):
    await manager.connect(ws)
    try:
        if taskId:
            await manager.subscribe(ws, taskId)
            
        while True:
            try:
                # Wait for messages, but primarily keep connection alive
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                try:
                    msg = json.loads(data)
                    if msg.get("action") == "subscribe" and msg.get("taskId"):
                        await manager.subscribe(ws, msg["taskId"])
                except:
                    pass
                # Echo heartbeat on any message
                await ws.send_json({"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
            except asyncio.TimeoutError:
                # Send heartbeat on timeout
                await ws.send_json({"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
