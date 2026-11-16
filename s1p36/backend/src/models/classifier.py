import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (roc_auc_score, accuracy_score, classification_report, confusion_matrix,
                             roc_curve, recall_score, precision_score)
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, chart_path
from src.utils.runner import DataSizeSkip

warnings.filterwarnings("ignore")


def feature_lists():
    num = [S.C[k] for k in S.MODEL_NUM_CLIENT] + [S.F[k] for k in S.MODEL_NUM_ENG]
    cat = [S.C[k] for k in S.MODEL_CAT_CLIENT]
    return num, cat


def leakage_guard(df, y, cols):
    keep, drops = [], []
    for c in cols:
        x = pd.to_numeric(df[c], errors="coerce")
        ok = x.notna()
        if ok.sum() < 20 or x[ok].nunique() < 2:
            drops.append({"feature": c, "reason": "constant or nearly empty"})
            continue
        try:
            auc = roc_auc_score(y[ok], x[ok])
            auc = max(auc, 1 - auc)
        except Exception:
            auc = 0.5
        corr = np.corrcoef(x[ok].astype(float), y[ok].astype(float))[0, 1]
        corr = 0.0 if not np.isfinite(corr) else abs(corr)
        if auc > 0.97 or corr > 0.95:
            drops.append({"feature": c, "reason": "single-feature AUC %.3f, correlation %.3f with the target" % (auc, corr)})
        else:
            keep.append(c)
    return keep, drops


def _prep(num, cat):
    return ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])


def _models():
    out = {
        "Logistic Regression": LogisticRegression(max_iter=2000, C=0.5, random_state=S.RANDOM_STATE),
        "Random Forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=S.RANDOM_STATE, n_jobs=1),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.05, subsample=0.8, random_state=S.RANDOM_STATE),
    }
    try:
        from xgboost import XGBClassifier
        out["XGBoost"] = XGBClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, subsample=0.8,
                                       eval_metric="logloss", random_state=S.RANDOM_STATE, n_jobs=1)
    except Exception:
        pass
    return out


def run(df, verbose=True):
    C, F = S.C, S.F
    info = io.read_json(FILES["target_info"])
    y = df[F["target"]].astype(int)
    classes = y.value_counts()
    if len(classes) != 2:
        raise DataSizeSkip("the target has a single class, no classifier can be fitted")
    num, cat = feature_lists()
    keep_num, drops = leakage_guard(df, y, num)
    io.save_json({"dropped": drops, "kept": keep_num}, FILES["leakage_log"])
    if verbose:
        for d_ in drops:
            print("Dropped feature", d_["feature"], "-", d_["reason"])
    feats = keep_num + cat
    X = df[feats]
    strat = y if classes.min() >= 2 else None
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=S.TEST_SIZE, random_state=S.RANDOM_STATE, stratify=strat)
    if len(Xtr) < 20:
        raise DataSizeSkip("only %d training rows, minimum is 20" % len(Xtr))
    low_sample = bool(len(df) < 100 or classes.min() < 10)
    if low_sample and verbose:
        print("Low sample: fewer than 100 rows or fewer than 10 rows in a class, read the metrics with care")

    majority_acc = float(max(yte.mean(), 1 - yte.mean()))
    te = df.loc[Xte.index]
    rule = ((te[C["stockout_days"]] >= S.THRESHOLDS["stockout_days"]) |
            (te[C["discount_depth"]] > S.THRESHOLDS["heavy_discount"]) |
            (te[C["comp_index"]] > S.THRESHOLDS["price_above_market"])).astype(int)
    rule_acc = float(accuracy_score(yte, rule))
    if verbose:
        print("Naive baseline (always predict the majority class) accuracy: %.3f" % majority_acc)
        print("Rule-based baseline (stockout, heavy discount or high price) accuracy: %.3f" % rule_acc)

    folds = int(max(2, min(5, classes.min(), len(ytr) // 5)))
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=S.RANDOM_STATE)
    results, fitted = {}, {}
    for name, est in _models().items():
        pipe = Pipeline([("prep", _prep(keep_num, cat)), ("clf", est)])
        scores = cross_val_score(pipe, Xtr, ytr, cv=cv, scoring="roc_auc")
        pipe.fit(Xtr, ytr)
        prob = pipe.predict_proba(Xte)[:, 1]
        results[name] = {"cv_auc_mean": float(scores.mean()), "cv_auc_std": float(scores.std()),
                         "test_auc": float(roc_auc_score(yte, prob)),
                         "test_acc": float(accuracy_score(yte, (prob >= 0.5).astype(int)))}
        fitted[name] = pipe
        if verbose:
            r = results[name]
            print("%-20s CV-AUC %.3f +/- %.3f | Test-AUC %.3f | Test-Acc %.3f (cross-validation on training rows only)" %
                  (name, r["cv_auc_mean"], r["cv_auc_std"], r["test_auc"], r["test_acc"]))
    best = max(results, key=lambda k: results[k]["cv_auc_mean"])
    pipe = fitted[best]
    prob_te = pipe.predict_proba(Xte)[:, 1]
    pred_te = (prob_te >= 0.5).astype(int)
    rep = classification_report(yte, pred_te, target_names=[info["negative_label"], info["positive_label"]], zero_division=0)
    recall = float(recall_score(yte, pred_te, zero_division=0))
    precision = float(precision_score(yte, pred_te, zero_division=0))
    beats = bool(results[best]["test_auc"] >= 0.6 and results[best]["test_acc"] >= majority_acc)
    if verbose:
        print("")
        print("Selected on cross-validation:", best)
        print(rep)
        print("Held-out recall for " + info["positive_label"] + ": %.3f | precision: %.3f" % (recall, precision))
        print("Beats the naive baseline:" , "yes" if beats else "no better than baseline")

    # importances aggregated back to the original fields
    est = pipe.named_steps["clf"]
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    if hasattr(est, "feature_importances_"):
        vals = np.asarray(est.feature_importances_, dtype=float)
    else:
        vals = np.abs(np.asarray(est.coef_)[0])
    vals = vals / (vals.sum() if vals.sum() > 0 else 1.0)
    by_field = {}
    for n_, v_ in zip(names, vals):
        raw = n_.split("__", 1)[1]
        field = raw
        for c_ in cat:
            if raw.startswith(c_ + "_"):
                field = c_
        by_field[field] = by_field.get(field, 0.0) + float(v_)
    top = sorted(zip(names, vals), key=lambda t: -t[1])[:15]

    fig, ax = plt.subplots(1, 2, figsize=(11, 4.5))
    cm = confusion_matrix(yte, pred_te, labels=[0, 1])
    ax[0].imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax[0].text(j, i, str(cm[i, j]), ha="center", va="center")
    ax[0].set_xticks([0, 1]); ax[0].set_yticks([0, 1])
    ax[0].set_xticklabels([info["negative_label"], info["positive_label"]], fontsize=8)
    ax[0].set_yticklabels([info["negative_label"], info["positive_label"]], fontsize=8)
    ax[0].set_title("Confusion matrix (held-out rows)")
    fpr, tpr, _ = roc_curve(yte, prob_te)
    ax[1].plot(fpr, tpr, label="AUC %.3f" % results[best]["test_auc"]); ax[1].plot([0, 1], [0, 1], "k--", lw=0.8)
    ax[1].legend(); ax[1].set_title("ROC curve (held-out rows)")
    fig.tight_layout(); io.save_fig(fig, chart_path("model_eval"))
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh([t[0].split("__", 1)[1] for t in top][::-1], [t[1] for t in top][::-1], color="#264653")
    ax.set_title("Top 15 drivers: " + best); fig.tight_layout(); io.save_fig(fig, chart_path("importance"))

    io.save_model(pipe, FILES["model_file"])
    io.save_json({"numeric": keep_num, "categorical": cat}, FILES["feature_cols"])
    prob_all = pipe.predict_proba(df[feats])[:, 1]
    out = pd.DataFrame({F["row_id"]: df[F["row_id"]].values, "split": np.where(df.index.isin(Xte.index), "test", "train"),
                        "pred_" + F["target"]: (prob_all >= 0.5).astype(int), "pred_prob": prob_all})
    io.save_csv(out, FILES["model_predictions"])
    meta = {"model_name": best, "algorithm": type(est).__name__, "task": "classification",
            "target": info["name"], "positive_label": info["positive_label"],
            "feature_count": len(feats), "feature_cols": feats, "numeric": keep_num, "categorical": cat,
            "results": results, "test_rows": int(len(yte)), "train_rows": int(len(ytr)), "cv_folds": folds,
            "baseline_accuracy": majority_acc, "rule_baseline_accuracy": rule_acc,
            "test_recall": recall, "test_precision": precision, "beats_baseline": beats,
            "low_sample": low_sample, "leakage_dropped": drops,
            "importance_by_field": by_field, "top_features": [[t[0].split("__", 1)[1], float(t[1])] for t in top],
            "split_method": "stratified random split, seeded", "models_ready": True}
    io.save_json(meta, FILES["model_meta"])
    return meta
