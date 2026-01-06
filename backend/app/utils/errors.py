from typing import Optional


class ErrorCodes:
    INVALID_PARAM = 1001
    NOT_FOUND = 1002
    DB_ERROR = 1003
    EXTERNAL_SERVICE_ERROR = 1004
    TIMEOUT = 1005
    RATE_LIMITED = 1006
    UNAUTHORIZED = 1007
    SIGNATURE_INVALID = 1008
    CONFLICT = 1009


def error_payload(code: int, message: str, details: Optional[dict] = None) -> dict:
    return {"code": code, "message": message, "data": details or {}}

