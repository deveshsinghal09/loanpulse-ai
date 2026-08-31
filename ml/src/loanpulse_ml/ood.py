from __future__ import annotations

import numpy as np
import pandas as pd

from .errors import MissingColumnsError


class PracticalOODDetector:
    """Robust-distance percentile plus unseen-category penalty for tabular monitoring."""

    def fit(self, frame: pd.DataFrame) -> "PracticalOODDetector":
        self.columns_ = list(frame.columns)
        self.numeric_columns_ = [column for column in frame.columns if pd.api.types.is_numeric_dtype(frame[column]) and not pd.api.types.is_bool_dtype(frame[column])]
        self.categorical_columns_ = [column for column in frame.columns if column not in self.numeric_columns_]
        if self.numeric_columns_:
            numeric = frame[self.numeric_columns_].apply(pd.to_numeric, errors="coerce")
            self.medians_ = numeric.median().fillna(0.0)
            q1 = numeric.quantile(0.25)
            q3 = numeric.quantile(0.75)
            self.iqrs_ = (q3 - q1).replace(0, 1.0).fillna(1.0)
            distances = self._numeric_distance(numeric)
            self.training_distances_ = np.sort(distances)
        else:
            self.medians_ = pd.Series(dtype=float)
            self.iqrs_ = pd.Series(dtype=float)
            self.training_distances_ = np.zeros(len(frame))
        self.categories_ = {
            column: set(frame[column].dropna().astype(str).tolist())
            for column in self.categorical_columns_
        }
        self.training_missing_rate_ = frame.isna().mean()
        return self

    def _numeric_distance(self, numeric: pd.DataFrame) -> np.ndarray:
        values = numeric.reindex(columns=self.numeric_columns_)
        missing_share = values.isna().mean(axis=1).to_numpy() if len(self.numeric_columns_) else np.zeros(len(values))
        robust_z = values.fillna(self.medians_).sub(self.medians_, axis=1).abs().div(self.iqrs_, axis=1)
        capped = np.minimum(robust_z.to_numpy(dtype=float), 20.0)
        return np.sqrt(np.mean(np.square(capped), axis=1)) + missing_share

    def score_samples(self, frame: pd.DataFrame) -> np.ndarray:
        if not hasattr(self, "columns_"):
            raise RuntimeError("PracticalOODDetector must be fit before scoring")
        missing = sorted(set(self.columns_) - set(frame.columns))
        if missing:
            raise MissingColumnsError(f"OOD scoring data is missing columns: {missing}")
        ordered = frame.reindex(columns=self.columns_)
        if self.numeric_columns_:
            distance = self._numeric_distance(ordered[self.numeric_columns_].apply(pd.to_numeric, errors="coerce"))
            percentile = np.searchsorted(self.training_distances_, distance, side="right") / max(1, len(self.training_distances_))
        else:
            percentile = np.zeros(len(ordered))
        if self.categorical_columns_:
            novelty = np.zeros(len(ordered), dtype=float)
            for column in self.categorical_columns_:
                values = ordered[column]
                known = self.categories_[column]
                novelty += (~values.isna() & ~values.astype(str).isin(known)).to_numpy(dtype=float)
            novelty /= len(self.categorical_columns_)
        else:
            novelty = np.zeros(len(ordered), dtype=float)
        return np.clip(0.82 * percentile + 0.18 * novelty, 0.0, 1.0)

    def confidence_labels(self, frame: pd.DataFrame) -> np.ndarray:
        scores = self.score_samples(frame)
        return np.where(scores >= 0.985, "low", np.where(scores >= 0.95, "medium", "high"))
