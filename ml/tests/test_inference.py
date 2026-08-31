from __future__ import annotations

import numpy as np
import pandas as pd

from loanpulse_ml.calibration import PlattCalibrator
from loanpulse_ml.config import TrainingConfig
from loanpulse_ml.features import LoanFeatureEngineer
from loanpulse_ml.inference import InferenceBundle
from loanpulse_ml.models import build_baseline, infer_feature_groups
from loanpulse_ml.ood import PracticalOODDetector


def fitted_bundle() -> InferenceBundle:
    frame = pd.DataFrame({
        "income": [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32],
        "utilization": [.9, .2, .8, .3, .85, .25, .75, .4, .7, .35, .65, .45],
        "segment": ["retail", "health"] * 6,
    })
    target = np.asarray([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0])
    engineer = LoanFeatureEngineer().fit(frame)
    engineered = engineer.transform(frame)
    model = build_baseline(infer_feature_groups(engineered), TrainingConfig()).fit(engineered, target)
    raw = model.predict_proba(engineered)[:, 1]
    calibrator = PlattCalibrator().fit(raw, target)
    return InferenceBundle(engineer, model, calibrator, None, PracticalOODDetector().fit(engineered), list(frame.columns), list(engineered.columns), .5, .15, {})


def test_single_row_inference_accepts_unseen_category_and_null() -> None:
    result = fitted_bundle().predict(pd.DataFrame({"income": [None], "utilization": [12.0], "segment": ["unseen"]}))
    assert len(result) == 1
    assert 0 <= result.iloc[0]["probability_calibrated"] <= 1
    assert result.iloc[0]["confidence"] in {"high", "medium", "low"}


def test_batch_inference_preserves_index_and_feature_order() -> None:
    bundle = fitted_bundle()
    frame = pd.DataFrame({"segment": ["retail", "health"], "utilization": [.5, .6], "income": [17, 19]}, index=[101, 205])
    result = bundle.predict(frame)
    assert list(result.index) == [101, 205]
    assert len(result) == 2


def test_ood_score_increases_for_extreme_values() -> None:
    bundle = fitted_bundle()
    ordinary = bundle.predict(pd.DataFrame({"income": [20], "utilization": [.5], "segment": ["retail"]})).iloc[0]["ood_score"]
    extreme = bundle.predict(pd.DataFrame({"income": [1e12], "utilization": [50], "segment": ["unknown"]})).iloc[0]["ood_score"]
    assert extreme > ordinary
