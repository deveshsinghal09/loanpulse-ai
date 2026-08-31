from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, RobustScaler
from xgboost import XGBClassifier

from .config import TrainingConfig


@dataclass(frozen=True)
class FeatureGroups:
    numerical: list[str]
    categorical: list[str]


def infer_feature_groups(frame: pd.DataFrame) -> FeatureGroups:
    numerical = [column for column in frame.columns if pd.api.types.is_numeric_dtype(frame[column]) and not pd.api.types.is_bool_dtype(frame[column])]
    categorical = [column for column in frame.columns if column not in numerical]
    if not numerical and not categorical:
        raise ValueError("no model features remain after exclusions and feature engineering")
    return FeatureGroups(numerical, categorical)


def _tree_preprocessor(groups: FeatureGroups) -> ColumnTransformer:
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)),
    ])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
        ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1, encoded_missing_value=-2)),
    ])
    return ColumnTransformer(
        [("num", numeric, groups.numerical), ("cat", categorical, groups.categorical)],
        remainder="drop",
        verbose_feature_names_out=True,
    )


def _baseline_preprocessor(groups: FeatureGroups) -> ColumnTransformer:
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)),
        ("scaler", RobustScaler(with_centering=True, with_scaling=True)),
    ])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
        ("encoder", OneHotEncoder(handle_unknown="ignore", min_frequency=2)),
    ])
    return ColumnTransformer(
        [("num", numeric, groups.numerical), ("cat", categorical, groups.categorical)],
        remainder="drop",
        sparse_threshold=0.30,
        verbose_feature_names_out=True,
    )


def build_baseline(groups: FeatureGroups, config: TrainingConfig) -> Pipeline:
    return Pipeline([
        ("preprocess", _baseline_preprocessor(groups)),
        ("model", LogisticRegression(max_iter=3_000, class_weight="balanced", solver="lbfgs", random_state=config.random_seed)),
    ])


def build_primary(groups: FeatureGroups, config: TrainingConfig, scale_pos_weight: float) -> Pipeline:
    model = XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        n_estimators=config.primary_n_estimators,
        learning_rate=0.045,
        max_depth=4,
        min_child_weight=4,
        subsample=0.85,
        colsample_bytree=0.82,
        reg_alpha=0.15,
        reg_lambda=1.25,
        scale_pos_weight=scale_pos_weight,
        random_state=config.random_seed,
        n_jobs=1,
        tree_method="hist",
    )
    return Pipeline([("preprocess", _tree_preprocessor(groups)), ("model", model)])


def build_challenger(groups: FeatureGroups, config: TrainingConfig) -> Pipeline:
    model = RandomForestClassifier(
        n_estimators=config.challenger_n_estimators,
        max_depth=9,
        min_samples_leaf=6,
        max_features="sqrt",
        class_weight="balanced_subsample",
        random_state=config.random_seed,
        n_jobs=1,
    )
    return Pipeline([("preprocess", _tree_preprocessor(groups)), ("model", model)])
