from __future__ import annotations

import pandas as pd
import pytest

from loanpulse_ml.config import RatioFeatureConfig, TemporalFeatureConfig, TrainingConfig
from loanpulse_ml.errors import MissingColumnsError, TemporalBoundaryError
from loanpulse_ml.features import LoanFeatureEngineer
from loanpulse_ml.schema import SchemaDetector


def test_missing_configured_columns_are_reported() -> None:
    engineer = LoanFeatureEngineer(ratio_features=[RatioFeatureConfig("dti", "debt", "income")])
    with pytest.raises(MissingColumnsError):
        engineer.fit(pd.DataFrame({"debt": [10.0]}))


def test_feature_order_is_stable_and_non_finite_values_become_missing() -> None:
    train = pd.DataFrame({"income": [10.0, 20.0], "debt": [5.0, 2.0], "segment": ["a", "b"]})
    engineer = LoanFeatureEngineer(ratio_features=[RatioFeatureConfig("dti", "debt", "income")]).fit(train)
    inference = pd.DataFrame({"segment": ["new"], "debt": [1e308], "income": [0.0], "extra": [1]})
    transformed = engineer.transform(inference)
    assert list(transformed.columns) == list(engineer.output_columns_)
    assert pd.isna(transformed.loc[0, "dti"])


def test_temporal_features_reject_future_information() -> None:
    frame = pd.DataFrame({"event_at": ["2026-02-01"], "prediction_at": ["2026-01-01"]})
    engineer = LoanFeatureEngineer(temporal_features=[TemporalFeatureConfig("age", "event_at", "prediction_at")])
    with pytest.raises(TemporalBoundaryError):
        engineer.fit(frame)


def test_schema_does_not_silently_choose_ambiguous_target() -> None:
    frame = pd.DataFrame({"flag_a": [0, 1] * 20, "flag_b": [1, 0] * 20, "amount": range(40)})
    report = SchemaDetector().inspect(frame, TrainingConfig())
    assert report.target_column is None
    assert report.requires_confirmation


def test_schema_marks_post_outcome_fields_as_suspicious() -> None:
    frame = pd.DataFrame({"default": [0, 1] * 20, "charge_off_date": [None, "2026-01-01"] * 20, "income": range(40)})
    report = SchemaDetector().inspect(frame, TrainingConfig(target_column="default"))
    assert "charge_off_date" in {item.column for item in report.suspicious_columns}
