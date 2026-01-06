from sqlalchemy.orm import Session
from backend.app.db.session import SessionLocal
from backend.app.models.mind_node import MindNode

def main():
    db: Session = SessionLocal()
    try:
        n = MindNode(content="城市夜景，冷光，远景", status=1)
        db.add(n)
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    main()

