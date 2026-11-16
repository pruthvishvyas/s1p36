import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES


def _to_number(series):
    if series.dtype == object:
        cleaned = series.astype(str).str.replace(r"[^0-9.\-eE]", "", regex=True).replace("", np.nan)
        return pd.to_numeric(cleaned, errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def clean(df, verbose=True):
    C = S.C
    df = df.copy()
    raw_rows = len(df)
    log = {"raw_rows": int(raw_rows)}
    cat = C["category"]
    df[cat] = df[cat].astype(str).str.strip().str.replace(r"\s+", " ", regex=True).str.title()
    df = df[df[cat].str.len() > 0]

    # dates: fall back to year and month number when the text cannot be read
    d = pd.to_datetime(df[C["month"]], errors="coerce")
    bad = int(d.isna().sum())
    if bad and C["year"] in df.columns and C["month_num"] in df.columns:
        alt = pd.to_datetime(dict(year=pd.to_numeric(df[C["year"]], errors="coerce"),
                                  month=pd.to_numeric(df[C["month_num"]], errors="coerce"), day=1), errors="coerce")
        d = d.fillna(alt)
    log["unreadable_dates"] = bad
    df[C["month"]] = d.dt.to_period("M").dt.to_timestamp()
    df = df[df[C["month"]].notna()].copy()
    df[C["year"]] = df[C["month"]].dt.year
    df[C["month_num"]] = df[C["month"]].dt.month

    skip = {C["month"], C["category"], C["year"], C["month_num"]}
    for c in df.columns:
        if c not in skip:
            df[c] = _to_number(df[c])

    before = len(df)
    df = df.drop_duplicates(subset=[C["month"], cat], keep="first")
    log["duplicates_removed"] = int(before - len(df))

    before = len(df)
    neg = (df[C["gross_sales"]] < 0) | (df[C["units"]] < 0) | (df[C["orders"]] < 0) | (df[C["sessions"]] < 0)
    df = df[~neg]
    log["negative_rows_removed"] = int(before - len(df))

    # percent columns sometimes arrive as 0-100, the rest of the pipeline uses fractions
    scaled = []
    for k in S.PERCENT_KEYS:
        col = C[k]
        if df[col].max() > 1.5:
            df[col] = df[col] / 100.0
            scaled.append(col)
    log["percent_scaled"] = scaled

    # missing numbers: category median first, overall median second
    nums = [c for c in df.columns if c not in (C["month"], cat)]
    filled = int(df[nums].isna().sum().sum())
    for c in nums:
        df[c] = df[c].fillna(df.groupby(cat)[c].transform("median")).fillna(df[c].median())
    log["values_filled"] = filled

    # ratio columns only: money columns differ too much between categories to cap on one scale
    capped = {}
    for k in S.CAPPED_KEYS:
        col = C[k]
        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        iqr = q3 - q1
        lo, hi = q1 - 3.0 * iqr, q3 + 3.0 * iqr
        n = int(((df[col] < lo) | (df[col] > hi)).sum())
        capped[col] = n
        df[col] = df[col].clip(lo, hi)
    log["capped_values"] = capped

    df = df.sort_values([cat, C["month"]]).reset_index(drop=True)
    log["clean_rows"] = int(len(df))
    log["removed_total"] = int(raw_rows - len(df))
    io.save_csv(df, FILES["clean_data"])
    io.save_json(log, FILES["cleaning_log"])
    if verbose:
        print("Raw rows:", raw_rows, "| Clean rows:", len(df))
        print("Duplicates removed:", log["duplicates_removed"], "| Negative rows removed:", log["negative_rows_removed"])
        print("Ratio values capped:", sum(capped.values()), "| Missing values filled:", filled)
    return df
