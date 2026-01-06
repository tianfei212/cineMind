from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..utils.response import ok, error
from ..utils.errors import ErrorCodes
from ..db.session import SessionLocal
from ..utils.validators import is_uuid, is_ratio, is_resolution, non_empty_str
from ..schemas.tasks import TaskAccepted
from ..models.task import Task
from ..services.task_service import enqueue_generate, process_task
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_kv(payload: dict) -> bool:
    required = ["任务ID", "影片类型", "环境背景", "图像比例", "分辨率"]
    for k in required:
        if k not in payload or not non_empty_str(payload[k]):
            return False
    if not is_uuid(payload["任务ID"]):
        return False
    if not is_ratio(payload["图像比例"]):
        return False
    if not is_resolution(payload["分辨率"]):
        return False
    return True


@router.post("/generate")
async def tasks_generate(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    if not isinstance(payload, dict) or not validate_kv(payload):
        return error(ErrorCodes.INVALID_PARAM, "invalid generate payload")
    task = await enqueue_generate(db, payload)
    accepted = TaskAccepted(task_id=task.task_id, queued_at=datetime.utcnow().isoformat())
    return ok(accepted.model_dump(), "accepted")


@router.get("/{task_id}")
def task_status(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        return error(ErrorCodes.NOT_FOUND, "task not found", status_code=404)
    return ok({"status": task.status, "progress": task.progress})


alias_router = APIRouter(tags=["Tasks"])


@alias_router.post("/generate")
async def alias_generate(request: Request, db: Session = Depends(get_db)):
    return await tasks_generate(request, db)

