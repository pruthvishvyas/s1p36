import re, hashlib
import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, RAW_DIR
from src.utils.columns import resolve_columns

PII_HEADER = re.compile(r"(e-?mail|phone|mobile|ssn|dob|birth|address|first_?name|last_?name|full_?name|customer_?name|ip_?addr)", re.I)
PII_EMAIL = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.]+$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def find_raw_file():
    files = sorted(p for p in RAW_DIR.glob("*") if p.suffix.lower() in (".csv", ".xlsx", ".xls"))
    if not files:
        raise FileNotFoundError("No data file found in data/raw")
    return files[0]


def detect_pii(df):
    found = []
    for c in df.columns:
        if PII_HEADER.search(str(c)):
            found.append(c)
            continue
        if df[c].dtype == object:
            sample = df[c].dropna().astype(str).head(200)
            if len(sample) and sample.map(lambda v: bool(PII_EMAIL.match(v))).mean() > 0.3:
                found.append(c)
    return found


def load_raw(verbose=True):
    path = find_raw_file()
    df = io.read_table(path)
    df, col_report = resolve_columns(df, verbose=verbose)
    pii = detect_pii(df)
    for c in pii:
        df[c] = df[c].astype(str).map(lambda v: hashlib.sha256(v.encode("utf-8")).hexdigest()[:10])
    C = S.C
    nulls = {c: int(n) for c, n in df.isna().sum().items() if n > 0}
    rules = {}
    for key in ("gross_sales", "net_rev", "units", "orders", "sessions"):
        rules["negative_" + key] = int((pd.to_numeric(df[C[key]], errors="coerce") < 0).sum())
    rules["orders_exceed_sessions"] = int((pd.to_numeric(df[C["orders"]], errors="coerce") > pd.to_numeric(df[C["sessions"]], errors="coerce")).sum())
    rules["checkouts_exceed_carts"] = int((pd.to_numeric(df[C["checkouts"]], errors="coerce") > pd.to_numeric(df[C["carts"]], errors="coerce")).sum())
    parsed = pd.to_datetime(df[C["month"]], errors="coerce")
    rules["unreadable_dates"] = int(parsed.isna().sum())
    tgt = pd.to_numeric(df[C["net_rev"]], errors="coerce") < pd.to_numeric(df[C["rev_target"]], errors="coerce")
    report = {
        "file": path.name, "rows": int(len(df)), "cols": int(df.shape[1]), "nulls": nulls,
        "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "category_counts": {str(k): int(v) for k, v in df[C["category"]].value_counts().items()},
        "target_balance": {"below_target": int(tgt.sum()), "met_target": int((~tgt).sum())},
        "domain_checks": rules, "pii_columns_hashed": pii, "column_notes": col_report,
        "schema_ok": True,
    }
    io.save_json(report, FILES["validation_report"])
    if verbose:
        print("Rows:", report["rows"], "| Columns:", report["cols"], "| File:", path.name)
        print("Columns with nulls:", nulls if nulls else "none")
        print("Category counts:", report["category_counts"])
        print("Domain checks:", rules)
        print("Personal data columns hashed:", pii if pii else "none found")
    return df
