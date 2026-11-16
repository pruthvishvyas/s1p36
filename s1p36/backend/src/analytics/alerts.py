import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, chart_path
from src.analytics import targets as goals_mod

T = S.THRESHOLDS


def assign_alert(row, drop_limit, med_conv):
    C, F = S.C, S.F
    hits = []
    if row[C["contrib"]] < 0:
        hits.append("UNPROFITABLE")
    if row[F["mom"]] <= -drop_limit / 100.0:
        hits.append("REVENUE_DROP")
    if row[F["attain"]] < T["attainment_low"]:
        hits.append("BELOW_TARGET")
    if 0 <= row[F["contrib_margin"]] < T["thin_margin"]:
        hits.append("THIN_MARGIN")
    if row[C["discount_depth"]] > T["heavy_discount"]:
        hits.append("HEAVY_DISCOUNT")
    if row[C["stockout_days"]] >= T["stockout_days"]:
        hits.append("STOCKOUT")
    if row[C["return_rate"]] > T["high_returns"]:
        hits.append("HIGH_RETURNS")
    if row[C["comp_index"]] > T["price_above_market"]:
        hits.append("PRICE_ABOVE_MARKET")
    if row[C["checkout_comp"]] < T["weak_checkout"]:
        hits.append("WEAK_CHECKOUT")
    if row[C["conv"]] < T["weak_conversion_ratio"] * med_conv:
        hits.append("WEAK_CONVERSION")
    return "|".join(hits) if hits else "NORMAL"


def priority_level(alerts):
    score = 0 if alerts == "NORMAL" else sum(S.ALERT_WEIGHTS[a] for a in alerts.split("|"))
    for label, cut in S.PRIORITY_CUTS:
        if score >= cut:
            return label
    return "P4_ROUTINE"


def recommend(row_alerts):
    if row_alerts == "NORMAL":
        return "Keep current plan"
    return "; ".join(S.ACTIONS[a] for a in row_alerts.split("|"))


def run(df, verbose=True):
    C, F = S.C, S.F
    drop_limit = float(goals_mod.load_goals()["alert_drop_pct"]["value"])
    med_conv = df.groupby(C["category"])[C["conv"]].transform("median")
    alerts = [assign_alert(r, drop_limit, m) for (_, r), m in zip(df.iterrows(), med_conv)]
    out = pd.DataFrame({F["row_id"]: df[F["row_id"]].values, "alerts": alerts})
    out["priority"] = out["alerts"].map(priority_level)
    out["recommendations"] = out["alerts"].map(recommend)
    out["is_latest"] = (df[C["month"]] == df[C["month"]].max()).astype(int).values
    io.save_csv(out, FILES["business_actions"])
    order = [p for p, _ in S.PRIORITY_CUTS]
    counts = out["priority"].value_counts().reindex(order).fillna(0).astype(int)
    rate = df[F["target"]].groupby(out["priority"].values).mean().reindex(order)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar(order, counts.values, color=["#d62828", "#f77f00", "#fcbf49", "#2a9d8f"])
    for i, v in enumerate(counts.values):
        ax.text(i, v, str(v), ha="center", va="bottom")
    ax.set_title("Category-months by priority"); fig.tight_layout(); io.save_fig(fig, chart_path("priority"))
    if verbose:
        print("Priority counts:", counts.to_dict())
        print("At-risk rate by priority (%):", {k: (None if pd.isna(v) else round(100 * v, 1)) for k, v in rate.items()})
    return out
