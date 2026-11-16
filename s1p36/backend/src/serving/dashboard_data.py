import os, datetime as dt
import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, OUTPUT_DIR, PROJECT_ROOT

C, F = S.C, S.F
TABS = {"understand": "understand", "decide": "decide", "monitor": "monitor"}
CHART_TAB = {"target_balance": "understand", "attainment_by_category": "understand", "discount_distribution": "understand",
             "correlation": "understand", "outcome_rate_by_category": "decide", "health_score_distribution": "decide",
             "sessions_vs_revenue": "decide", "outcome_heatmap": "monitor", "monthly_trend": "monitor",
             "priority_breakdown": "decide", "anomaly_rate_by_category": "understand", "top_feature_importance": "understand",
             "segment_sizes": "understand"}
WRITTEN = []


def rnd(x, n=4):
    try:
        x = float(x)
    except Exception:
        return None
    return round(x, n) if np.isfinite(x) else None


def put(rel, obj):
    p = OUTPUT_DIR / rel
    io.save_json(obj, p)
    WRITTEN.append(rel)


def skipped(rel, reason):
    put(rel, {"status": "skipped", "reason": reason})


# ---------------------------------------------------------------- data source
def _bigquery_available():
    b = S.BIGQUERY
    if not (b["project_id"] and b["dataset"]):
        return False
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return True
    return (PROJECT_ROOT / b["credentials_file"]).exists()


def _load_from_bigquery(cfg):
    from google.cloud import bigquery
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(PROJECT_ROOT / cfg["credentials_file"])
    client = bigquery.Client(project=cfg["project_id"])
    df = client.query("SELECT * FROM `%s.%s.%s`" % (cfg["project_id"], cfg["dataset"], cfg["table"])).to_dataframe()
    df[C["month"]] = pd.to_datetime(df[C["month"]], errors="coerce")
    print("Source: BigQuery")
    return df


def _load_from_csv(cfg):
    print("Source: CSV")
    return io.read_frame(io.load_required(FILES["feature_store"], "feature building"))


def _load_data(config):
    # the only function that reads data
    if _bigquery_available():
        try:
            return _load_from_bigquery(config), "bigquery"
        except Exception as exc:
            print("BigQuery failed, using CSV instead:", exc)
    return _load_from_csv(config), "csv"


# ---------------------------------------------------------------- helpers
def _period_sum(df, key, months, k):
    sel = df[df[C["month"]].isin(months)]
    return float(sel[C[key]].sum())


def _kpis(df):
    months = sorted(df[C["month"]].unique())
    k = 3 if len(months) >= 6 else 1
    cur_m, prev_m = months[-k:], months[-2 * k:-k] if len(months) >= 2 * k else []
    def agg(ms):
        sel = df[df[C["month"]].isin(ms)]
        sess, orders = sel[C["sessions"]].sum(), sel[C["orders"]].sum()
        rev = sel[C["net_rev"]].sum()
        return {"rev": rev, "contrib": sel[C["contrib"]].sum(), "orders": orders, "sessions": sess,
                "margin": 100 * sel[C["contrib"]].sum() / (rev if rev > 0 else 1),
                "conv": 100 * orders / (sess if sess > 0 else 1), "aov": rev / (orders if orders > 0 else 1),
                "attain": 100 * rev / (sel[C["rev_target"]].sum() or 1),
                "returns": 100 * sel[C["returns"]].sum() / (sel[C["gross_sales"]].sum() or 1)}
    a = agg(cur_m)
    b = agg(prev_m) if prev_m else None
    def tr(key):
        if not b or not b[key]:
            return None
        return rnd(100 * (a[key] - b[key]) / abs(b[key]), 2)
    note = "Latest %d month(s)%s" % (k, " versus the previous %d" % k if b else "")
    spec = [("net_revenue", "Net revenue", "rev", "currency"), ("contribution", "Contribution profit", "contrib", "currency"),
            ("margin", "Contribution margin", "margin", "percent"), ("orders", "Orders", "orders", "integer"),
            ("conversion", "Conversion rate", "conv", "percent"), ("aov", "Average order value", "aov", "currency"),
            ("attainment", "Revenue vs target", "attain", "percent"), ("returns", "Return rate on gross sales", "returns", "percent")]
    items = [{"key": k_, "label": l, "value": rnd(a[v], 2), "format": f, "trend": tr(v), "note": note} for k_, l, v, f in spec]
    items.append({"key": "at_risk_share", "label": "Category-months at risk", "value": rnd(100 * df[F["target"]].mean(), 2),
                  "format": "percent", "trend": None, "note": "Share of all category-months in the at-risk group"})
    return items


def _merge(df):
    out = df.copy()
    for key in ("segments", "business_actions", "model_predictions"):
        p = FILES[key]
        if p.exists():
            try:
                out = out.merge(pd.read_csv(p), on=F["row_id"], how="left")
            except Exception:
                pass
    return out


def _charts(df, m):
    specs = []
    sp = io.read_json_ok(FILES["chart_specs"])
    if sp:
        specs += sp["items"]
    if "priority" in m.columns:
        vc = m["priority"].value_counts()
        specs.append({"id": "priority_breakdown", "title": "Category-months by priority", "type": "bar", "question": "How much needs attention now?",
                      "x_label": "Priority", "y_label": "Category-months", "data": [{"label": str(i), "value": int(v)} for i, v in vc.items()]})
    if "is_anomaly" in m.columns:
        r = m.groupby(C["category"])["is_anomaly"].mean() * 100
        specs.append({"id": "anomaly_rate_by_category", "title": "Unusual months by category", "type": "bar", "question": "Where do unusual months cluster?",
                      "x_label": "Category", "y_label": "% unusual", "data": [{"label": i, "value": rnd(v, 2)} for i, v in r.sort_values().items()]})
    meta = io.read_json_ok(FILES["model_meta"])
    if meta:
        specs.append({"id": "top_feature_importance", "title": "Top drivers of the at-risk outcome", "type": "bar", "question": "Which measures matter most to the risk model?",
                      "x_label": "Measure", "y_label": "Importance", "data": [{"label": a, "value": rnd(b, 4)} for a, b in meta["top_features"][:10]]})
    if "segment" in m.columns:
        vc = m["segment"].value_counts()
        specs.append({"id": "segment_sizes", "title": "Segment sizes", "type": "bar", "question": "How are category-months split by performance?",
                      "x_label": "Segment", "y_label": "Category-months", "data": [{"label": str(i), "value": int(v)} for i, v in vc.items()]})
    return specs


def _explorer(m):
    n = len(m)
    cand = {}
    for key, col, label in (("category", C["category"], "Category"), ("segment", "segment", "Segment"), ("priority", "priority", "Priority")):
        if col in m.columns:
            cand[key] = (col, label)
    m = m.copy()
    m["_status"] = np.where(m[F["target"]] == 1, "At risk", "On track")
    cand["status"] = ("_status", "Outcome")
    ranked = []
    y = m[C["net_rev"]]
    for key, (col, label) in cand.items():
        vc = m[col].astype(str).value_counts()
        if not 2 <= len(vc) <= 20:
            continue
        grp = m.groupby(col)[C["net_rev"]]
        eta = float(((grp.mean() - y.mean()) ** 2 * grp.size()).sum() / (((y - y.mean()) ** 2).sum() or 1))
        ranked.append((eta, key, col, label))
    ranked = sorted(ranked, reverse=True)[:4]
    if not ranked:
        return None
    dims = []
    for _, key, col, label in ranked:
        vc = m[col].astype(str).value_counts()
        small = set(vc[vc < 5].index)
        m[col + "_x"] = m[col].astype(str).map(lambda v: "Other" if v in small else v)
        dims.append({"key": key, "label": label, "col": col + "_x"})
    m["_n"] = 1
    base = [("net_revenue", "Net revenue", "sum", "currency", C["net_rev"]), ("contribution", "Contribution profit", "sum", "currency", C["contrib"]),
            ("orders", "Orders", "sum", "integer", C["orders"]), ("sessions", "Sessions", "sum", "integer", C["sessions"]),
            ("units", "Units sold", "sum", "integer", C["units"]), ("at_risk", "At-risk rate", "rate", "percent", F["target"])]
    metrics = [{"key": k, "label": l, "agg": a, "format": f} for k, l, a, f, _ in base]
    metrics += [{"key": "margin_pct", "label": "Contribution margin", "agg": "ratio", "format": "percent", "num": "contribution", "den": "net_revenue"},
                {"key": "conversion_pct", "label": "Conversion rate", "agg": "ratio", "format": "percent", "num": "orders", "den": "sessions"},
                {"key": "aov", "label": "Average order value", "agg": "ratio", "format": "currency", "num": "net_revenue", "den": "orders"}]
    m["_t"] = m[C["month"]].dt.strftime("%Y-%m")
    while True:
        keys = [d["col"] for d in dims] + ["_t"]
        rows = []
        for gk, g in m.groupby(keys):
            gk = gk if isinstance(gk, tuple) else (gk,)
            cell = {"d": {d["key"]: str(gk[i]) for i, d in enumerate(dims)}, "t": str(gk[-1]), "m": {}}
            for k, _, a, _, col in base:
                cell["m"][k] = {"sum": rnd(g[col].sum(), 2), "n": int(len(g))}
            rows.append(cell)
        size = len(str(rows))
        if (len(rows) <= 20000 and size < 4_000_000) or len(dims) <= 1:
            break
        dims = dims[:-1]
    return {"dimensions": [{"key": d["key"], "label": d["label"], "values": sorted(m[d["col"]].astype(str).unique().tolist())} for d in dims],
            "metrics": metrics, "time": {"grain": "month", "min": str(m["_t"].min()), "max": str(m["_t"].max())}, "rows": rows}


def _scorer(df):
    # builds the prediction form data from the saved model and the cleaned frame
    from sklearn.metrics import mean_absolute_error
    meta = io.read_json_ok(FILES["model_meta"])
    if not meta:
        return None, "the risk model did not run"
    if not meta["beats_baseline"]:
        return None, "the risk model did not beat the naive baseline"
    imp = meta["importance_by_field"]
    raw = {S.C[k]: k for k in S.EXPOSABLE}
    fields_sel = sorted([c for c in imp if c in raw], key=lambda c: -imp[c])[:8]
    if len(fields_sel) < 2:
        return None, "fewer than two usable input fields"
    model = io.load_model(FILES["model_file"])
    pred = io.read_frame(FILES["model_predictions"])
    d = df.merge(pred[[F["row_id"], "split"]], on=F["row_id"], how="left")
    fields = []
    typical = {}
    for c in fields_sel:
        if c == C["category"]:
            vc = d[c].value_counts()
            typical[c] = vc.index[0]
            fields.append({"key": c, "label": "Category", "type": "category", "unit": "", "min": 0, "max": 0, "step": 1,
                           "default": typical[c], "options": sorted(vc.index.tolist()), "help": "Product category"})
        else:
            lo, hi = float(d[c].quantile(0.01)), float(d[c].quantile(0.99))
            typical[c] = float(d[c].median())
            span = hi - lo if hi > lo else 1.0
            step = 10 ** np.floor(np.log10(span / 50.0)) if span > 0 else 1
            step = max(float(step), 0.001)
            fields.append({"key": c, "label": c.replace("_", " "), "type": "number", "unit": "", "min": rnd(lo, 4), "max": rnd(hi, 4),
                           "step": rnd(step, 4), "default": rnd(typical[c], 4), "options": [], "help": "Typical value is the median"})
    num_f = [f for f in fields if f["type"] == "number"]
    cat_f = [f for f in fields if f["type"] == "category"]
    est = model.named_steps["clf"]
    feats = meta["feature_cols"]
    held = d[d["split"] == "test"]
    held = held if len(held) else d
    pts = model.predict_proba(d[feats])[:, 1] * 100
    q1, q2 = float(np.percentile(pts, 33)), float(np.percentile(pts, 66))
    risk_levels = [{"max": rnd(q1, 1), "label": "Low"}, {"max": rnd(q2, 1), "label": "Medium"}, {"max": 100, "label": "High"}]
    target = {"label": meta["target"], "format": "percent", "positive_label": meta["positive_label"]}
    base = {"task": "classification", "target": target, "fields": fields, "risk_levels": risk_levels}
    keys = [f["key"] for f in fields]
    if meta["algorithm"] == "LogisticRegression":
        typ_row = d[feats].median(numeric_only=True).to_dict()
        for c in meta["categorical"]:
            typ_row[c] = d[c].value_counts().index[0]
        for c in keys:
            typ_row[c] = typical[c]
        row = pd.DataFrame([typ_row])[feats]
        pre = model.named_steps["pre"]
        names = list(pre.get_feature_names_out())
        coefs = dict(zip(names, np.asarray(est.coef_)[0]))
        sc = pre.named_transformers_["num"].named_steps["sc"]
        numcols = meta["numeric"]
        terms, intercept = [], float(model.decision_function(row)[0])
        for f in num_f:
            i = numcols.index(f["key"])
            mean, scale, coef = float(sc.mean_[i]), float(sc.scale_[i] or 1.0), float(coefs["num__" + f["key"]])
            intercept -= ((typical[f["key"]] - mean) / scale) * coef
            terms.append({"field": f["key"], "mean": mean, "scale": scale, "coef": coef})
        for f in cat_f:
            base_c = coefs.get("cat__" + f["key"] + "_" + str(typical[f["key"]]), 0.0)
            for o in f["options"]:
                if o != typical[f["key"]]:
                    terms.append({"field": f["key"], "value": o, "coef": float(coefs.get("cat__" + f["key"] + "_" + str(o), 0.0)) - base_c})
        def lin(vals):
            z = intercept
            for t in terms:
                if "value" in t:
                    z += t["coef"] if vals[t["field"]] == t["value"] else 0.0
                else:
                    z += ((vals[t["field"]] - t["mean"]) / t["scale"]) * t["coef"]
            return 100.0 / (1.0 + np.exp(-z))
        approx = np.array([lin({k: r[k] for k in keys}) for _, r in held.iterrows()])
        scorer = dict(base, type="linear", linear={"intercept": intercept, "link": "logit", "terms": terms})
    else:
        ref = d.sample(min(1500, len(d)), random_state=S.RANDOM_STATE)
        yref = model.predict_proba(ref[feats])[:, 1] * 100
        std = {f["key"]: rnd(max(float(d[f["key"]].std()), 1e-6), 6) for f in num_f}
        k = int(min(25, max(3, len(ref) - 1)))
        reference = [{"x": {c: (r[c] if c == C["category"] else rnd(r[c], 4)) for c in keys}, "y": rnd(y, 3)} for (_, r), y in zip(ref.iterrows(), yref)]
        def knn(vals, skip=None):
            dist = []
            for i, rr in enumerate(reference):
                if skip is not None and i == skip:
                    dist.append(1e9)
                    continue
                s = 0.0
                for c in keys:
                    s += (0.0 if rr["x"][c] == vals[c] else 1.0) if c in [f["key"] for f in cat_f] else ((vals[c] - rr["x"][c]) / std[c]) ** 2
                dist.append(np.sqrt(s))
            idx = np.argsort(dist)[:k]
            w = 1.0 / (np.array(dist)[idx] + 1e-6)
            return float(np.sum(w * np.array([reference[i]["y"] for i in idx])) / np.sum(w))
        pos = {int(rid): i for i, rid in enumerate(ref[F["row_id"]].values)}
        approx = np.array([knn({c: r[c] for c in keys}, skip=pos.get(int(r[F["row_id"]]))) for _, r in held.iterrows()])
        scorer = dict(base, type="knn", knn={"k": k, "std": std, "reference": reference})
    real = model.predict_proba(held[feats])[:, 1] * 100
    mae = float(mean_absolute_error(real, approx))
    from scipy.stats import spearmanr
    rho = float(spearmanr(real, approx)[0]) if len(real) > 2 else float("nan")
    quality = "good" if mae < 5 else ("fair" if mae < 10 else "low")
    scorer["fidelity"] = {"metric": "mean absolute error in percentage points", "value": rnd(mae, 2), "n": int(len(held)), "quality": quality,
                          "note": "Rank correlation with the full model: %s" % rnd(rho, 3)}
    scorer["note"] = "Fields not shown use typical values."
    return scorer, ""


def _recommendations(df, m):
    if "recommendations" not in m.columns:
        return None
    last = m[m["is_latest"] == 1]
    rank = {p: i for i, (p, _) in enumerate(S.PRIORITY_CUTS)}
    when = {"P1_URGENT": "This week", "P2_HIGH": "Within two weeks", "P3_MEDIUM": "This month", "P4_ROUTINE": "Next review"}
    acts = {}
    for _, r in last.iterrows():
        if r["recommendations"] == "Keep current plan":
            continue
        for a in str(r["recommendations"]).split("; "):
            acts.setdefault(a, []).append(r)
    items = []
    total = float(last[C["net_rev"]].sum()) or 1.0
    for a, rows in acts.items():
        g = pd.DataFrame(rows)
        pr = sorted(g["priority"].tolist(), key=lambda p: rank[p])[0]
        share = 100 * float(g[C["net_rev"]].sum()) / total
        gap = float((g[C["rev_target"]] - g[C["net_rev"]]).clip(lower=0).sum())
        items.append({"priority": pr, "title": a, "action": a, "evidence": "Applies to: " + ", ".join(g[C["category"]].head(6).tolist()) + (" and others" if len(g) > 6 else ""),
                      "impact": "Covers %.1f%% of latest-month net revenue; combined gap to target %s" % (share, "{:,.0f}".format(gap)), "when": when[pr], "count": int(len(g))})
    items.sort(key=lambda d: (rank[d["priority"]], -d["count"]))
    return items


def _validate():
    probs = []
    need = {"understand/kpis.json": ("items",), "understand/charts.json": ("items",), "decide/insights.json": ("items",),
            "decide/recommendations.json": ("items",), "monitor/alerts.json": ("items",), "monitor/goal_progress.json": ("items",)}
    print("")
    print("File".ljust(40) + "Check")
    for rel in sorted(set(WRITTEN)):
        p = OUTPUT_DIR / rel
        ok, why = True, "ok"
        try:
            d = io.read_json(p)
            if isinstance(d, list):
                ok, why = False, "bare list at top level"
            elif d.get("status") != "skipped" and rel in need and not all(k in d and isinstance(d[k], list) for k in need[rel]):
                ok, why = False, "missing items list"
        except Exception as exc:
            ok, why = False, str(exc)
        if not ok:
            io.save_json({"status": "skipped", "reason": "file failed shape check: " + why}, p)
            probs.append(rel)
        print(rel.ljust(40) + why)
    return probs


def export_all():
    cfg = S.BIGQUERY
    df, src = _load_data(cfg)
    if C["month"] in df.columns:
        df[C["month"]] = pd.to_datetime(df[C["month"]], errors="coerce")
    m = _merge(df)
    info = io.read_json_ok(FILES["target_info"]) or {}
    last_run = dt.datetime.now().isoformat(timespec="seconds")
    months = df[C["month"]].dropna()
    cur = S.CURRENCY if S.CURRENCY.get("code") else {"code": None, "symbol": ""}
    summary = {"schema_version": "1", "project": S.PROJECT_NAME, "domain": S.DOMAIN, "client_id": S.PROJECT_SLUG, "description": S.DESCRIPTION,
               "last_run": last_run, "rows": int(len(df)), "date_range": {"start": months.min().strftime("%Y-%m-%d"), "end": months.max().strftime("%Y-%m-%d")},
               "currency": cur, "locale": S.LOCALE, "source": src}
    put("meta/summary.json", summary)
    put("meta/terminology.json", S.TERMINOLOGY)
    mm = io.read_json_ok(FILES["model_meta"])
    put("meta/model_meta.json", {"model_name": mm["model_name"] if mm else None, "algorithm": mm["algorithm"] if mm else None,
                                 "feature_count": mm["feature_count"] if mm else 0, "feature_cols": mm["feature_cols"] if mm else [], "models_ready": bool(mm)})
    if not FILES["run_log"].exists():
        io.save_json({"runs": []}, FILES["run_log"])
    WRITTEN.append("meta/run_log.json")

    put("understand/kpis.json", {"items": _kpis(df)})
    specs = _charts(df, m)
    for s_ in specs:
        s_["outcome"] = CHART_TAB.get(s_["id"], "understand")
        put("understand/charts/" + s_["id"] + ".json", s_)
    put("understand/charts.json", {"items": specs})
    if "segment" in m.columns:
        items = []
        for nme, g in m.groupby("segment"):
            items.append({"name": nme, "size": int(len(g)), "share": rnd(100 * len(g) / len(m), 2),
                          "description": "Category-months grouped by traffic, funnel, pricing, returns, order value, margin and health score.",
                          "summary": {"Average net revenue": rnd(g[C["net_rev"]].mean(), 2), "Average health score": rnd(g[F["health"]].mean(), 2),
                                      "Contribution margin (%)": rnd(100 * g[C["contrib"]].sum() / (g[C["net_rev"]].sum() or 1), 2),
                                      "At-risk rate (%)": rnd(100 * g[F["target"]].mean(), 2)}})
        put("understand/segments.json", {"method": "KMeans with three clusters on standardised performance measures", "items": items})
        a = m[m["is_anomaly"] == 1].sort_values("anomaly_score", ascending=False)
        ai = [{"id": str(r[C["category"]]) + " " + str(r[F["month_label"]]), "date": r[C["month"]].strftime("%Y-%m-%d"), "metric": r["anomaly_metric"],
               "value": rnd(r["anomaly_value"], 4), "expected": rnd(r["anomaly_expected"], 4), "score": rnd(r["anomaly_score"], 4), "reason": r["anomaly_reason"]}
              for _, r in a.head(500).iterrows()]
        put("understand/anomalies.json", {"method": "Isolation Forest on standardised performance measures", "total": int(len(a)),
                                          "rate": rnd(100 * len(a) / max(len(m), 1), 2), "items": ai})
    else:
        skipped("understand/segments.json", "segmentation did not run")
        skipped("understand/anomalies.json", "segmentation did not run")
    cube = _explorer(m)
    if cube:
        put("understand/explorer.json", cube)
    else:
        skipped("understand/explorer.json", "no usable dimension for the explorer")

    ins = io.read_json_ok(FILES["insights"])
    if ins:
        put("decide/insights.json", {"items": [dict(i, outcome=TABS["decide"].upper()) for i in ins["items"]]})
    else:
        skipped("decide/insights.json", "insights did not run")
    rec = _recommendations(df, m)
    if rec is not None:
        put("decide/recommendations.json", {"items": rec})
    else:
        skipped("decide/recommendations.json", "business rules did not run")
    g = io.read_json_ok(FILES["goals"])
    if g:
        put("decide/goals.json", g)
    else:
        skipped("decide/goals.json", "goals file missing")
    idx = []
    for sid in S.SCENARIO_IDS:
        p = FILES["scenario_dir"] / (sid + ".json")
        sim = io.read_json_ok(p)
        if sim:
            put("decide/simulations/" + sid + ".json", sim)
            idx.append({"id": sid, "title": sim["title"], "file": "decide/simulations/" + sid + ".json"})
    if idx:
        put("decide/simulations/index.json", {"items": idx})
    else:
        skipped("decide/simulations/index.json", "scenarios did not run")

    fm = io.read_json_ok(FILES["forecast_meta"])
    lookup = None
    if fm and FILES["forecast_output"].exists():
        fo = pd.read_csv(FILES["forecast_output"], parse_dates=["month"])
        hist = df.groupby(C["month"])[C["net_rev"]].sum()
        nxt = fo[fo["kind"] == "forecast"]
        put("monitor/forecast.json", {"metric": "Net revenue", "unit": "currency", "horizon": fm["horizon"], "method": fm["method"],
                                      "history": [{"t": i.strftime("%Y-%m"), "value": rnd(v, 2)} for i, v in hist.items()],
                                      "forecast": [{"t": fm["next_month"], "value": rnd(fm["total_forecast"], 2), "low": rnd(fm["total_low"], 2), "high": rnd(fm["total_high"], 2)}],
                                      "error": {"mae": rnd(fm["mae"], 2), "mape": rnd(fm["mape"], 2), "baseline_mae": rnd(fm["baseline_mae"], 2),
                                                "period": fm["holdout_months"][0] + " to " + fm["holdout_months"][-1]},
                                      "note": "Error is per category-month on held-out months. " + ("The model beat the last-value baseline. " if fm["beats_baseline"] else "The model did not beat the last-value baseline, so the last value is used. ") +
                                              ("Low sample: under two full seasonal cycles of history." if fm["low_sample"] else "")})
    else:
        skipped("monitor/forecast.json", "forecast did not run")
    try:
        scorer, why = _scorer(df)
    except Exception as exc:
        scorer, why = None, "scorer could not be built: " + str(exc)
    scorer_ok = scorer is not None
    if scorer_ok:
        put("monitor/scorer.json", scorer)
    else:
        skipped("monitor/scorer.json", why)
    gp = io.read_json_ok(FILES["goal_progress"])
    put("monitor/goal_progress.json", gp) if gp else skipped("monitor/goal_progress.json", "goal tracking did not run")
    al = io.read_json_ok(FILES["alerts"])
    put("monitor/alerts.json", al) if al else skipped("monitor/alerts.json", "alerts did not run")

    def rel(path):
        return path if (OUTPUT_DIR / path).exists() and not (io.read_json_ok(OUTPUT_DIR / path) is None) else None
    contract = {
        "schema_version": "1", "generated_at": last_run,
        "project": {"name": S.PROJECT_NAME, "domain": S.DOMAIN, "client_id": S.PROJECT_SLUG, "description": S.DESCRIPTION},
        "terminology": S.TERMINOLOGY,
        "source": ({"type": "bigquery", "project_id": cfg["project_id"], "dataset": cfg["dataset"], "table": cfg["table"], "credentials_file": cfg["credentials_file"]}
                   if src == "bigquery" else {"type": "csv", "file": "data/processed/feature_store.csv"}),
        "outcomes": {
            "understand": {k: rel("understand/" + k + ".json") for k in ("kpis", "charts", "segments", "anomalies", "explorer")},
            "decide": {"insights": rel("decide/insights.json"), "recommendations": rel("decide/recommendations.json"),
                       "simulations": rel("decide/simulations/index.json"), "goals": rel("decide/goals.json")},
            "monitor": {"forecast": rel("monitor/forecast.json"), "forecast_lookup": None, "scorer": rel("monitor/scorer.json") if scorer_ok else None,
                        "goal_progress": rel("monitor/goal_progress.json"), "alerts": rel("monitor/alerts.json")}},
        "model": {"type": mm["model_name"] if mm else "", "pkl_file": FILES["model_file"].name if mm else "", "feature_cols_file": FILES["feature_cols"].name if mm else "",
                  "input_fields": [f["key"] for f in scorer["fields"]] if scorer_ok else [], "output_label": info.get("name", ""), "horizon": S.HORIZON_LABEL},
        "forecaster": {"input_schema": ([{"name": f["key"], "type": ("str" if f["type"] == "category" else "float"), "range": ([f["min"], f["max"]] if f["type"] == "number" else f["options"])} for f in scorer["fields"]] if scorer_ok else []),
                       "output_schema": {"prediction": "int", "probability": "float", "risk_level": "str"}, "lookup_file": None},
        "frontend": {"framework": "react", "deploy_target": "cloudflare_workers"},
        "files": [{"filename": r_, "purpose": "dashboard data"} for r_ in sorted(set(WRITTEN))],
    }
    io.save_json(contract, FILES["contract"])
    bad = _validate()
    total_kb = sum((OUTPUT_DIR / r_).stat().st_size for r_ in set(WRITTEN) if (OUTPUT_DIR / r_).exists()) / 1024.0
    print("")
    print("Active source:", src)
    print("Contract:", "output/frontend_contract.json")
    print("Files written:", len(set(WRITTEN)) + 1, "| total %.0f KB" % total_kb)
    if bad:
        print("Rewritten as skipped stand-ins:", bad)
    return contract
