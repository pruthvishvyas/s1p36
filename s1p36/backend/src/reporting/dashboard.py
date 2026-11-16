import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES
from src.utils.runner import DataSizeSkip


def run(df, verbose=True):
    try:
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots
    except Exception:
        raise DataSizeSkip("plotly is not installed, the interactive page was not built")
    C, F = S.C, S.F
    info = io.read_json(FILES["target_info"])
    rate = (df.groupby(C["category"])[F["target"]].mean() * 100).sort_values()
    fig = make_subplots(rows=2, cols=2, subplot_titles=("At-risk rate by category (%)", "Health score distribution",
                                                        "Traffic against revenue", "Category-months by priority"))
    fig.add_trace(go.Bar(x=rate.values, y=rate.index, orientation="h", marker_color="#e76f51", showlegend=False), row=1, col=1)
    fig.add_trace(go.Histogram(x=df[F["health"]], nbinsx=20, marker_color="#264653", showlegend=False), row=1, col=2)
    for val, nme, col in ((0, info["negative_label"], "#2a9d8f"), (1, info["positive_label"], "#e76f51")):
        s_ = df[df[F["target"]] == val]
        fig.add_trace(go.Scatter(x=s_[C["sessions"]], y=s_[C["net_rev"]], mode="markers", name=nme, marker=dict(color=col, size=6, opacity=0.7)), row=2, col=1)
    if FILES["business_actions"].exists():
        a = pd.read_csv(FILES["business_actions"])["priority"].value_counts()
        fig.add_trace(go.Bar(x=a.index.tolist(), y=a.values, marker_color="#f77f00", showlegend=False), row=2, col=2)
    fig.update_layout(title_text="Performance dashboard", height=800)
    path = FILES["dashboard_html"]
    path.parent.mkdir(parents=True, exist_ok=True)
    html = fig.to_html(include_plotlyjs="cdn", full_html=True)
    html = html.replace("<head>", "<head><title>Performance dashboard</title>", 1)
    io.write_text(path, html)
    if verbose:
        print("Saved:", path.name)
    return path
