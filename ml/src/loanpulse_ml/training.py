from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .artifacts import persist_training_run
from .calibration import CalibrationSelector
from .config import TrainingConfig
from .errors import SchemaAmbiguityError, ValidationError
from .explainability import compute_shap_summary, transformed_feature_names
from .features import LoanFeatureEngineer
from .inference import InferenceBundle
from .metrics import classification_metrics
from .models import build_baseline, build_challenger, build_primary, infer_feature_groups
from .ood import PracticalOODDetector
from .profiling import profile_dataset
from .schema import SchemaDetector
from .splitting import make_validation_split


@dataclass(frozen=True)
class TrainingResult:
    run_directory: str
    metrics: dict[str, Any]
    schema: dict[str, Any]
    profile: dict[str, Any]
    metadata: dict[str, Any]


def _encode_target(series: pd.Series, positive_label: Any) -> pd.Series:
    if series.isna().any():
        raise ValidationError("target contains missing values; resolve them explicitly before training")
    values = list(series.unique())
    if len(values) != 2:
        raise ValidationError(f"binary classification requires exactly two target values; found {len(values)}")
    if positive_label in values:
        return (series == positive_label).astype(int)
    normalized = {str(value).strip().lower(): value for value in values}
    for token in ("1", "true", "yes", "default", "bad", "charged off", "charge_off"):
        if token in normalized:
            return (series == normalized[token]).astype(int)
    raise ValidationError("positive target label is ambiguous; set positive_label explicitly")


def _input_columns(frame: pd.DataFrame, schema: Any, config: TrainingConfig) -> list[str]:
    columns = list(config.include_columns or (schema.numerical_features + schema.categorical_features))
    for feature in config.ratio_features:
        columns.extend((feature.numerator, feature.denominator))
    for feature in config.temporal_features:
        columns.extend((feature.source_column, feature.reference_column))
    excluded = set(schema.excluded_columns) | {schema.target_column}
    ordered = [column for column in dict.fromkeys(columns) if column in frame.columns and column not in excluded]
    if not ordered:
        raise ValidationError("no eligible model input columns remain")
    return ordered


def train_model(
    frame: pd.DataFrame,
    config: TrainingConfig | None = None,
    artifact_root: str | Path = "artifacts",
) -> TrainingResult:
    """Train, calibrate, evaluate, explain, and persist a reproducible binary PD model."""
    config = config or TrainingConfig()
    config.validate()
    schema = SchemaDetector().inspect(frame, config)
    if not schema.target_column:
        raise SchemaAmbiguityError("target inference requires confirmation; set target_column in the training configuration")
    if config.suspicious_column_policy == "error" and schema.suspicious_columns:
        columns = ", ".join(item.column for item in schema.suspicious_columns)
        raise ValidationError(f"suspicious leakage columns require review: {columns}")

    profile = profile_dataset(frame, schema)
    target = _encode_target(frame[schema.target_column], config.positive_label)
    split = make_validation_split(frame, target, schema.time_column, config)
    required_columns = _input_columns(frame, schema, config)
    raw_features = frame.reindex(columns=required_columns)
    date_columns = [column for column in schema.date_columns if column in required_columns]
    engineer = LoanFeatureEngineer(config.ratio_features, config.temporal_features, date_columns)

    train_raw = raw_features.iloc[split.train_index]
    validation_raw = raw_features.iloc[split.validation_index]
    test_raw = raw_features.iloc[split.test_index]
    y_train = target.iloc[split.train_index].to_numpy(dtype=int)
    y_validation = target.iloc[split.validation_index].to_numpy(dtype=int)
    y_test = target.iloc[split.test_index].to_numpy(dtype=int)
    train_features = engineer.fit_transform(train_raw)
    validation_features = engineer.transform(validation_raw)
    test_features = engineer.transform(test_raw)
    groups = infer_feature_groups(train_features)

    baseline = build_baseline(groups, config).fit(train_features, y_train)
    positives = max(1, int(y_train.sum()))
    scale_pos_weight = max(1.0, float((len(y_train) - positives) / positives))
    primary = build_primary(groups, config, scale_pos_weight).fit(train_features, y_train)
    challenger = build_challenger(groups, config).fit(train_features, y_train) if config.enable_challenger else None

    validation_raw_pd = primary.predict_proba(validation_features)[:, 1]
    selector = CalibrationSelector(config.isotonic_min_samples, config.isotonic_min_improvement).fit(
        validation_raw_pd, y_validation, config.decision_threshold
    )
    test_raw_pd = primary.predict_proba(test_features)[:, 1]
    test_calibrated_pd = selector.predict(test_raw_pd)
    baseline_pd = baseline.predict_proba(test_features)[:, 1]
    metrics: dict[str, Any] = {
        "baseline_test": classification_metrics(y_test, baseline_pd, config.decision_threshold),
        "primary_uncalibrated_test": classification_metrics(y_test, test_raw_pd, config.decision_threshold),
        "primary_calibrated_test": classification_metrics(y_test, test_calibrated_pd, config.decision_threshold),
        "calibration_selection": selector.report_.to_dict(),
    }
    if challenger is not None:
        challenger_pd = challenger.predict_proba(test_features)[:, 1]
        disagreement = np.abs(test_calibrated_pd - challenger_pd)
        metrics["challenger_test"] = classification_metrics(y_test, challenger_pd, config.decision_threshold)
        metrics["model_disagreement"] = {
            "mean_absolute_probability_gap": float(disagreement.mean()),
            "p95_probability_gap": float(np.quantile(disagreement, .95)),
            "flag_rate": float((disagreement >= config.disagreement_threshold).mean()),
            "threshold": config.disagreement_threshold,
        }

    ood = PracticalOODDetector().fit(train_features)
    shap_summary = compute_shap_summary(primary, train_features, config.shap_sample_size, config.random_seed) if config.compute_shap else None
    metadata = {
        "split": split.metadata.to_dict(),
        "rows": int(len(frame)),
        "positive_rate": float(target.mean()),
        "required_input_columns": required_columns,
        "engineered_feature_columns": list(train_features.columns),
        "primary_model": "XGBoost",
        "baseline_model": "LogisticRegression",
        "challenger_model": "RandomForest" if challenger is not None else None,
        "calibration_method": selector.selected_method_,
        "prediction_time_safe": True,
    }
    bundle = InferenceBundle(
        feature_engineer=engineer,
        primary_model=primary,
        calibrator=selector.selected_calibrator,
        challenger_model=challenger,
        ood_detector=ood,
        required_input_columns=required_columns,
        feature_names=transformed_feature_names(primary),
        decision_threshold=config.decision_threshold,
        disagreement_threshold=config.disagreement_threshold,
        metadata=metadata,
    )
    leakage_report = [asdict(item) for item in schema.suspicious_columns]
    run_directory = persist_training_run(
        artifact_root, bundle, config, metrics, metadata, schema.to_dict(), profile.to_dict(), leakage_report, shap_summary
    )
    return TrainingResult(str(run_directory), metrics, schema.to_dict(), profile.to_dict(), metadata)
