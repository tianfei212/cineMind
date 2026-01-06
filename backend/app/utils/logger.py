import logging
import os
import pathlib
from datetime import date

_logger = None


def get_logger() -> logging.Logger:
    global _logger
    if _logger is not None:
        return _logger
    logs_dir = pathlib.Path(__file__).resolve().parents[2] / "logs"
    os.makedirs(logs_dir, exist_ok=True)
    logfile = logs_dir / f"{date.today().isoformat()}.log"
    logger = logging.getLogger("cinemind")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(fmt)
    fh = logging.FileHandler(logfile, mode="a", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    logger.handlers = []
    logger.addHandler(ch)
    logger.addHandler(fh)
    logger.propagate = False
    _logger = logger
    return _logger

