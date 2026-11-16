import json, math, hashlib, datetime as dt
from decimal import Decimal
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import joblib

import config.settings as S
from src.utils.paths import FILES


def _clean(o):
    if o is pd.NaT:
        return None
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (set, frozenset)):
        return [_clean(v) for v in sorted(o, key=str)]
    if isinstance(o, np.ndarray):
        return [_clean(v) for v in o.tolist()]
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, (float, np.floating)):
        f = float(o)
        return f if math.isfinite(f) else None
    if isinstance(o, (pd.Timestamp, dt.datetime, dt.date)):
        return o.isoformat()
    if isinstance(o, pd.Period):
        return str(o)
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, Path):
        return o.name
    return o


def save_json(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(_clean(obj), fh, ensure_ascii=False, indent=2, default=str)
    return path


def read_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def read_json_ok(path):
    # returns None when the file is missing or is a skipped stand-in
    path = Path(path)
    if not path.exists():
        return None
    try:
        data = read_json(path)
    except Exception:
        return None
    if isinstance(data, dict) and data.get("status") == "skipped":
        return None
    return data


def read_table(path):
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    else:
        df = None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(path, sep=None, engine="python", encoding=enc)
                break
            except UnicodeDecodeError:
                continue
            except Exception:
                try:
                    df = pd.read_csv(path, encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
        if df is None:
            raise ValueError("Could not read " + path.name + " with the usual encodings")
    df.columns = [str(c).strip() for c in df.columns]
    df = df.loc[:, [c for c in df.columns if not c.startswith("Unnamed:")]]
    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
    return df.reset_index(drop=True)


def read_frame(path):
    df = pd.read_csv(path, encoding="utf-8")
    mc = S.C["month"]
    if mc in df.columns:
        df[mc] = pd.to_datetime(df[mc], errors="coerce")
    return df


def save_csv(df, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8")
    return path


def write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = text.replace(chr(0xfffd), "-")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path


def save_fig(fig, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=150, bbox_inches="tight", metadata={"Software": None})
    plt.close(fig)
    return path


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def save_model(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(obj, path)
    hp = FILES["hashes"]
    hashes = read_json(hp) if hp.exists() else {}
    hashes[path.name] = _sha(path)
    save_json(hashes, hp)
    return path


def load_model(path):
    path = Path(path)
    if path.parent.resolve() != FILES["model_file"].parent.resolve():
        raise ValueError("Models are only loaded from the project models folder")
    hp = FILES["hashes"]
    hashes = read_json(hp) if hp.exists() else {}
    if hashes.get(path.name) != _sha(path):
        raise ValueError("Model file " + path.name + " does not match its recorded hash")
    return joblib.load(path)


def load_required(path, producer):
    path = Path(path)
    if not path.exists() or path.stat().st_size == 0:
        raise FileNotFoundError(path.name + " is missing. Run the " + producer + " stage first.")
    return path
