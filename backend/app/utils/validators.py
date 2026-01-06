import re
import uuid


def is_uuid(s: str) -> bool:
    try:
        uuid.UUID(s)
        return True
    except Exception:
        return False


def is_ratio(s: str) -> bool:
    return bool(re.fullmatch(r"\d+:\d+", s))


def is_resolution(s: str) -> bool:
    return bool(re.fullmatch(r"\d+x\d+", s))


def non_empty_str(s: str) -> bool:
    return isinstance(s, str) and s.strip() != ""


def compute_etag(payload: str) -> str:
    import hashlib
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

