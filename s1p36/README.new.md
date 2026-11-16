# s1p36

## Business Problem
An online store tracks traffic, pricing, margin and revenue targets by product category each month. The question is which categories are drifting away from target, why, and what to change this week.

## The Core Finding
59.6% of the 208 category-months fall in the at-risk group (net revenue below the monthly revenue target for the category).
The selected model (Logistic Regression) reaches a held-out AUC of 0.83 on 52 rows, which is better than the naive baseline.

## Dataset
208 rows, 8 categories, 26 months (2024-09 to 2026-10).

## Project Structure
```
s1p36/
  .gitignore
  README.md
  README.new.md
  backend/
    export_for_frontend.py
    main.py
    requirements.txt
    config/
      __init__.py
      goals.json
      settings.py
    data/
      interim/
        cleaning_log.json
        target_info.json
        validation_report.json
      processed/
        alerts.json
        business_actions.csv
        clean_data.csv
        feature_store.csv
        forecast_meta.json
        forecast_output.csv
        goal_progress.json
        model_predictions.csv
        segments_anomalies.csv
        scenarios/
          checkout_lift.json
          price_change.json
          stockout_recovery.json
      raw/
        s1p36.csv
    logs/
    models/
      best_model.joblib
      feature_cols.json
      leakage_log.json
      model_hashes.json
      model_meta.json
      segment_models.joblib
    notebooks/
      s1p36_analysis.ipynb
    output/
      frontend_contract.json
      decide/
        goals.json
        insights.json
        recommendations.json
        simulations/
          checkout_lift.json
          index.json
          price_change.json
          stockout_recovery.json
      meta/
        model_meta.json
        run_log.json
        summary.json
        terminology.json
```

## How It Works
The data is read and checked, cleaned, and turned into explainable measures such as cart rate, discount intensity and contribution margin. A risk model estimates which category-months miss target, segments and unusual months are flagged, a short-horizon forecast is checked on held-out months, and business rules turn all of it into a ranked action list and what-if scenarios.

## Models
| Model | Purpose | Status |
| --- | --- | --- |
| Logistic Regression | Flags at-risk category-months | Ready |
| KMeans and Isolation Forest | Segments and unusual months | Ready |
| Gradient Boosting | Next-month revenue | Ready |

## Key Insights
- 59.6% of category-months fall in the group: missed target. 124 of 208 category-months; total shortfall against target across all months is 3,270,661.
- Contribution margin ranges from 21.8% in Apparel to 38.5% in Beauty & Wellness. Margin is contribution profit divided by net revenue over all months.
- Home & Living has the largest cumulative gap to target. Net revenue 13,124,542 against target 14,113,821, a gap of 989,279.

## How to Run
1. Open a terminal in the backend folder.
2. Install the packages with pip install -r requirements.txt.
3. Run python main.py to execute every stage.
4. Run python export_for_frontend.py to write the dashboard data into output/.
5. Open the notebook in notebooks/ to see the same steps with charts inline.
6. Start the dashboard from the frontend folder as described in its own README.

## Output Files
| File | Content |
| --- | --- |
| reports/business_report.xlsx | Workbook for the business team |
| reports/interactive_dashboard.html | Interactive charts |
| reports/insights.json | Insights with evidence and actions |
| data/processed/business_actions.csv | Alerts, priority and actions per category-month |
| output/ | Dashboard data files |

## Tech Stack
Python, pandas, NumPy, scikit-learn, matplotlib, openpyxl, Plotly, joblib.
