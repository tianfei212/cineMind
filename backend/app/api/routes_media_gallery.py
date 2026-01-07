from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from ..db.session import SessionLocal
from ..models.graph_result import GraphResult
from ..utils.response import ok
from typing import List, Optional
import json

router = APIRouter(prefix="/api/media", tags=["Media"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("")
def get_gallery_items(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    sort: str = "createTime,desc",
    db: Session = Depends(get_db)
):
    query = db.query(GraphResult)
    
    # Sorting
    if sort == "createTime,desc":
        query = query.order_by(GraphResult.generated_at.desc())
    elif sort == "createTime,asc":
        query = query.order_by(GraphResult.generated_at.asc())
        
    total = query.count()
    offset = (page - 1) * pageSize
    items = query.offset(offset).limit(pageSize).all()
    
    result_items = []
    for item in items:
        # Construct full URL if needed, or relative path
        # Assuming frontend handles base URL or backend provides it
        # Based on task_service.py fix, let's provide relative path and let frontend/proxy handle it,
        # OR provide full URL if backend_host is known. 
        # For now, consistent with task_service fix, we might want to return full URL or keep relative.
        # The user requirement says: "thumbUrl": " ${cdn_path} /thumbs/ ${file_hash} .jpg"
        # We will use the stored paths.
        
        # Parse params to get dimensions if available
        dimensions = "Unknown"
        try:
            p = json.loads(item.params)
            if "width" in p and "height" in p:
                dimensions = f"{p['width']}x{p['height']}"
            elif "resolution" in p:
                 dimensions = p["resolution"]
        except:
            pass

        thumb_url = item.thumbnail_path or item.storage_path
        full_url = item.storage_path
        
        # Fix double /media/media path issue if present in DB
        if thumb_url and thumb_url.startswith("/media/media"):
            thumb_url = thumb_url.replace("/media/media", "/media")
        if full_url and full_url.startswith("/media/media"):
            full_url = full_url.replace("/media/media", "/media")

        result_items.append({
            "id": item.graph_id,
            "thumbUrl": thumb_url, 
            "url": full_url,
            "createTime": item.generated_at.isoformat(),
            "dimensions": dimensions,
            "prompt": item.prompt_zh
        })
        
    return ok({
        "items": result_items,
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": (total + pageSize - 1) // pageSize
    })
