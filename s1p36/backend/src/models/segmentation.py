import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, MODELS_DIR, chart_path
from src.utils.runner import DataSizeSkip

NAMES = ["Low performing", "Mid performing", "High performing"]


def run(df, verbose=True):
    C, F = S.C, S.F
    if len(df) < 20:
        raise DataSizeSkip("only %d rows, segmentation needs at least 20" % len(df))
    cols = [C[k] for k in S.SEGMENT_CLIENT] + [F[k] for k in S.SEGMENT_ENG]
    X = df[cols].astype(float).fillna(df[cols].median())
    Z = StandardScaler().fit_transform(X)
    km = KMeans(n_clusters=3, n_init=10, random_state=S.RANDOM_STATE).fit(Z)
    order = pd.Series(df[F["health"]].values).groupby(km.labels_).mean().sort_values().index.tolist()
    names = {c: NAMES[i] for i, c in enumerate(order)}
    seg = pd.Series(km.labels_).map(names)
    sil = float(silhouette_score(Z, km.labels_)) if len(set(km.labels_)) > 1 else float("nan")

    iso = IsolationForest(n_estimators=200, contamination=S.ANOMALY_CONTAMINATION, random_state=S.RANDOM_STATE).fit(Z)
    is_anom = (iso.predict(Z) == -1).astype(int)
    score = -iso.score_samples(Z)

    # reason: the measure furthest from the category's own typical level
    med = X.groupby(df[C["category"]].values).transform("median")
    spread = X.std().replace(0, 1)
    dev = ((X - med) / spread)
    worst = dev.abs().idxmax(axis=1)
    metric_val = np.array([X.iloc[i][worst.iloc[i]] for i in range(len(X))])
    expected = np.array([med.iloc[i][worst.iloc[i]] for i in range(len(X))])
    direction = np.array(["above" if X.iloc[i][worst.iloc[i]] >= med.iloc[i][worst.iloc[i]] else "below" for i in range(len(X))])
    reason = [w + " is well " + d_ + " the usual level for " + c for w, d_, c in zip(worst, direction, df[C["category"]])]

    out = pd.DataFrame({F["row_id"]: df[F["row_id"]].values, "segment": seg.values, "is_anomaly": is_anom,
                        "anomaly_score": score, "anomaly_metric": worst.values, "anomaly_value": metric_val,
                        "anomaly_expected": expected, "anomaly_reason": reason})
    io.save_csv(out, FILES["segments"])
    io.save_model({"scaler_cols": cols, "kmeans": km, "forest": iso}, MODELS_DIR / "segment_models.joblib")

    pc = PCA(n_components=2, random_state=S.RANDOM_STATE).fit_transform(Z)
    fig, ax = plt.subplots(1, 2, figsize=(11, 4.5))
    for nme, colr in zip(NAMES, ["#e76f51", "#e9c46a", "#2a9d8f"]):
        m = (seg == nme).values
        ax[0].scatter(pc[m, 0], pc[m, 1], s=16, alpha=0.7, label=nme, color=colr)
    ax[0].legend(fontsize=8); ax[0].set_title("Segments (two components)")
    ax[1].scatter(pc[is_anom == 0, 0], pc[is_anom == 0, 1], s=14, alpha=0.5, color="#8d99ae", label="Normal")
    ax[1].scatter(pc[is_anom == 1, 0], pc[is_anom == 1, 1], s=22, color="#d62828", label="Unusual")
    ax[1].legend(fontsize=8); ax[1].set_title("Unusual category-months")
    fig.tight_layout(); io.save_fig(fig, chart_path("segments"))

    tgt = df[F["target"]].values
    if verbose:
        print("Segment sizes:", seg.value_counts().to_dict(), "| silhouette %.3f" % sil)
        print("Unusual category-months:", int(is_anom.sum()), "| at-risk rate among them: %.1f%%" %
              (100 * tgt[is_anom == 1].mean() if is_anom.sum() else 0.0))
    return out
