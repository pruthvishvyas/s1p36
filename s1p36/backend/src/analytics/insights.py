import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES


def _fmt(x):
    return "{:,.0f}".format(x)


def run(df, verbose=True):
    C, F = S.C, S.F
    info = io.read_json(FILES["target_info"])
    pos = info["positive_label"].lower()
    items = []

    def add_insight(category, finding, evidence, action, impact=0.0):
        items.append({"category": category, "finding": finding, "evidence": evidence, "action": action, "_impact": float(impact)})

    tcol = F["target"]
    n, k = len(df), int(df[tcol].sum())
    cats = df.groupby(C["category"]).agg(rev=(C["net_rev"], "sum"), tgt=(C["rev_target"], "sum"), contrib=(C["contrib"], "sum"),
                                          risk=(tcol, "mean"), ret=(C["return_rate"], "mean"), cc=(C["checkout_comp"], "mean"))
    cats["gap"] = cats["tgt"] - cats["rev"]
    cats["margin"] = cats["contrib"] / cats["rev"].replace(0, 1)

    add_insight("Revenue Health", "%.1f%% of category-months fall in the group: %s." % (100 * k / max(n, 1), pos),
                "%d of %d category-months; total shortfall against target across all months is %s." % (k, n, _fmt(max(0, (df[C["rev_target"]] - df[C["net_rev"]]).clip(lower=0).sum()))),
                "Review the listed categories first in this week's trading meeting.", df[F["gap"]].clip(upper=0).abs().sum())
    try:
        w = cats.sort_values("gap", ascending=False).iloc[0]
        add_insight("Revenue Health", w.name + " has the largest cumulative gap to target.",
                    "Net revenue %s against target %s, a gap of %s." % (_fmt(w["rev"]), _fmt(w["tgt"]), _fmt(w["gap"])),
                    "Set a recovery plan for " + w.name + " with traffic and price actions.", max(w["gap"], 0))
    except Exception:
        pass
    try:
        hi, lo = df[df[F["high_discount"]] == 1], df[df[F["high_discount"]] == 0]
        add_insight("Pricing and Promotions", "Months with the deepest discounts are linked with a different at-risk rate.",
                    "At-risk rate %.1f%% in the top discount quarter (%d rows) against %.1f%% elsewhere (%d rows)." % (100 * hi[tcol].mean(), len(hi), 100 * lo[tcol].mean(), len(lo)),
                    "Cap discount depth for categories that sit in the top quarter.", abs(hi[tcol].mean() - lo[tcol].mean()) * 1e5)
    except Exception:
        pass
    try:
        s1, s0 = df[df[F["stockout_flag"]] == 1], df[df[F["stockout_flag"]] == 0]
        add_insight("Inventory Risk", "Category-months with repeated stockouts show a different at-risk rate.",
                    "At-risk rate %.1f%% with %d or more stockout days (%d rows) against %.1f%% otherwise (%d rows)." % (100 * s1[tcol].mean() if len(s1) else 0, S.THRESHOLDS["stockout_days"], len(s1), 100 * s0[tcol].mean(), len(s0)),
                    "Bring reorder points forward for categories that stock out twice in a quarter.", len(s1) * 1e4)
    except Exception:
        pass
    try:
        m = io.read_json_ok(FILES["model_meta"])
        if m:
            top = ", ".join(t[0] for t in m["top_features"][:3])
            add_insight("Model Output", "The risk model ranks " + top + " as its main signals.",
                        "%s, held-out AUC %.2f on %d rows; %s." % (m["model_name"], m["results"][m["model_name"]]["test_auc"], m["test_rows"],
                                                                    "better than the naive baseline" if m["beats_baseline"] else "no better than the naive baseline"),
                        "Watch these measures weekly for early warning.", 5e4 if m["beats_baseline"] else 0)
    except Exception:
        pass
    try:
        seg = io.read_frame(FILES["segments"]) if FILES["segments"].exists() else None
        if seg is not None:
            j = df.merge(seg, on=F["row_id"])
            a = j[j["is_anomaly"] == 1]
            top_cat = a[C["category"]].value_counts().index[0] if len(a) else "none"
            add_insight("Anomalies", "%d category-months behave unusually, most often in %s." % (len(a), top_cat),
                        "%.1f%% of rows flagged; at-risk rate among them %.1f%%." % (100 * len(a) / max(n, 1), 100 * a[tcol].mean() if len(a) else 0),
                        "Check the flagged months for data errors or one-off events.", len(a) * 1e3)
    except Exception:
        pass
    try:
        act = io.read_frame(FILES["business_actions"])
        last = act[act["is_latest"] == 1]
        flat = last["alerts"].str.split("|").explode()
        flat = flat[flat != "NORMAL"]
        if len(flat):
            vc = flat.value_counts()
            add_insight("Alert Pattern", "%s is the most common alert in the latest month." % vc.index[0].replace("_", " ").title(),
                        "%d of %d categories carry it." % (vc.iloc[0], len(last)), S.ACTIONS[vc.index[0]] + ".", vc.iloc[0] * 1e4)
    except Exception:
        pass
    try:
        b, w = cats.sort_values("margin").iloc[-1], cats.sort_values("margin").iloc[0]
        add_insight("Margin", "Contribution margin ranges from %.1f%% in %s to %.1f%% in %s." % (100 * w["margin"], w.name, 100 * b["margin"], b.name),
                    "Margin is contribution profit divided by net revenue over all months.", "Shift marketing budget from " + w.name + " toward " + b.name + " where traffic allows.", abs(b["margin"] - w["margin"]) * w["rev"])
    except Exception:
        pass
    try:
        q = df[F["health"]] <= df[F["health"]].quantile(0.25)
        add_insight("Performance Score", "The lowest quarter of health scores holds most of the at-risk months.",
                    "At-risk rate %.1f%% in the lowest quarter (%d rows) against %.1f%% in the rest." % (100 * df.loc[q, tcol].mean(), int(q.sum()), 100 * df.loc[~q, tcol].mean()),
                    "Use the health score to rank the weekly review list.", 2e4)
    except Exception:
        pass
    try:
        w = cats.sort_values("cc").iloc[0]
        add_insight("Funnel", w.name + " has the weakest checkout completion.", "Average completion %.1f%% against %.1f%% for the whole store." % (100 * w["cc"], 100 * df[C["checkout_comp"]].mean()),
                    "Test a shorter checkout and cart reminders for " + w.name + ".", 1e4)
    except Exception:
        pass
    try:
        w = cats.sort_values("ret").iloc[-1]
        add_insight("Returns", w.name + " has the highest average return rate.", "%.1f%% average return rate against %.1f%% store-wide." % (100 * w["ret"], 100 * df[C["return_rate"]].mean()),
                    "Review product descriptions and sizing for " + w.name + ".", 5e3)
    except Exception:
        pass

    items.sort(key=lambda d: -d["_impact"])
    for i, it in enumerate(items):
        it["severity"] = "HIGH" if i < 3 else ("MEDIUM" if i < 7 else "LOW")
        it.pop("_impact", None)
    order = ["severity", "category", "finding", "evidence", "action"]
    items = [{k_: it[k_] for k_ in order} for it in items]
    io.save_json({"items": items}, FILES["insights"])
    if verbose:
        for it in items:
            print("[" + it["severity"] + "] " + it["category"] + ": " + it["finding"])
            print("      evidence: " + it["evidence"])
    return items
