import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
from .api.routes_nodes import router as nodes_router
from .api.routes_tasks import router as tasks_router, alias_router as generate_alias_router
from .api.routes_results import router as results_router
from .api.routes_media import router as media_router
from .api.routes_media_gallery import router as media_gallery_router
from .api.routes_health import router as health_router
from .api.routes_ws import router as ws_router
from .services.config_service import ConfigService
from .db.session import engine, DB_PATH
from .models.base import Base
import stat
from starlette.requests import Request
from .api.routes_nodes_tree import router as nodes_tree_router
from .utils.logger import get_logger
import time

app = FastAPI(default_response_class=ORJSONResponse, title="cineMind Backend", version="0.2.1")

log = get_logger()

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        ip = request.client.host if request.client else "-"
        q = request.url.query
        log.info(f"[REQ][{ts}] {ip} {request.method} {request.url.path}{('?' + q) if q else ''}")
    except Exception:
        pass
    response = await call_next(request)
    try:
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        log.info(f"[RES][{ts}] {response.status_code} {request.url.path}")
    except Exception:
        pass
    return response

media_dir = os.path.join(os.path.dirname(__file__), "media")
app.mount("/media", StaticFiles(directory=media_dir), name="media")

app.include_router(nodes_tree_router)
app.include_router(nodes_router)
app.include_router(tasks_router)
app.include_router(generate_alias_router)
app.include_router(results_router)
app.include_router(media_router)
app.include_router(media_gallery_router)
app.include_router(health_router)
app.include_router(ws_router)

# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(__file__), "../../fronted/dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    log.warning(f"Frontend dist not found at {frontend_dist}")

cfg = ConfigService().load()
app.state.config = cfg

@app.on_event("startup")
async def _startup():
    from .models.mind_node import MindNode  # noqa
    from .models.graph_result import GraphResult  # noqa
    from .models.task import Task  # noqa
    Base.metadata.create_all(bind=engine)
    try:
        os.chmod(DB_PATH, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    except Exception:
        pass
    log.info("startup complete")
