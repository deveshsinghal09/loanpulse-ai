from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)


def expected_calibration_error(y_true: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> float:
    y = np.asarray(y_true, dtype=float)
    p = np.clip(np.asarray(probabilities, dtype=float), 0.0, 1.0)
    boundaries = np.linspace(0.0, 1.0, bins + 1)
    total = len(y)
    error = 0.0
    for index in range(bins):
        lower, upper = boundaries[index], boundaries[index + 1]
        mask = (p >= lower) & (p < upper if index < bins - 1 else p <= upper)
        if not mask.any():
            continue
        error += float(mask.mean()) * abs(float(y[mask].mean()) - float(p[mask].mean()))
    return error if total else float("nan")


def classification_metrics(y_true: np.ndarray, probabilities: np.ndarray, threshold: float = 0.5) -> dict[str, Any]:
    y = np.asarray(y_true, dtype=int)
    p = np.clip(np.asarray(probabilities, dtype=float), 1e-7, 1 - 1e-7)
    predicted = (p >= threshold).astype(int)
    matrix = confusion_matrix(y, predicted, labels=[0, 1])
    return {
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "precision": float(precision_score(y, predicted, zero_division=0)),
        "recall": float(recall_score(y, predicted, zero_division=0)),
        "f1": float(f1_score(y, predicted, zero_division=0)),
        "log_loss": float(log_loss(y, p, labels=[0, 1])),
        "brier_score": float(brier_score_loss(y, p)),
        "expected_calibration_error": float(expected_calibration_error(y, p)),
        "threshold": float(threshold),
        "confusion_matrix": {
            "true_negative": int(matrix[0, 0]),
            "false_positive": int(matrix[0, 1]),
            "false_negative": int(matrix[1, 0]),
            "true_positive": int(matrix[1, 1]),
        },
        "positive_rate": float(y.mean()),
        "predicted_positive_rate": float(predicted.mean()),
    }


def reliability_curve(y_true: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict[str, float | int]]:
    y = np.asarray(y_true, dtype=float)
    p = np.asarray(probabilities, dtype=float)
    boundaries = np.linspace(0.0, 1.0, bins + 1)
    curve: list[dict[str, float | int]] = []
    for index in range(bins):
        lower, upper = boundaries[index], boundaries[index + 1]
        mask = (p >= lower) & (p < upper if index < bins - 1 else p <= upper)
        if mask.any():
            curve.append({
                "bin_lower": float(lower),
                "bin_upper": float(upper),
                "mean_predicted": float(p[mask].mean()),
                "observed_rate": float(y[mask].mean()),
                "count": int(mask.sum()),
            })
    return curve

