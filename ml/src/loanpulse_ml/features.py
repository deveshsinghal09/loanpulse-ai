from __future__ import annotations

from dataclasses import asdict
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

from .config import RatioFeatureConfig, TemporalFeatureConfig
from .errors import MissingColumnsError, TemporalBoundaryError


class LoanFeatureEngineer(BaseEstimator, TransformerMixin):
    """Prediction-time-safe, deterministic feature engineering for tabular loan snapshots."""

    def __init__(
        self,
        ratio_features: list[RatioFeatureConfig] | None = None,
        temporal_features: list[TemporalFeatureConfig] | None = None,
        drop_date_columns: list[str] | None = None,
        add_missingness_score: bool = True,
    ) -> None:
        self.ratio_features = ratio_features or []
        self.temporal_features = temporal_features or []
        self.drop_date_columns = drop_date_columns or []
        self.add_missingness_score = add_missingness_score

    def fit(self, X: pd.DataFrame, y: Any = None) -> "LoanFeatureEngineer":
        if not isinstance(X, pd.DataFrame):
            raise TypeError("LoanFeatureEngineer requires a pandas DataFrame")
        self.input_columns_ = list(X.columns)
        required = set()
        for feature in self.ratio_features:
            required.update((feature.numerator, feature.denominator))
        for feature in self.temporal_features:
            required.update((feature.source_column, feature.reference_column))
        missing = sorted(required - set(X.columns))
        if missing:
            raise MissingColumnsError(f"configured feature engineering columns are missing: {missing}")
        transformed = self._transform(X, fitting=True)
        self.output_columns_ = list(transformed.columns)
        self.lineage_ = self._lineage()
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if not hasattr(self, "input_columns_"):
            raise RuntimeError("LoanFeatureEngineer must be fit before transform")
        if not isinstance(X, pd.DataFrame):
            raise TypeError("LoanFeatureEngineer requires a pandas DataFrame")
        missing = sorted(set(self.input_columns_) - set(X.columns))
        if missing:
            raise MissingColumnsError(f"inference data is missing required columns: {missing}")
        ordered = X.reindex(columns=self.input_columns_)
        transformed = self._transform(ordered, fitting=False)
        missing_outputs = sorted(set(self.output_columns_) - set(transformed.columns))
        if missing_outputs:
            raise MissingColumnsError(f"engineered features are missing: {missing_outputs}")
        return transformed.reindex(columns=self.output_columns_)

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        if not hasattr(self, "output_columns_"):
            raise RuntimeError("LoanFeatureEngineer must be fit before feature names are available")
        return np.asarray(self.output_columns_, dtype=object)

    def _transform(self, X: pd.DataFrame, fitting: bool) -> pd.DataFrame:
        frame = X.copy()
        base_feature_columns = [column for column in frame.columns if column not in self.drop_date_columns]
        if self.add_missingness_score:
            frame["missingness_score"] = frame[base_feature_columns].isna().mean(axis=1)

        for feature in self.ratio_features:
            numerator = pd.to_numeric(frame[feature.numerator], errors="coerce")
            denominator = pd.to_numeric(frame[feature.denominator], errors="coerce").replace(0, np.nan)
            ratio = numerator / denominator
            if feature.clip_min is not None or feature.clip_max is not None:
                ratio = ratio.clip(lower=feature.clip_min, upper=feature.clip_max)
            frame[feature.name] = ratio.replace([np.inf, -np.inf], np.nan)

        for feature in self.temporal_features:
            source = pd.to_datetime(frame[feature.source_column], errors="coerce", format="mixed", utc=True)
            reference = pd.to_datetime(frame[feature.reference_column], errors="coerce", format="mixed", utc=True)
            future = source.notna() & reference.notna() & (source > reference)
            if future.any() and feature.future_policy == "error":
                examples = list(frame.index[future][:5])
                raise TemporalBoundaryError(
                    f"{feature.source_column} occurs after {feature.reference_column} in {int(future.sum())} rows; example indices: {examples}"
                )
            source = source.mask(future)
            delta_days = (reference - source).dt.total_seconds() / 86_400.0
            divisor = {"days": 1.0, "months": 30.4375, "years": 365.25}[feature.unit]
            frame[feature.name] = delta_days / divisor

        numeric_columns = frame.select_dtypes(include=[np.number]).columns
        frame.loc[:, numeric_columns] = frame.loc[:, numeric_columns].replace([np.inf, -np.inf], np.nan)
        frame = frame.drop(columns=[column for column in self.drop_date_columns if column in frame.columns])
        return frame

    def _lineage(self) -> list[dict[str, Any]]:
        lineage: list[dict[str, Any]] = []
        if self.add_missingness_score:
            lineage.append({"output": "missingness_score", "operation": "row_null_fraction", "prediction_time_safe": True})
        for feature in self.ratio_features:
            lineage.append({"output": feature.name, "operation": "safe_ratio", "inputs": [feature.numerator, feature.denominator], "configuration": asdict(feature), "prediction_time_safe": True})
        for feature in self.temporal_features:
            lineage.append({"output": feature.name, "operation": "elapsed_time", "inputs": [feature.source_column, feature.reference_column], "configuration": asdict(feature), "prediction_time_safe": True})
        if self.drop_date_columns:
            lineage.append({"operation": "drop_raw_date_columns_after_feature_generation", "columns": list(self.drop_date_columns), "prediction_time_safe": True})
        lineage.append({"operation": "replace_non_finite_numeric_values_with_missing", "reason": "downstream imputer handles explicit missing values"})
        return lineage
