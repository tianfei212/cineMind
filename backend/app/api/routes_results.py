from fastapi import APIRouter, Depends, Request
from fastapi.responses import ORJSONResponse, FileResponse
from sqlalchemy.orm import Session
from ..db.session import SessionLocal
from ..models.graph_result import GraphResult
from ..utils.response import ok, error
from ..utils.errors import ErrorCodes
import os

router = APIRouter(prefix="/results", tags=["Results"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{graph_id}")
def get_result(graph_id: str, request: Request, db: Session = Depends(get_db)):
    gr = db.query(GraphResult).filter(GraphResult.graph_id == graph_id).first()
    if not gr:
        return error(ErrorCodes.NOT_FOUND, "result not found", status_code=404)
    accept = request.headers.get("Accept", "")
    if "image/" in accept and gr.storage_path:
        base = os.path.dirname(os.path.dirname(__file__))
        fp = os.path.join(base, gr.storage_path.lstrip("/"))
        if os.path.exists(fp):
            return FileResponse(fp, media_type=gr.mime_type or "image/jpeg")
    return ok({"graph_id": gr.graph_id, "storage_path": gr.storage_path, "thumbnail_path": gr.thumbnail_path, "prompts": {"zh": gr.prompt_zh or "", "en": gr.prompt_en or ""}, "params": {}, "generated_at": gr.generated_at.isoformat()})

