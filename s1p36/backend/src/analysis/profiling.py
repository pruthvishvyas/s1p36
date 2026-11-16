import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, chart_path


def _bins(series, n=12):
    s = series.dropna()
    counts, edges = np.histogram(s, bins=n)
    return [{"label": "%.2f to %.2f" % (edges[i], edges[i + 1]), "value": int(counts[i])} for i in range(len(counts))], edges


def run(df, verbose=True):
    plt.rcParams.update({"figure.dpi": 150, "axes.spines.top": False, "axes.spines.right": False})
    C, F = S.C, S.F
    info = io.read_json(FILES["target_info"])
    tcol, pos, neg = F["target"], info["positive_label"], info["negative_label"]
    specs = []

    def add(cid, title, ctype, question, xl, yl, data):
        specs.append({"id": cid, "title": title, "type": ctype, "question": question,
                      "x_label": xl, "y_label": yl, "data": data})

    # target balance
    counts = df[tcol].value_counts().reindex([0, 1]).fillna(0).astype(int)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.bar([neg, pos], counts.values, color=["#2a9d8f", "#e76f51"])
    for i, v in enumerate(counts.values):
        ax.text(i, v, str(v), ha="center", va="bottom")
    ax.set_title("Category-months by " + info["name"])
    fig.tight_layout()
    io.save_fig(fig, chart_path("target"))
    add("target_balance", "Category-months by outcome", "bar", "How often does a category miss its goal?", "Outcome", "Category-months",
        [{"label": neg, "value": int(counts[0])}, {"label": pos, "value": int(counts[1])}])

    # attainment by category
    g = df.groupby(C["category"]).agg(rev=(C["net_rev"], "sum"), tgt=(C["rev_target"], "sum"))
    g["att"] = 100 * g["rev"] / g["tgt"].replace(0, 1)
    g = g.sort_values("att")
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(g.index, g["att"], color=np.where(g["att"] < 100, "#e76f51", "#2a9d8f"))
    ax.axvline(100, color="black", lw=1)
    ax.set_xlabel("Net revenue as % of target")
    ax.set_title("Target attainment by category")
    fig.tight_layout()
    io.save_fig(fig, chart_path("attainment"))
    add("attainment_by_category", "Target attainment by category", "bar", "Which categories fall short of their revenue target?",
        "Category", "Net revenue as % of target", [{"label": i, "value": round(float(v), 2)} for i, v in g["att"].items()])

    # discount depth by outcome
    fig, ax = plt.subplots(figsize=(7, 4))
    _, edges = _bins(df[C["discount_depth"]])
    ax.hist(df.loc[df[tcol] == 0, C["discount_depth"]], bins=edges, alpha=0.6, label=neg, color="#2a9d8f")
    ax.hist(df.loc[df[tcol] == 1, C["discount_depth"]], bins=edges, alpha=0.6, label=pos, color="#e76f51")
    ax.set_xlabel("Average discount depth"); ax.legend(); ax.set_title("Discount depth by outcome")
    fig.tight_layout()
    io.save_fig(fig, chart_path("discount"))
    dd, _ = _bins(df[C["discount_depth"]])
    add("discount_distribution", "Discount depth distribution", "histogram", "How deep are the discounts being given?",
        "Discount depth", "Category-months", dd)

    # correlation heatmap
    keys = ["sessions", "orders", "net_rev", "contrib", "discount_depth", "return_rate", "comp_index", "stockout_days", "conv", "marketing"]
    cols = [C[k] for k in keys]
    corr = df[cols].corr()
    mask = np.triu(np.ones_like(corr, dtype=bool))
    fig, ax = plt.subplots(figsize=(8, 6.5))
    m = np.ma.array(corr.values, mask=mask)
    im = ax.imshow(m, cmap="RdYlGn", vmin=-1, vmax=1)
    ax.set_xticks(range(len(cols))); ax.set_xticklabels(cols, rotation=60, ha="right", fontsize=7)
    ax.set_yticks(range(len(cols))); ax.set_yticklabels(cols, fontsize=7)
    for i in range(len(cols)):
        for j in range(i):
            ax.text(j, i, "%.2f" % corr.values[i, j], ha="center", va="center", fontsize=6)
    fig.colorbar(im, shrink=0.7); ax.set_title("Correlation of key measures")
    fig.tight_layout()
    io.save_fig(fig, chart_path("corr"))
    add("correlation", "Correlation of key measures", "heatmap", "Which measures move together?", "Measure", "Measure",
        [{"row": a, "col": b, "value": round(float(corr.loc[a, b]), 3)} for a in cols for b in cols])

    # missed rate by category
    r = df.groupby(C["category"])[tcol].mean().sort_values() * 100
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(r.index, r.values, color="#e76f51")
    ax.set_xlabel("% of months in the outcome: " + pos); ax.set_title("Outcome rate by category")
    fig.tight_layout()
    io.save_fig(fig, chart_path("cat_rate"))
    add("outcome_rate_by_category", "Outcome rate by category", "bar", "Which categories most often land in the at-risk group?",
        "Category", "% of months", [{"label": i, "value": round(float(v), 2)} for i, v in r.items()])

    # health score by outcome
    fig, ax = plt.subplots(figsize=(7, 4))
    _, edges = _bins(df[F["health"]])
    ax.hist(df.loc[df[tcol] == 0, F["health"]], bins=edges, alpha=0.6, label=neg, color="#2a9d8f")
    ax.hist(df.loc[df[tcol] == 1, F["health"]], bins=edges, alpha=0.6, label=pos, color="#e76f51")
    ax.set_xlabel("Health score"); ax.legend(); ax.set_title("Health score by outcome")
    fig.tight_layout()
    io.save_fig(fig, chart_path("health"))
    hb, _ = _bins(df[F["health"]])
    add("health_score_distribution", "Health score distribution", "histogram", "How is performance spread across category-months?",
        "Health score", "Category-months", hb)

    # sessions against revenue
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(df.loc[df[tcol] == 0, C["sessions"]], df.loc[df[tcol] == 0, C["net_rev"]], alpha=0.6, s=18, label=neg, color="#2a9d8f")
    ax.scatter(df.loc[df[tcol] == 1, C["sessions"]], df.loc[df[tcol] == 1, C["net_rev"]], alpha=0.7, s=18, label=pos, color="#e76f51")
    ax.set_xlabel("Sessions"); ax.set_ylabel("Net revenue"); ax.legend(); ax.set_title("Traffic against revenue")
    fig.tight_layout()
    io.save_fig(fig, chart_path("scatter"))
    sm = df.sample(min(len(df), 1500), random_state=S.RANDOM_STATE)
    add("sessions_vs_revenue", "Traffic against revenue", "scatter", "Does more traffic turn into more revenue in every category?",
        "Sessions", "Net revenue", [{"x": float(a), "y": float(b), "label": str(c)} for a, b, c in zip(sm[C["sessions"]], sm[C["net_rev"]], sm[C["category"]])])

    # heatmap category by month
    pv = df.pivot_table(index=C["category"], columns=C["month"], values=tcol, aggfunc="mean") * 100
    fig, ax = plt.subplots(figsize=(9, 6))
    im = ax.imshow(pv.values, cmap="RdYlGn_r", aspect="auto", vmin=0, vmax=100)
    ax.set_yticks(range(len(pv.index))); ax.set_yticklabels(pv.index, fontsize=7)
    ax.set_xticks(range(len(pv.columns))); ax.set_xticklabels([c.strftime("%b %y") for c in pv.columns], rotation=60, fontsize=7)
    fig.colorbar(im, shrink=0.7); ax.set_title("At-risk rate by category and month")
    fig.tight_layout()
    io.save_fig(fig, chart_path("heat"))
    hd = []
    for a in pv.index:
        for b in pv.columns:
            v = pv.loc[a, b]
            if pd.notna(v):
                hd.append({"row": str(a), "col": b.strftime("%Y-%m"), "value": round(float(v), 1)})
    add("outcome_heatmap", "At-risk rate by category and month", "heatmap", "Is the problem concentrated in particular months?",
        "Month", "Category", hd)

    # monthly trend
    mt = df.groupby(C["month"]).agg(rev=(C["net_rev"], "sum"), tgt=(C["rev_target"], "sum"))
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(mt.index, mt["rev"], marker="o", label="Net revenue", color="#264653")
    ax.plot(mt.index, mt["tgt"], ls="--", label="Target", color="#e76f51")
    ax.legend(); ax.set_title("Monthly net revenue against target")
    fig.autofmt_xdate(); fig.tight_layout()
    io.save_fig(fig, chart_path("trend"))
    add("monthly_trend", "Monthly net revenue", "line", "Is revenue trending up or down?", "Month", "Net revenue",
        [{"label": i.strftime("%Y-%m"), "value": float(v)} for i, v in mt["rev"].items()])

    io.save_json({"items": specs}, FILES["chart_specs"])
    if verbose:
        print("Charts written:", len(specs))
        for s_ in specs:
            print(" -", s_["title"], "|", s_["question"])
    return specs
