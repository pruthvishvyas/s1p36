import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES


def estimate_elasticity(df):
    # log units on log price with traffic and category effects
    C = S.C
    d = df[(df[C["units"]] > 0) & (df[C["sell_price"]] > 0) & (df[C["sessions"]] > 0)]
    if len(d) < 40:
        return S.ELASTICITY_FALLBACK, "too few rows for an estimate, fallback value used"
    dummies = pd.get_dummies(d[C["category"]], drop_first=True).astype(float)
    X = np.column_stack([np.ones(len(d)), np.log(d[C["sell_price"]]), np.log(d[C["sessions"]]), dummies.values])
    y = np.log(d[C["units"]])
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    e = float(beta[1])
    if -3.0 <= e <= -0.2:
        return e, "estimated from the data"
    return S.ELASTICITY_FALLBACK, "estimate (%.2f) outside a plausible range, fallback value used" % e


def _table(xs, fn):
    return [{"x": float(x), "values": {k: float(v) for k, v in fn(x).items()}} for x in xs]


def run(df, verbose=True):
    C = S.C
    last = df[df[C["month"]] == df[C["month"]].max()]
    tot = {k: float(last[C[k]].sum()) for k in ("units", "net_rev", "cogs", "fulfil", "marketing", "contrib", "orders")}
    e, how = estimate_elasticity(df)
    outs = [{"key": "net_revenue", "label": "Net revenue", "format": "currency"},
            {"key": "contribution", "label": "Contribution profit", "format": "currency"}]
    sims = []

    def finish(sid, title, desc, var, fn, assumptions):
        xs = np.round(np.arange(var["min"], var["max"] + var["step"] / 2, var["step"]), 6)
        sim = {"id": sid, "title": title, "description": desc, "variable": var, "outputs": outs,
               "table": _table(xs, fn), "assumptions": assumptions}
        io.save_json(sim, FILES["scenario_dir"] / (sid + ".json"))
        sims.append(sid)

    def price(x):
        f = 1 + x / 100.0
        u = f ** e
        rev = tot["net_rev"] * f * u
        con = tot["contrib"] + (rev - tot["net_rev"]) - tot["cogs"] * (u - 1) - tot["fulfil"] * (u - 1)
        return {"net_revenue": rev, "contribution": con}
    finish("price_change", "Price change", "What a store-wide price change would do to the latest month, other things equal.",
           {"key": "price_pct", "label": "Price change", "unit": "%", "min": -20, "max": 20, "step": 1, "default": 0, "format": "decimal"}, price,
           ["Price elasticity of " + ("%.2f" % e) + " (" + how + ")", "Cost of goods and fulfilment move with units, marketing stays fixed",
            "Latest month totals across all categories are the starting point"])

    base_cc = float(last[C["checkout_comp"]].mean()) or 0.5
    def checkout(x):
        f = 1 + (x / 100.0) / base_cc
        rev = tot["net_rev"] * f
        con = tot["contrib"] + (rev - tot["net_rev"]) - (tot["cogs"] + tot["fulfil"]) * (f - 1)
        return {"net_revenue": rev, "contribution": con}
    finish("checkout_lift", "Checkout completion lift", "What a higher share of started checkouts completing would add in the latest month.",
           {"key": "lift_pts", "label": "Completion rate gain", "unit": "points", "min": 0, "max": 15, "step": 0.5, "default": 0, "format": "decimal"}, checkout,
           ["Current completion rate is %.0f%% on average" % (100 * base_cc), "Extra orders carry the same basket value and unit costs",
            "Traffic and started checkouts stay unchanged"])

    sd = last[C["stockout_days"]].clip(upper=S.DAYS_IN_MONTH - 1)
    per_day = last[C["net_rev"]] / (S.DAYS_IN_MONTH - sd)
    lost = float((per_day * sd).sum())
    var_cost = (tot["cogs"] + tot["fulfil"]) / (tot["net_rev"] if tot["net_rev"] else 1.0)
    def stock(x):
        rec = lost * (x / 100.0) * S.RECOVERY_FACTOR
        return {"net_revenue": tot["net_rev"] + rec, "contribution": tot["contrib"] + rec * (1 - var_cost)}
    finish("stockout_recovery", "Stockout reduction", "What fewer stockout days would recover in the latest month.",
           {"key": "reduction_pct", "label": "Stockout days removed", "unit": "%", "min": 0, "max": 100, "step": 5, "default": 0, "format": "decimal"}, stock,
           ["A month is treated as %d days" % S.DAYS_IN_MONTH, "About %.0f%% of lost demand is recovered when stock is available" % (100 * S.RECOVERY_FACTOR),
            "Variable cost share of revenue is %.0f%%" % (100 * var_cost)])
    if verbose:
        print("Price elasticity used: %.2f (%s)" % (e, how))
        print("Scenario files:", sims)
    return sims
