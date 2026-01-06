from fastapi import APIRouter, Request
from ..services.config_service import ConfigService

router = APIRouter(prefix="/pages", tags=["Pages"])


@router.get("/tree")
def nodes_tree(request: Request):
    cfg = getattr(request.app.state, "config", {}) or {}
    if not cfg or "cinematicTree" not in cfg:
        cfg = ConfigService().load() or {}
    tree = cfg.get("cinematicTree") or {
        "label": "起点",
        "desc": "电影构图发散树的根节点",
        "children": [
            {"label": "科幻", "desc": "影片类型：未来科技、宇宙探索、人工智能等主题"},
            {"label": "二次元动漫", "desc": "影片类型：动画美学、夸张表现、幻想叙事"},
            {"label": "纪实电影", "desc": "影片类型：真实事件、观察视角、社会议题"},
            {"label": "浪漫电影", "desc": "影片类型：爱情叙事、诗意表达、情感抒发"},
            {"label": "惊恐电影", "desc": "影片类型：恐惧心理、未知威胁、压迫氛围"},
            {"label": "动作电影", "desc": "影片类型：速度与力量、强对抗、高张力"},
            {"label": "悬疑电影", "desc": "影片类型：谜题结构、反转叙事、心理张力"},
            {"label": "历史史诗", "desc": "影片类型：宏大叙事、时代冲突、文明史诗"},
            {"label": "奇幻电影", "desc": "影片类型：魔法设定、非现实世界、象征寓言"},
            {"label": "黑色幽默", "desc": "影片类型：荒诞讽刺、反讽喜剧、黑色风格"},
        ],
    }
    return {"code": 0, "message": "ok", "data": tree}
