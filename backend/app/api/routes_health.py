from fastapi import APIRouter
from ..utils.response import ok
import os

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def health():
    return ok({"status": "ok"})


@router.get("/redis")
def health_redis():
    use = os.getenv("USE_REDIS", "false").lower() == "true"
    return ok({"status": "ok" if use else "disabled"})

