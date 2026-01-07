from typing import Dict, List, Set
from fastapi import WebSocket
import json
from ..utils.logger import get_logger

class ConnectionManager:
    def __init__(self):
        # map task_id to set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # map websocket to task_id (for quick cleanup if 1:1 or 1:N)
        # Assuming one WS can subscribe to multiple tasks? 
        # The frontend implementation creates a new WS per task subscription, 
        # but the protocol allows "action": "subscribe".
        # Let's support M:N just in case, or keep it simple.
        self.ws_to_tasks: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        if websocket not in self.ws_to_tasks:
            self.ws_to_tasks[websocket] = set()

    def disconnect(self, websocket: WebSocket):
        tasks = self.ws_to_tasks.pop(websocket, set())
        for task_id in tasks:
            if task_id in self.active_connections:
                self.active_connections[task_id].discard(websocket)
                if not self.active_connections[task_id]:
                    del self.active_connections[task_id]

    async def subscribe(self, websocket: WebSocket, task_id: str):
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        self.active_connections[task_id].add(websocket)
        
        if websocket not in self.ws_to_tasks:
            self.ws_to_tasks[websocket] = set()
        self.ws_to_tasks[websocket].add(task_id)
        
        get_logger().info(f"[WS] Client subscribed to task {task_id}")

    async def broadcast(self, task_id: str, message: dict):
        if task_id in self.active_connections:
            # Create a list to avoid runtime error if set changes during iteration
            # (though async send might not yield in a way that modifies the set immediately, safety first)
            targets = list(self.active_connections[task_id])
            if not targets:
                return
            
            txt = json.dumps(message, ensure_ascii=False)
            to_remove = []
            for connection in targets:
                try:
                    await connection.send_text(txt)
                except Exception as e:
                    get_logger().error(f"[WS] Error sending to client: {e}")
                    to_remove.append(connection)
            
            for ws in to_remove:
                self.disconnect(ws)

manager = ConnectionManager()
