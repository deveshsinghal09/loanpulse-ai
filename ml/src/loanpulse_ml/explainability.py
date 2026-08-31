from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.pipeline import Pipeline


def transformed_feature_names(model_pipeline: Pipeline) -> list[str]:
    preprocessor = model_pipeline.named_steps["preprocess"]
    return [str(name) for name in preprocessor.get_feature_names_out()]


def _normalize_shap_values(values: Any) -> np.ndarray:
    array = np.asarray(values)
    if array.ndim == 3:
        return array[:, :, 1]
    if array.ndim != 2:
        raise ValueError(f"unexpected SHAP value shape: {array.shape}")
    return array


def compute_shap_summary(model_pipeline: Pipeline, engineered_frame: pd.DataFrame, sample_size: int = 500, random_seed: int = 42) -> dict[str, Any]:
    if len(engineered_frame) > sample_size:
        sample = engineered_frame.sample(sample_size, random_state=random_seed)
    else:
        sample = engineered_frame
    transformed = model_pipeline.named_steps["preprocess"].transform(sample)
    model = model_pipeline.named_steps["model"]
    names = transformed_feature_names(model_pipeline)
    explainer = shap.TreeExplainer(model, feature_perturbation="tree_path_dependent", model_output="raw")
    explanation = explainer(transformed)
    values = _normalize_shap_values(explanation.values)
    mean_absolute = np.mean(np.abs(values), axis=0)
    order = np.argsort(mean_absolute)[::-1]
    return {
        "method": "TreeSHAP",
        "model_output": "raw_margin",
        "sample_rows": int(len(sample)),
        "global_importance": [
            {"feature": names[index], "mean_absolute_shap": float(mean_absolute[index])}
            for index in order
        ],
    }


def explain_rows(model_pipeline: Pipeline, engineered_frame: pd.DataFrame, top_k: int = 10) -> list[dict[str, Any]]:
    transformed = model_pipeline.named_steps["preprocess"].transform(engineered_frame)
    model = model_pipeline.named_steps["model"]
    names = transformed_feature_names(model_pipeline)
    explanation = shap.TreeExplainer(model, feature_perturbation="tree_path_dependent", model_output="raw")(transformed)
    values = _normalize_shap_values(explanation.values)
    results: list[dict[str, Any]] = []
    for row_values in values:
        order = np.argsort(np.abs(row_values))[::-1][:top_k]
        results.append({
            "base_value": float(np.asarray(explanation.base_values).reshape(-1)[0]),
            "drivers": [
                {
                    "feature": names[index],
                    "shap_value": float(row_values[index]),
                    "direction": "adverse" if row_values[index] > 0 else "protective",
                }
                for index in order
            ],
        })
    return results
