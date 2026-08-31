from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from .config import TrainingConfig
from .inference import InferenceBundle


def _json_default(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, (datetime, Path)):
        return str(value)
    raise TypeError(f"cannot serialize {type(value)!r}")


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=_json_default), encoding="utf-8")


def persist_training_run(
    root: str | Path,
    bundle: InferenceBundle,
    config: TrainingConfig,
    metrics: dict[str, Any],
    metadata: dict[str, Any],
    schema: dict[str, Any],
    profile: dict[str, Any],
    leakage_report: list[dict[str, Any]],
    shap_summary: dict[str, Any] | None,
) -> Path:
    artifact_root = Path(root)
    artifact_root.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    digest = hashlib.sha256(json.dumps(config.to_dict(), sort_keys=True, default=str).encode("utf-8")).hexdigest()[:8]
    run_directory = artifact_root / f"run-{timestamp}-{digest}"
    suffix = 1
    while run_directory.exists():
        run_directory = artifact_root / f"run-{timestamp}-{digest}-{suffix}"
        suffix += 1
    run_directory.mkdir(parents=False, exist_ok=False)

    joblib.dump(bundle, run_directory / "inference_bundle.joblib")
    joblib.dump(
        {"feature_engineer": bundle.feature_engineer, "column_preprocessor": bundle.primary_model.named_steps["preprocess"]},
        run_directory / "preprocessing_pipeline.joblib",
    )
    joblib.dump(bundle.primary_model.named_steps["model"], run_directory / "trained_model.joblib")
    joblib.dump(bundle.calibrator, run_directory / "calibrator.joblib")
    joblib.dump(bundle.ood_detector, run_directory / "ood_detector.joblib")
    if bundle.challenger_model is not None:
        joblib.dump(bundle.challenger_model, run_directory / "challenger_pipeline.joblib")

    write_json(run_directory / "feature_names.json", bundle.feature_names)
    write_json(run_directory / "configuration.json", config.to_dict())
    write_json(run_directory / "metrics.json", metrics)
    write_json(run_directory / "training_metadata.json", metadata)
    write_json(run_directory / "schema_report.json", schema)
    write_json(run_directory / "profile_report.json", profile)
    write_json(run_directory / "leakage_report.json", leakage_report)
    write_json(run_directory / "feature_lineage.json", bundle.feature_engineer.lineage_)
    if shap_summary is not None:
        write_json(run_directory / "shap_summary.json", shap_summary)

    write_json(artifact_root / "latest.json", {"run_directory": str(run_directory.resolve()), "created_at": timestamp})
    return run_directory


def load_inference_bundle(path: str | Path) -> InferenceBundle:
    source = Path(path)
    bundle_path = source / "inference_bundle.joblib" if source.is_dir() else source
    bundle = joblib.load(bundle_path)
    if not isinstance(bundle, InferenceBundle):
        raise TypeError(f"artifact does not contain an InferenceBundle: {bundle_path}")
    return bundle
