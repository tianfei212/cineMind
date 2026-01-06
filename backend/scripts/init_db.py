import os
from sqlalchemy import text
from backend.app.db.session import engine, DB_PATH
from backend.app.models.base import Base
from backend.app.models.mind_node import MindNode  # noqa
from backend.app.models.graph_result import GraphResult  # noqa
from backend.app.models.task import Task  # noqa

def main():
    Base.metadata.create_all(bind=engine)
    try:
        os.chmod(DB_PATH, 0o644)
    except Exception:
        pass
    with engine.connect() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mind_nodes_status ON mind_nodes(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mind_nodes_created_at ON mind_nodes(created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_graph_results_generated_at ON graph_results(generated_at)"))
        conn.commit()

if __name__ == "__main__":
    main()

