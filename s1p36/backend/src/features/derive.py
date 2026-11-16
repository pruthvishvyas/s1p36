import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES


def _safe(a, b):
    return a / b.replace(0, 1)


def build(df, verbose=True):
    C, F = S.C, S.F
    d = df.sort_values([C["category"], C["month"]]).reset_index(drop=True).copy()
    d[F["row_id"]] = np.arange(len(d))
    d[F["month_label"]] = d[C["month"]].dt.strftime("%b %Y")
    d[F["attain"]] = _safe(d[C["net_rev"]], d[C["rev_target"]])
    d[F["gap"]] = d[C["net_rev"]] - d[C["rev_target"]]
    d[F["cart_rate"]] = _safe(d[C["carts"]], d[C["sessions"]])
    d[F["checkout_rate"]] = _safe(d[C["checkouts"]], d[C["carts"]])
    d[F["order_rate"]] = _safe(d[C["orders"]], d[C["checkouts"]])
    d[F["aov"]] = _safe(d[C["net_rev"]], d[C["orders"]])
    d[F["units_per_order"]] = _safe(d[C["units"]], d[C["orders"]])
    d[F["rev_per_session"]] = _safe(d[C["net_rev"]], d[C["sessions"]])
    d[F["contrib_margin"]] = _safe(d[C["contrib"]], d[C["net_rev"]])
    d[F["discount_rate"]] = _safe(d[C["discounts"]], d[C["gross_sales"]])
    d[F["fulfil_share"]] = _safe(d[C["fulfil"]], d[C["net_rev"]])
    d[F["mkt_share"]] = _safe(d[C["marketing"]], d[C["net_rev"]])
    d[F["mkt_per_session"]] = _safe(d[C["marketing"]], d[C["sessions"]])
    d[F["discount_intensity"]] = d[C["promo_days"]] * d[C["discount_depth"]]
    d[F["stockout_share"]] = d[C["stockout_days"]] / S.DAYS_IN_MONTH
    d[F["price_vs_comp"]] = d[C["comp_index"]] - 1.0
    d[F["log_target"]] = np.log1p(d[C["rev_target"]].clip(lower=0))

    mom = d.groupby(C["category"])[C["net_rev"]].pct_change()
    d[F["mom"]] = mom.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    hi = d[C["discount_depth"]].quantile(0.75)   # top quarter of discount depth counts as heavy for this store
    d[F["high_discount"]] = (d[C["discount_depth"]] > hi).astype(int)
    d[F["stockout_flag"]] = (d[C["stockout_days"]] >= S.THRESHOLDS["stockout_days"]).astype(int)
    d[F["unprofitable"]] = (d[C["contrib"]] < 0).astype(int)

    # health score: weighted percentile ranks, 0 to 100, used for ranking only and never as a model target
    r = lambda s: s.rank(pct=True)
    d[F["health"]] = 100 * (0.35 * r(d[F["attain"]]) + 0.25 * r(d[F["contrib_margin"]]) + 0.20 * r(d[C["conv"]])
                            + 0.10 * (1 - r(d[C["return_rate"]])) + 0.10 * (1 - r(d[C["stockout_days"]])))

    d[F["missed"]] = (d[F["attain"]] < 1.0).astype(int)
    pos = int(d[F["missed"]].sum())
    neg = int(len(d) - pos)
    if min(pos, neg) >= 15:
        d[F["target"]] = d[F["missed"]]
        info = {"column": F["target"], "name": "missed revenue target",
                "definition": "Net revenue below the monthly revenue target for the category",
                "positive_label": "Missed target", "negative_label": "Met target"}
    else:
        med = d[F["contrib_margin"]].median()
        d[F["target"]] = (d[F["contrib_margin"]] < med).astype(int)
        info = {"column": F["target"], "name": "low contribution margin",
                "definition": "Contribution margin below the median of all category-months",
                "positive_label": "Low margin", "negative_label": "Healthy margin"}
    info["base_rate"] = float(d[F["target"]].mean())
    info["positives"] = int(d[F["target"]].sum())
    info["rows"] = int(len(d))
    io.save_json(info, FILES["target_info"])
    io.save_csv(d, FILES["feature_store"])
    if verbose:
        new = [v for k, v in F.items() if k not in ("row_id",)]
        print("Engineered features (" + str(len(new)) + "):", ", ".join(new))
        print("Target:", info["name"], "| positives:", info["positives"], "of", info["rows"])
    return d
