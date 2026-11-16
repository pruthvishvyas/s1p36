import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, chart_path
from src.utils.runner import DataSizeSkip

warnings.filterwarnings("ignore")


def _mape(a, p):
    a, p = np.asarray(a, float), np.asarray(p, float)
    return float(np.mean(np.abs(a - p) / np.where(a == 0, 1, np.abs(a))) * 100)


def run(df, verbose=True):
    # predicts next month net revenue per category from this month's drivers
    C, F = S.C, S.F
    d = df.sort_values([C["category"], C["month"]]).reset_index(drop=True).copy()
    d["_idx"] = d[C["month"]].dt.year * 12 + d[C["month"]].dt.month
    g = d.groupby(C["category"])
    d["_next"] = g[C["net_rev"]].shift(-1)
    d["_next_idx"] = g["_idx"].shift(-1)
    d.loc[(d["_next_idx"] - d["_idx"]) != 1, "_next"] = np.nan
    d["_next_month"] = d[C["month"]] + pd.offsets.MonthBegin(1)
    d["_ang"] = 2 * np.pi * d["_next_month"].dt.month / 12
    d["_sin"], d["_cos"] = np.sin(d["_ang"]), np.cos(d["_ang"])
    d["_cur"] = d[C["net_rev"]].clip(lower=1)
    d["_lcur"] = np.log(d["_cur"])
    d["_lmkt"] = np.log1p(d[C["marketing"]].clip(lower=0))
    num = ["_lcur", C["sessions"], C["discount_depth"], C["promo_days"], C["stockout_days"], C["comp_index"], "_lmkt", "_sin", "_cos"]
    cat = [C["category"]]
    n_months = d["_idx"].nunique()
    if n_months < 6:
        raise DataSizeSkip("only %d months of history, at least 6 are needed for a chronological check" % n_months)

    lab = d[d["_next"].notna()].copy()
    lab["_y"] = np.log(lab["_next"].clip(lower=1) / lab["_cur"])
    idxs = sorted(lab["_idx"].unique())
    hold_n = int(min(3, max(1, len(idxs) // 4)))
    hold = idxs[-hold_n:]
    train = lab[~lab["_idx"].isin(hold)].sort_values("_idx")
    test = lab[lab["_idx"].isin(hold)]
    if len(train) < 20:
        raise DataSizeSkip("only %d training rows for the forecast, minimum is 20" % len(train))

    def pipe(est):
        pre = ColumnTransformer([("n", Pipeline([("i", SimpleImputer(strategy="median")), ("s", StandardScaler())]), num),
                                 ("c", OneHotEncoder(handle_unknown="ignore"), cat)])
        return Pipeline([("pre", pre), ("m", est)])

    cands = {"Ridge": pipe(Ridge(alpha=10.0)),
             "Gradient Boosting": pipe(GradientBoostingRegressor(n_estimators=150, max_depth=2, learning_rate=0.05, subsample=0.8, random_state=S.RANDOM_STATE))}
    cvs = {}
    for k, m in cands.items():
        try:
            cvs[k] = float(-cross_val_score(m, train[num + cat], train["_y"], cv=TimeSeriesSplit(n_splits=3), scoring="neg_mean_absolute_error").mean())
        except Exception:
            cvs[k] = float("inf")
    best = min(cvs, key=cvs.get)
    model = cands[best].fit(train[num + cat], train["_y"])
    pred = test["_cur"].values * np.exp(model.predict(test[num + cat]))
    act = test["_next"].values
    base = test["_cur"].values
    mae, base_mae = float(np.mean(np.abs(act - pred))), float(np.mean(np.abs(act - base)))
    mp, base_mp = _mape(act, pred), _mape(act, base)
    beats = bool(mae < base_mae)
    method = best + " on next-month change" if beats else "Last value (the model did not beat it)"
    rel = act / np.where(pred == 0, 1, pred) - 1
    if len(rel) >= 10:
        qlo, qhi = float(np.quantile(rel, 0.05)), float(np.quantile(rel, 0.95))
    else:
        qlo, qhi = -mp / 100.0, mp / 100.0
    if verbose:
        print("Rows to learn from:", len(train), "| held-out months:", hold_n)
        print("Candidates (time-ordered CV, MAE on log change):", {k: round(v, 4) for k, v in cvs.items()})
        print("Held-out MAE %.0f vs last-value %.0f | MAPE %.1f%% vs %.1f%%" % (mae, base_mae, mp, base_mp))
        print("Forecast method used:", method)
        if n_months < 24:
            print("Low sample: fewer than two full seasonal cycles, seasonality cannot be checked")

    latest = d[d["_idx"] == d["_idx"].max()].copy()
    p_next = latest["_cur"].values * np.exp(model.predict(latest[num + cat])) if beats else latest["_cur"].values
    lo, hi = p_next * (1 + qlo), p_next * (1 + qhi)
    rows = pd.concat([
        pd.DataFrame({"kind": "holdout", C["category"]: test[C["category"]].values, "month": test["_next_month"].values,
                      "actual": act, "forecast": pred, "baseline": base, "low": np.nan, "high": np.nan}),
        pd.DataFrame({"kind": "forecast", C["category"]: latest[C["category"]].values, "month": latest["_next_month"].values,
                      "actual": np.nan, "forecast": p_next, "baseline": latest["_cur"].values, "low": lo, "high": hi})])
    io.save_csv(rows, FILES["forecast_output"])
    tot = {"total_forecast": float(p_next.sum()), "total_low": float(lo.sum()), "total_high": float(hi.sum())}
    meta = {"method": method, "model": best, "horizon": S.HORIZON_LABEL, "mae": mae, "mape": mp,
            "baseline_mae": base_mae, "baseline_mape": base_mp, "beats_baseline": beats,
            "holdout_months": [pd.Timestamp(i).strftime("%Y-%m") for i in sorted(test["_next_month"].unique())],
            "train_rows": int(len(train)), "months_of_history": int(n_months), "low_sample": bool(n_months < 24),
            "next_month": pd.Timestamp(latest["_next_month"].iloc[0]).strftime("%Y-%m"), "unit": "net revenue per category-month",
            "seasonal_naive_available": bool(n_months >= 24)}
    meta.update(tot)
    io.save_json(meta, FILES["forecast_meta"])
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.scatter(act, pred, s=18, alpha=0.7)
    m_ = max(act.max(), pred.max()); ax.plot([0, m_], [0, m_], "k--", lw=0.8)
    ax.set_xlabel("Actual next-month net revenue"); ax.set_ylabel("Forecast"); ax.set_title("Held-out months: forecast against actual")
    fig.tight_layout(); io.save_fig(fig, chart_path("forecast_eval"))
    return meta
