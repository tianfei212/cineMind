from fastapi import APIRouter, Query
from ..utils.response import ok
import os
import pathlib
from datetime import datetime

router = APIRouter(prefix="/media", tags=["Media"])


def media_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[2] / "media"


@router.get("/tree")
def media_tree(type: str = "", date: str = ""):
    root = media_root()
    if not type:
        data = {"name": "media", "path": "/media", "type": "dir", "children": [{"name": "images", "path": "/media/images", "type": "dir"}, {"name": "thumbs", "path": "/media/thumbs", "type": "dir"}]}
        return ok(data)
    if type not in ("images", "thumbs"):
        return ok({"name": type, "path": f"/media/{type}", "type": "dir", "children": []})
    path = root / type
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            path = path / f"{dt:%Y}" / f"{dt:%m}" / f"{dt:%d}"
        except Exception:
            pass
    parts = str(path).split("backend/app")[-1]
    return ok({"name": path.name, "path": f"/media{parts}", "type": "dir"})


@router.get("/files")
def media_files(dir: str = Query(...)):
    root = media_root()
    base = root / dir.replace("/media/", "")
    items = []
    if base.exists() and base.is_dir():
        for p in base.iterdir():
            if p.is_file():
                items.append({"name": p.name, "path": f"/media/{p.relative_to(root)}", "url": f"/media/{p.relative_to(root)}", "mimeType": "image/jpeg", "sizeBytes": p.stat().st_size, "createdAt": datetime.utcfromtimestamp(p.stat().st_mtime).isoformat()})
    return ok(items)


@router.get("/file-meta/{image_id}")
def file_meta(image_id: str):
    root = media_root()
    for d in ["images", "thumbs"]:
        for p in root.glob(f"{d}/**/{image_id}*"):
            return ok({"name": p.name, "path": f"/media/{p.relative_to(root)}", "mimeType": "image/jpeg", "sizeBytes": p.stat().st_size, "createdAt": datetime.utcfromtimestamp(p.stat().st_mtime).isoformat()})
    return ok({})

