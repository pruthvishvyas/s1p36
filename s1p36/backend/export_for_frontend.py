import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.utils.paths import ensure_dirs
from src.serving import dashboard_data as feed


if __name__ == "__main__":
    ensure_dirs()
    feed.export_all()
