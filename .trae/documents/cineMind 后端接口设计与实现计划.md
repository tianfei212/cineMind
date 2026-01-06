# 目标
- 基于已确认的接口与规范，在 backend 目录实现完整后端：环境与依赖、数据库与迁移、REST/WS 接口、第三方服务封装、静态资源与目录接口、单元测试与 CI、OpenAPI 文档与 Postman 集合。

# 实施总览
- 技术栈：FastAPI 0.95+、SQLAlchemy 2.0、Alembic、SQLite、httpx、Pydantic v2、websockets、fastapi-etag、orjson、pytest/pytest-cov。
- 路由分组：Nodes、Tasks、Results、Media、WebSocket、Health；兼容前端的 /generate 与 /image-nodes。

# 1. 项目骨架与依赖
- 创建 backend 目录结构：
  - app/{api,models,schemas,services,db,utils,docs,media}
  - tests、migrations、scripts
- 添加环境与依赖文件：
  - environment.yml（固定版本，含 pillow==10.4.0 生成缩略图）
  - requirements.txt（pip freeze）
  - .env.sample（QWEN/Z-IMAGE KEY、HOST/PORT、Is_full_by_AI、USE_REDIS）
- 说明文档：在 backend/docs 保存“后端接口设计与实现规范”，包含完整接口、消息流与架构图。

# 2. FastAPI 入口与基础设施
- app/main.py：
  - 应用创建、CORS、JSON 序列化(orjson)、异常与统一响应包装（code/message/data）
  - StaticFiles 挂载 /media → backend/media
  - 路由注册与 Tags、/docs 与 /redoc 开启
- utils/validators.py：UUID、比例(W:H)、分辨率(WxH)、ETag 计算
- utils/errors.py：业务错误码与异常映射
- utils/logging.py：请求日志、外部服务调用耗时与脱敏

# 3. 数据库与迁移
- db/session.py：Engine 与 Session 配置（pool_size/max_overflow/pre_ping/timeout）
- models：
  - mind_nodes（UUID、content、created/updated、status、索引）
  - graph_results（UUID、related_nodes JSON、params JSON、prompt_zh/prompt_en、storage/thumbnail 相对路径、mime/size/checksum、generated_at、索引）
  - tasks（任务状态、进度、错误、时间戳）
- Alembic：初始化与首版迁移，scripts/init_db.py 初始化与 scripts/seed_demo.py 示例数据。

# 4. 路由与业务实现
- api/routes_nodes.py：
  - POST /nodes、GET /nodes/{id}（ETag）、PUT（乐观锁）、DELETE（软删除）、GET /nodes（分页/过滤）
  - GET /nodes/{id}/keywords?top=10（Is_full_by_AI=true→Qwen；false→DB）
- api/routes_tasks.py：
  - POST /tasks/generate（中文键名）→202
  - GET /tasks/{task_id}
  - 别名：POST /generate（同行为）
- api/routes_ws.py：WebSocket /ws/tasks（queued/running/completed/failed/heartbeat）
- api/routes_results.py：GET /results/{graph_id}（Accept: image/* 返回二进制；否则返回元数据 JSON）
- api/routes_media.py：GET /media/tree、GET /media/files?dir=...、GET /media/file-meta/{graph_id}
- api/routes_health.py：GET /health、GET /health/redis（占位）

# 5. 第三方服务与编排
- services/prompt_builder.py：将中文键值对组装为结构化提示；风格词过滤；输出中英 + styleHints
- services/qwen_client.py：参数验证与转换、指数退避、熔断、超时、日志
- services/zimage_client.py：参数转换、回调或轮询、超时与重试、结果落地（backend/media）、缩略图生成（Pillow）、相对路径返回
- services/task_service.py：校验→任务入库→Qwen→z-image→落库 graph_results→WS 推送
- services/keywords_service.py：按 Is_full_by_AI 调 Qwen 或 DB 返回 Top10
- services/redis_client.py：占位接口签名（get/set/pubsub），默认禁用

# 6. 存储与路径
- 文件：
  - images/YYYY/MM/DD/{imageId}.{ext}
  - thumbs/YYYY/MM/DD/{imageId}_thumb.{ext}
- 数据库：仅存相对路径；不存图片二进制
- 接口：所有 URL 返回以 /media 开头的相对路径

# 7. OpenAPI 文档与示例
- Pydantic 模型提供 json_schema_extra 示例（覆盖 CRUD、查询、目录/文件、错误码）
- Tags 与分组清晰；兼容前端字段（prompt 与 prompts.zh/en）

# 8. 测试与 CI
- tests：API（ETag/乐观锁/软删除）、WS、结果多格式、目录/文件接口、第三方失败与重试、关键词服务开关、健康检查；mock httpx
- 覆盖率 ≥80%；pytest-cov 输出报告
- GitHub Actions：安装 conda、激活环境、运行 pytest 与 coverage；可选 lint（ruff/flake8）

# 9. 交付物
- backend/docs/cineMind-后端接口设计与实现规范.md（本规范）
- OpenAPI `/docs`、`/redoc`
- Postman 集合（实现后导出）
- 测试报告与 CI 配置

# 下一步
- 我将按本计划在 backend/docs 保存文档，然后开始编码实现上述模块与接口，并逐步提交测试与文档。