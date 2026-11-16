import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES

DEFAULT_GOALS = {
    "revenue_target": {"value": None, "unit": "monthly", "client_sets": True},
    "alert_drop_pct": {"value": 20, "unit": "percent", "description": "Alert if revenue drops by this %"},
    "forecast_horizon": {"value": 30, "unit": "days"},
    "reorder_lead_days": {"value": 7, "unit": "days", "domain": "retail"},
}


def load_goals():
    # created once, then read and kept: client-set values are never overwritten
    p = FILES["goals"]
    if p.exists():
        try:
            return io.read_json(p)
        except Exception:
            pass
    io.save_json(DEFAULT_GOALS, p)
    return dict(DEFAULT_GOALS)


def run(df, verbose=True):
    C = S.C
    goals = load_goals()
    months = sorted(df[C["month"]].unique())
    last = months[-1]
    cur = df[df[C["month"]] == last]
    actual = float(cur[C["net_rev"]].sum())
    target = goals["revenue_target"]["value"]
    source = "client goal"
    if target in (None, 0):
        target = float(cur[C["rev_target"]].sum())
        source = "monthly target column in the data"
    pct = 100.0 * actual / (target if target else 1.0)
    status = "on_track" if pct >= 100 else ("at_risk" if pct >= 90 else "off_track")
    progress = [{"key": "revenue_target", "label": "Net revenue vs target (" + source + ")", "target": target,
                 "actual": actual, "unit": "currency", "pct": pct, "status": status}]
    drop_limit = float(goals["alert_drop_pct"]["value"])
    change = None
    if len(months) >= 2:
        prev = float(df[df[C["month"]] == months[-2]][C["net_rev"]].sum())
        change = 100.0 * (actual - prev) / (prev if prev else 1.0)
        used = max(0.0, -change)
        st = "on_track" if used < drop_limit * 0.5 else ("at_risk" if used < drop_limit else "off_track")
        progress.append({"key": "alert_drop_pct", "label": "Month-on-month revenue change (alert at -" + str(drop_limit) + "%)",
                         "target": -drop_limit, "actual": change, "unit": "percent",
                         "pct": 100.0 * max(0.0, 1 - used / (drop_limit if drop_limit else 1.0)), "status": st})
    io.save_json({"items": progress}, FILES["goal_progress"])

    alerts = []
    since = pd.Timestamp(last).strftime("%Y-%m")
    if change is not None and change <= -drop_limit:
        alerts.append({"severity": "HIGH", "title": "Revenue drop", "message": "Total net revenue fell more than the alert limit versus the previous month.",
                       "metric": "Net revenue change (%)", "value": change, "threshold": -drop_limit, "since": since})
    short = cur[cur[S.F["attain"]] < S.THRESHOLDS["attainment_low"]]
    if len(short):
        worst = short.sort_values(S.F["attain"]).iloc[0]
        alerts.append({"severity": "HIGH" if len(short) >= 3 else "MEDIUM", "title": str(len(short)) + " categories below " + str(int(S.THRESHOLDS["attainment_low"] * 100)) + "% of target",
                       "message": "Furthest behind: " + str(worst[C["category"]]) + ".", "metric": "Target attainment",
                       "value": float(worst[S.F["attain"]] * 100), "threshold": S.THRESHOLDS["attainment_low"] * 100, "since": since})
    loss = cur[cur[C["contrib"]] < 0]
    if len(loss):
        alerts.append({"severity": "HIGH", "title": str(len(loss)) + " categories lost money after marketing and fulfilment",
                       "message": "Negative contribution profit in the latest month.", "metric": "Contribution profit",
                       "value": float(loss[C["contrib"]].sum()), "threshold": 0, "since": since})
    stock = cur[cur[C["stockout_days"]] >= S.THRESHOLDS["stockout_days"]]
    if len(stock):
        alerts.append({"severity": "MEDIUM", "title": str(len(stock)) + " categories with repeated stockouts",
                       "message": "Stockout days at or above the limit in the latest month.", "metric": "Stockout days",
                       "value": float(stock[C["stockout_days"]].max()), "threshold": S.THRESHOLDS["stockout_days"], "since": since})
    io.save_json({"items": alerts}, FILES["alerts"])
    if verbose:
        print("Goal progress:", [(p["key"], round(p["pct"], 1), p["status"]) for p in progress])
        print("Alerts raised:", len(alerts))
    return progress, alerts
