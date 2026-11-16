from config.settings import PROJECT_ROOT, CHART_FILES

CONFIG_DIR = PROJECT_ROOT / "config"
RAW_DIR = PROJECT_ROOT / "data" / "raw"
INTERIM_DIR = PROJECT_ROOT / "data" / "interim"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
MODELS_DIR = PROJECT_ROOT / "models"
REPORTS_DIR = PROJECT_ROOT / "reports"
OUTPUT_DIR = PROJECT_ROOT / "output"
LOGS_DIR = PROJECT_ROOT / "logs"
NOTEBOOKS_DIR = PROJECT_ROOT / "notebooks"

FILES = {
    "validation_report": INTERIM_DIR / "validation_report.json",
    "cleaning_log": INTERIM_DIR / "cleaning_log.json",
    "target_info": INTERIM_DIR / "target_info.json",
    "clean_data": PROCESSED_DIR / "clean_data.csv",
    "feature_store": PROCESSED_DIR / "feature_store.csv",
    "chart_specs": REPORTS_DIR / "chart_specs.json",
    "model_predictions": PROCESSED_DIR / "model_predictions.csv",
    "model_meta": MODELS_DIR / "model_meta.json",
    "model_file": MODELS_DIR / "best_model.joblib",
    "feature_cols": MODELS_DIR / "feature_cols.json",
    "leakage_log": MODELS_DIR / "leakage_log.json",
    "hashes": MODELS_DIR / "model_hashes.json",
    "segments": PROCESSED_DIR / "segments_anomalies.csv",
    "forecast_output": PROCESSED_DIR / "forecast_output.csv",
    "forecast_meta": PROCESSED_DIR / "forecast_meta.json",
    "business_actions": PROCESSED_DIR / "business_actions.csv",
    "scenario_dir": PROCESSED_DIR / "scenarios",
    "goals": CONFIG_DIR / "goals.json",
    "goal_progress": PROCESSED_DIR / "goal_progress.json",
    "alerts": PROCESSED_DIR / "alerts.json",
    "insights": REPORTS_DIR / "insights.json",
    "workbook": REPORTS_DIR / "business_report.xlsx",
    "dashboard_html": REPORTS_DIR / "interactive_dashboard.html",
    "contract": OUTPUT_DIR / "frontend_contract.json",
    "run_log": OUTPUT_DIR / "meta" / "run_log.json",
}

def chart_path(key):
    return REPORTS_DIR / CHART_FILES[key]

def ensure_dirs():
    for d in (RAW_DIR, INTERIM_DIR, PROCESSED_DIR, MODELS_DIR, REPORTS_DIR, OUTPUT_DIR, LOGS_DIR,
              NOTEBOOKS_DIR, CONFIG_DIR, FILES["scenario_dir"]):
        d.mkdir(parents=True, exist_ok=True)
