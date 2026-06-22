"""
Trains a RandomForestRegressor predicting Land Surface Temperature (LST)
from NDVI, NDBI, and Elevation, using REAL satellite-derived data.

Source data: scripts/data/lst_global_cities_2000_2018.csv (380 rows, raw
export of the supplementary dataset from:

  "Time-series dataset on land surface temperature, vegetation, built up
   areas and other climatic factors in top 20 global cities (2000-2018)"
  Data in Brief, Elsevier. DOI: 10.1016/j.dib.2019.103803

This is real MODIS-derived city-level annual data for 20 global megacities
(no Indian cities are in this dataset — see the disclosure text below,
which is shown verbatim in the dashboard UI so this is never presented as
India-specific training data).

Run: python3 scripts/train_lst_model.py
Output: public/data/ml_model_real.json (read by MLModelPanel.jsx)
"""
import json
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, GroupShuffleSplit
from sklearn.metrics import r2_score, mean_absolute_error

SRC_CSV = "scripts/data/lst_global_cities_2000_2018.csv"
OUT_JSON = "public/data/ml_model_real.json"

FEATURES = ["NDVI", "NDBI", "Elevation(m)"]
TARGET = "LST_Day_MODIS_1KM(\xf8C)"  # "ø" mis-encoded degree symbol from the source xlsx

df = pd.read_csv(SRC_CSV)

# The source xlsx->csv export has a stray mis-encoded byte appended to all
# 19 Chicago elevation values ("181ÿ" instead of "181") — strip non-numeric
# trailing characters rather than dropping these otherwise-valid real rows.
df["Elevation(m)"] = pd.to_numeric(
    df["Elevation(m)"].astype(str).str.extract(r"(-?\d+\.?\d*)")[0],
    errors="coerce"
)

df = df.dropna(subset=FEATURES + [TARGET])

X = df[FEATURES]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(n_estimators=100, max_depth=None, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
r2 = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

importances = dict(zip(["ndvi", "ndbi", "elevation"], model.feature_importances_.tolist()))

# Stricter validation: hold out ENTIRE cities the model never trains on, not
# just different years of cities it has already seen. Elevation is near-
# constant per city, so a random row split lets the model partly "memorize"
# each city via elevation rather than learn a relationship that transfers to
# an unseen city — this is the honest check for that.
groups = df["City"]
gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
holdout_train_idx, holdout_test_idx = next(gss.split(X, y, groups))
holdout_model = RandomForestRegressor(n_estimators=100, max_depth=None, random_state=42)
holdout_model.fit(X.iloc[holdout_train_idx], y.iloc[holdout_train_idx])
holdout_pred = holdout_model.predict(X.iloc[holdout_test_idx])
holdout_r2 = r2_score(y.iloc[holdout_test_idx], holdout_pred)
holdout_mae = mean_absolute_error(y.iloc[holdout_test_idx], holdout_pred)
holdout_cities = sorted(df.iloc[holdout_test_idx]["City"].unique().tolist())

output = {
    "model": "RandomForestRegressor",
    "params": {"n_estimators": 100, "max_depth": None, "random_state": 42},
    "features": ["NDVI", "NDBI", "Elevation"],
    "target": "LST_Day_MODIS_1KM (°C)",
    "r2_score": round(float(r2), 3),
    "mae": round(float(mae), 3),
    "validation_method": "Random 80/20 row split (same cities, different years can appear in both train and test)",
    "city_holdout": {
        "r2_score": round(float(holdout_r2), 3),
        "mae": round(float(holdout_mae), 3),
        "method": "Entire cities held out of training (true unseen-city generalization test)",
        "held_out_cities": holdout_cities,
        "note": (
            "R2 drops sharply here because elevation is near-constant per city, so the "
            "random-split model partly memorizes each city via elevation rather than "
            "learning a relationship that transfers to a city it has never seen."
        )
    },
    "feature_importance": {k: round(float(v), 3) for k, v in importances.items()},
    "train_samples": len(X_train),
    "test_samples": len(X_test),
    "total_samples": len(df),
    "cities": int(df["City"].nunique()),
    "year_range": f"{int(df['Year'].min())}-{int(df['Year'].max())}",
    "source": {
        "title": "Time-series dataset on land surface temperature, vegetation, built up areas and other climatic factors in top 20 global cities (2000–2018)",
        "publisher": "Data in Brief, Elsevier",
        "doi": "10.1016/j.dib.2019.103803"
    },
    "disclosure": (
        "Model trained on MODIS-derived satellite data from 20 global megacities "
        "(2000-2018), Data in Brief, Elsevier — DOI: 10.1016/j.dib.2019.103803. "
        "Predicts general LST-vegetation-urbanization relationships; not India-specific "
        "training data."
    )
}

with open(OUT_JSON, "w") as f:
    json.dump(output, f, indent=2)

print(f"Trained on {len(X_train)} samples, tested on {len(X_test)} samples ({len(df)} total, {df['City'].nunique()} cities)")
print(f"Random-split R2: {r2:.3f}, MAE: {mae:.3f} degC")
print(f"City-holdout R2: {holdout_r2:.3f}, MAE: {holdout_mae:.3f} degC (held out: {holdout_cities})")
print(f"Feature importances: {importances}")
print(f"Wrote {OUT_JSON}")
