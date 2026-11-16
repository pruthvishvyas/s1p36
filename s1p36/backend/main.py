import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES, ensure_dirs
from src.utils.runner import run_stage, verify_outputs
from src.data import load_raw as intake
from src.data import clean as cleaning
from src.features import derive as feats
from src.analysis import profiling as explore
from src.models import classifier as primary
from src.models import segmentation as segments
from src.models import projection as forecast
from src.analytics import alerts as rules
from src.analytics import scenarios as scenarios
from src.analytics import targets as targets
from src.analytics import insights as insights
from src.reporting import workbook as workbook
from src.reporting import dashboard

ctx = {}


def frame():
    if "df" not in ctx:
        ctx["df"] = io.read_frame(FILES["feature_store"])
    return ctx["df"]


def main():
    ensure_dirs()
    F = FILES

    def s_intake():
        ctx["raw"] = intake.load_raw()

    def s_clean():
        ctx["clean"] = cleaning.clean(ctx["raw"] if "raw" in ctx else io.read_frame(F["clean_data"]))

    def s_feats():
        ctx["df"] = feats.build(ctx["clean"] if "clean" in ctx else io.read_frame(F["clean_data"]))

    run_stage("Data intake and validation", s_intake, produces=(F["validation_report"],))
    run_stage("Data cleaning", s_clean, requires=(F["validation_report"],), produces=(F["clean_data"], F["cleaning_log"]))
    run_stage("Feature building", s_feats, requires=(F["clean_data"],), produces=(F["feature_store"], F["target_info"]))
    run_stage("Exploratory charts", lambda: explore.run(frame()), requires=(F["feature_store"],), produces=(F["chart_specs"],))
    run_stage("Risk model", lambda: primary.run(frame()), requires=(F["feature_store"],), produces=(F["model_predictions"], F["model_meta"]))
    run_stage("Customer segments and unusual months", lambda: segments.run(frame()), requires=(F["feature_store"],), produces=(F["segments"],))
    run_stage("Next-month revenue forecast", lambda: forecast.run(frame()), requires=(F["feature_store"],), produces=(F["forecast_output"], F["forecast_meta"]))
    run_stage("Business rules and actions", lambda: rules.run(frame()), requires=(F["feature_store"],), produces=(F["business_actions"],))
    run_stage("What-if scenarios", lambda: scenarios.run(frame()), requires=(F["feature_store"],), produces=(F["scenario_dir"] / "price_change.json",))
    run_stage("Goals and alerts", lambda: targets.run(frame()), requires=(F["feature_store"],), produces=(F["goal_progress"], F["alerts"]))
    run_stage("Insights", lambda: insights.run(frame()), requires=(F["feature_store"],), produces=(F["insights"],))
    run_stage("Excel workbook", lambda: workbook.run(frame()), requires=(F["feature_store"],), produces=(F["workbook"],))
    run_stage("Interactive page", lambda: dashboard.run(frame()), requires=(F["feature_store"],), produces=(F["dashboard_html"],))
    verify_outputs()

    df = frame()
    C, Fe = S.C, S.F
    print("=" * 60)
    print("Rows:", len(df), "| Months:", df[C["month"]].nunique(), "| Categories:", df[C["category"]].nunique())
    print("At-risk share: %.1f%%" % (100 * df[Fe["target"]].mean()))
    print("Net revenue: {:,.0f} against target {:,.0f}".format(df[C["net_rev"]].sum(), df[C["rev_target"]].sum()))
    if F["segments"].exists():
        print("Unusual category-months:", int(pd.read_csv(F["segments"])["is_anomaly"].sum()))
    if F["business_actions"].exists():
        print("P1 category-months:", int((pd.read_csv(F["business_actions"])["priority"] == "P1_URGENT").sum()))
    print("=" * 60)


if __name__ == "__main__":
    main()
