from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

from .metrics import classification_metrics, reliability_curve


def _logit(probabilities: np.ndarray) -> np.ndarray:
    clipped = np.clip(np.asarray(probabilities, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(clipped / (1 - clipped)).reshape(-1, 1)


class PlattCalibrator:
    method = "platt"

    def fit(self, probabilities: np.ndarray, y: np.ndarray) -> "PlattCalibrator":
        self.model_ = LogisticRegression(C=1e6, solver="lbfgs", max_iter=2_000, random_state=0)
        self.model_.fit(_logit(probabilities), y)
        return self

    def predict(self, probabilities: np.ndarray) -> np.ndarray:
        return self.model_.predict_proba(_logit(probabilities))[:, 1]


class IsotonicCalibrator:
    method = "isotonic"

    def fit(self, probabilities: np.ndarray, y: np.ndarray) -> "IsotonicCalibrator":
        self.model_ = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        self.model_.fit(np.asarray(probabilities, dtype=float), np.asarray(y, dtype=int))
        return self

    def predict(self, probabilities: np.ndarray) -> np.ndarray:
        return np.asarray(self.model_.predict(np.asarray(probabilities, dtype=float)), dtype=float)


@dataclass(frozen=True)
class CalibrationSelectionReport:
    selected_method: Literal["platt", "isotonic"]
    selection_reason: str
    validation_samples: int
    candidates: dict[str, dict]
    reliability_curves: dict[str, list[dict]]

    def to_dict(self) -> dict:
        return asdict(self)


class CalibrationSelector:
    """Fit Platt and isotonic mappings on validation predictions and select transparently."""

    def __init__(self, isotonic_min_samples: int = 1_000, isotonic_min_improvement: float = 0.002) -> None:
        self.isotonic_min_samples = isotonic_min_samples
        self.isotonic_min_improvement = isotonic_min_improvement

    def fit(self, raw_probabilities: np.ndarray, y: np.ndarray, threshold: float = 0.5) -> "CalibrationSelector":
        raw = np.asarray(raw_probabilities, dtype=float)
        target = np.asarray(y, dtype=int)
        self.platt_ = PlattCalibrator().fit(raw, target)
        self.isotonic_ = IsotonicCalibrator().fit(raw, target)
        candidates = {
            "uncalibrated": classification_metrics(target, raw, threshold),
            "platt": classification_metrics(target, self.platt_.predict(raw), threshold),
            "isotonic": classification_metrics(target, self.isotonic_.predict(raw), threshold),
        }
        curves = {
            "uncalibrated": reliability_curve(target, raw),
            "platt": reliability_curve(target, self.platt_.predict(raw)),
            "isotonic": reliability_curve(target, self.isotonic_.predict(raw)),
        }
        platt_score = candidates["platt"]["brier_score"] + 0.10 * candidates["platt"]["expected_calibration_error"]
        isotonic_score = candidates["isotonic"]["brier_score"] + 0.10 * candidates["isotonic"]["expected_calibration_error"]
        improvement = platt_score - isotonic_score
        if len(target) < self.isotonic_min_samples and improvement < self.isotonic_min_improvement:
            self.selected_method_ = "platt"
            reason = (
                f"Platt selected because validation has {len(target)} rows (< {self.isotonic_min_samples}) and isotonic's "
                f"composite calibration improvement ({improvement:.5f}) is below {self.isotonic_min_improvement:.5f}."
            )
        elif isotonic_score < platt_score:
            self.selected_method_ = "isotonic"
            reason = f"Isotonic selected on lower validation Brier + 0.10×ECE ({isotonic_score:.5f} vs {platt_score:.5f})."
        else:
            self.selected_method_ = "platt"
            reason = f"Platt selected on lower validation Brier + 0.10×ECE ({platt_score:.5f} vs {isotonic_score:.5f})."
        self.report_ = CalibrationSelectionReport(self.selected_method_, reason, len(target), candidates, curves)
        return self

    @property
    def selected_calibrator(self) -> PlattCalibrator | IsotonicCalibrator:
        if not hasattr(self, "selected_method_"):
            raise RuntimeError("CalibrationSelector must be fit before selecting a calibrator")
        return self.isotonic_ if self.selected_method_ == "isotonic" else self.platt_

    def predict(self, probabilities: np.ndarray) -> np.ndarray:
        return self.selected_calibrator.predict(probabilities)
