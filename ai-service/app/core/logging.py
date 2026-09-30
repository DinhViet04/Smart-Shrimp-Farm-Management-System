import logging
import sys
import io

def setup_logging():
    # Fix UTF-8 encoding on Windows console for Vietnamese characters
    if sys.platform == "win32":
        try:
            if hasattr(sys.stdout, 'reconfigure'):
                sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            if hasattr(sys.stderr, 'reconfigure'):
                sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)

    log = logging.getLogger("ai_service")
    log.setLevel(logging.INFO)
    log.handlers.clear()
    log.addHandler(handler)
    return log

logger = setup_logging()
