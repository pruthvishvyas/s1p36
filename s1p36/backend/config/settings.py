from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

PROJECT_NAME = "s1p36"
PROJECT_SLUG = "s1p36"
DOMAIN = "ecommerce"
DESCRIPTION = "Monthly performance of an online store by product category: traffic, funnel, pricing, margin and revenue target attainment."

RANDOM_STATE = 42
TEST_SIZE = 0.25
ANOMALY_CONTAMINATION = 0.08   # about one category-month in twelve behaves unusually in online retail
ELASTICITY_FALLBACK = -1.2     # typical price sensitivity for general merchandise, used when the data cannot support an estimate
RECOVERY_FACTOR = 0.5          # only about half of the demand lost to a stockout day comes back once stock returns
DAYS_IN_MONTH = 30

# client column names exactly as supplied: key -> (name, required)
COLUMNS = {
    "month": ("Month", True), "year": ("Year", False), "month_num": ("Month_Num", False),
    "category": ("Category", True), "sessions": ("Sessions", True), "carts": ("Add_to_Carts", True),
    "checkouts": ("Checkouts_Started", True), "orders": ("Orders", True), "units": ("Units_Sold", True),
    "list_price": ("List_Price_Avg", True), "sell_price": ("Avg_Selling_Price", True),
    "discount_depth": ("Discount_Depth_Pct", True), "gross_sales": ("Gross_Sales", True),
    "discounts": ("Discounts", True), "returns": ("Returns", True), "return_rate": ("Return_Rate", True),
    "net_rev": ("Net_Revenue", True), "cogs": ("COGS", True), "gross_profit": ("Gross_Profit", True),
    "gross_margin": ("Gross_Margin_Pct", True), "fulfil": ("Fulfillment_Cost", True),
    "marketing": ("Marketing_Cost_Allocated", True), "contrib": ("Contribution_Profit", True),
    "comp_index": ("Competitor_Price_Index", True), "promo_days": ("Promo_Days", True),
    "stockout_days": ("Stockout_Days", True), "rev_target": ("Revenue_Target", True),
    "conv": ("Conversion_Rate", True), "checkout_comp": ("Checkout_Completion_Rate", True),
}
C = {k: v[0] for k, v in COLUMNS.items()}
REQUIRED = [k for k, v in COLUMNS.items() if v[1]]

PERCENT_KEYS = ["discount_depth", "return_rate", "gross_margin", "conv", "checkout_comp"]
CAPPED_KEYS = ["discount_depth", "return_rate", "gross_margin", "conv", "checkout_comp", "comp_index"]

# engineered columns
F = {
    "row_id": "row_id", "month_label": "month_label", "target": "at_risk_flag", "missed": "missed_target_flag",
    "attain": "target_attainment", "gap": "revenue_gap", "cart_rate": "cart_rate", "checkout_rate": "checkout_rate",
    "order_rate": "checkout_to_order_rate", "aov": "avg_order_value", "units_per_order": "units_per_order",
    "rev_per_session": "revenue_per_session", "contrib_margin": "contribution_margin", "discount_rate": "discount_rate",
    "fulfil_share": "fulfilment_share", "mkt_share": "marketing_share", "mkt_per_session": "marketing_per_session",
    "discount_intensity": "discount_intensity", "stockout_share": "stockout_share", "price_vs_comp": "price_vs_competitor",
    "log_target": "log_revenue_target", "health": "health_score", "high_discount": "high_discount_flag",
    "stockout_flag": "stockout_flag", "unprofitable": "unprofitable_flag", "mom": "revenue_mom_change",
}

MODEL_NUM_CLIENT = ["sessions", "carts", "checkouts", "list_price", "sell_price", "discount_depth",
                    "comp_index", "promo_days", "stockout_days", "marketing", "month_num"]
MODEL_NUM_ENG = ["cart_rate", "checkout_rate", "discount_intensity", "stockout_share", "mkt_per_session",
                 "price_vs_comp", "log_target"]
MODEL_CAT_CLIENT = ["category"]
# raw fields a person can sensibly type into the prediction form
EXPOSABLE = ["sessions", "carts", "checkouts", "list_price", "sell_price", "discount_depth", "comp_index",
             "promo_days", "stockout_days", "marketing", "category"]

SEGMENT_CLIENT = ["sessions", "conv", "checkout_comp", "discount_depth", "return_rate"]
SEGMENT_ENG = ["aov", "contrib_margin", "health"]

THRESHOLDS = {
    "attainment_low": 0.90,       # under 90% of target is hard to recover inside the month
    "thin_margin": 0.10,          # contribution under 10% of revenue leaves no cushion for a bad week
    "heavy_discount": 0.25,       # discounts beyond a quarter off start to train shoppers to wait for sales
    "stockout_days": 3,           # three lost days is roughly a tenth of the month
    "high_returns": 0.12,         # returns above 12% usually point to fit or description problems
    "price_above_market": 1.05,   # more than 5% above the competitor index loses price-led shoppers
    "weak_checkout": 0.45,        # fewer than 45 in 100 started checkouts completing is a funnel leak
    "weak_conversion_ratio": 0.80 # conversion under 80% of the category's own median
}
ALERT_WEIGHTS = {"UNPROFITABLE": 5, "REVENUE_DROP": 3, "BELOW_TARGET": 3, "THIN_MARGIN": 2, "HEAVY_DISCOUNT": 2,
                 "STOCKOUT": 2, "HIGH_RETURNS": 1, "PRICE_ABOVE_MARKET": 1, "WEAK_CHECKOUT": 1, "WEAK_CONVERSION": 1}
ACTIONS = {
    "UNPROFITABLE": "Cut marketing or fulfilment spend or reprice",
    "REVENUE_DROP": "Check traffic sources and pricing for the drop",
    "BELOW_TARGET": "Add promotion or traffic budget to close the target gap",
    "THIN_MARGIN": "Raise price or renegotiate costs",
    "HEAVY_DISCOUNT": "Shorten promotions and cap discount depth",
    "STOCKOUT": "Reorder now to avoid more stockout days",
    "HIGH_RETURNS": "Review product pages and sizing guidance",
    "PRICE_ABOVE_MARKET": "Review price against competitors",
    "WEAK_CHECKOUT": "Simplify checkout and recover abandoned carts",
    "WEAK_CONVERSION": "Improve product pages and on-site search",
}
PRIORITY_CUTS = [("P1_URGENT", 5), ("P2_HIGH", 3), ("P3_MEDIUM", 1), ("P4_ROUTINE", 0)]

TERMINOLOGY = {"revenue": "Net revenue", "customer": "Shopper", "product": "Category", "transaction": "Order"}
CURRENCY = {"code": None, "symbol": ""}
LOCALE = "en-US"
BIGQUERY = {"project_id": "", "dataset": "", "table": "feat", "credentials_file": "credentials.json"}
SCENARIO_IDS = ["price_change", "checkout_lift", "stockout_recovery"]
HORIZON_LABEL = "1 month"

CHART_FILES = {
    "target": "chart_target_balance.png", "attainment": "chart_attainment_by_category.png",
    "discount": "chart_discount_by_target.png", "corr": "chart_correlation.png",
    "cat_rate": "chart_missed_rate_by_category.png", "health": "chart_health_score.png",
    "scatter": "chart_sessions_vs_revenue.png", "heat": "chart_missed_rate_heatmap.png",
    "trend": "chart_monthly_trend.png", "model_eval": "chart_model_evaluation.png",
    "importance": "chart_feature_importance.png", "segments": "chart_segments_anomalies.png",
    "forecast_eval": "chart_forecast_check.png", "priority": "chart_priority_counts.png",
}
