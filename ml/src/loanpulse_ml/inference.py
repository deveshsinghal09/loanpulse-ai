from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from .calibration import IsotonicCalibrator, PlattCalibrator
from .errors import MissingColumnsError
from .explainability import explain_rows
from .features import LoanFeatureEngineer
from .ood import PracticalOODDetector


def _risk_band(probabilities: np.ndarray) -> np.ndarray:
    return np.select(
        [probabilities >= 0.50, probabilities >= 0.30, probabilities >= 0.12],
        ["critical", "high", "moderate"],
        default="low",
    )


@dataclass
class InferenceBundle:
    feature_engineer: LoanFeatureEngineer
    primary_model: Pipeline
    calibrator: PlattCalibrator | IsotonicCalibrator
    challenger_model: Pipeline | None
    ood_detector: PracticalOODDetector
    required_input_columns: list[str]
    feature_names: list[str]
    decision_threshold: float
    disagreement_threshold: float
    metadata: dict[str, Any]

    def _prepare(self, frame: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(frame, pd.DataFrame):
            raise TypeError("inference input must be a pandas DataFrame")
        if frame.empty:
            raise ValueError("inference input must contain at least one row")
        missing = sorted(set(self.required_input_columns) - set(frame.columns))
        if missing:
            raise MissingColumnsError(f"inference data is missing required columns: {missing}")
        return self.feature_engineer.transform(frame.reindex(columns=self.required_input_columns))

    def predict(self, frame: pd.DataFrame) -> pd.DataFrame:
        engineered = self._prepare(frame)
        raw_probability = self.primary_model.predict_proba(engineered)[:, 1]
        calibrated_probability = np.clip(self.calibrator.predict(raw_probability), 0.0, 1.0)
        if self.challenger_model is not None:
            challenger_probability = self.challenger_model.predict_proba(engineered)[:, 1]
            disagreement = np.abs(calibrated_probability - challenger_probability)
        else:
            challenger_probability = np.full(len(engineered), np.nan)
            disagreement = np.full(len(engineered), np.nan)
        ood_score = self.ood_detector.score_samples(engineered)
        confidence = self.ood_detector.confidence_labels(engineered)
        result = pd.DataFrame(
            {
                "probability_raw": raw_probability,
                "probability_calibrated": calibrated_probability,
                "predicted_default": calibrated_probability >= self.decision_threshold,
                "risk_band": _risk_band(calibrated_probability),
                "challenger_probability": challenger_probability,
                "model_disagreement": disagreement,
                "disagreement_flag": disagreement >= self.disagreement_threshold,
                "ood_score": ood_score,
                "confidence": confidence,
                "automatic_decision_withheld": confidence == "low",
            },
            index=frame.index,
        )
        return result

    def explain(self, frame: pd.DataFrame, top_k: int = 10) -> list[dict[str, Any]]:
        return explain_rows(self.primary_model, self._prepare(frame), top_k=top_k)

