from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
from pathlib import Path
from typing import Any, Literal

import yaml

from .errors import ConfigurationError


@dataclass(frozen=True)
class RatioFeatureConfig:
    name: str
    numerator: str
    denominator: str
    clip_min: float | None = None
    clip_max: float | None = None


@dataclass(frozen=True)
class TemporalFeatureConfig:
    name: str
    source_column: str
    reference_column: str
    unit: Literal["days", "months", "years"] = "days"
    future_policy: Literal["error", "mask"] = "error"


@dataclass
class TrainingConfig:
    target_column: str | None = None
    positive_label: Any = 1
    time_column: str | None = None
    prediction_time_column: str | None = None
    id_columns: list[str] = field(default_factory=list)
    include_columns: list[str] = field(default_factory=list)
    drop_columns: list[str] = field(default_factory=list)
    suspicious_column_policy: Literal["exclude", "warn", "error"] = "exclude"
    ratio_features: list[RatioFeatureConfig] = field(default_factory=list)
    temporal_features: list[TemporalFeatureConfig] = field(default_factory=list)
    train_fraction: float = 0.60
    validation_fraction: float = 0.20
    test_fraction: float = 0.20
    random_seed: int = 42
    decision_threshold: float = 0.50
    disagreement_threshold: float = 0.15
    isotonic_min_samples: int = 1_000
    isotonic_min_improvement: float = 0.002
    enable_challenger: bool = True
    compute_shap: bool = True
    shap_sample_size: int = 500
    primary_n_estimators: int = 220
    challenger_n_estimators: int = 240

    def validate(self) -> None:
        total = self.train_fraction + self.validation_fraction + self.test_fraction
        if abs(total - 1.0) > 1e-9:
            raise ConfigurationError("train, validation, and test fractions must sum to 1.0")
        if min(self.train_fraction, self.validation_fraction, self.test_fraction) <= 0:
            raise ConfigurationError("all split fractions must be positive")
        if not 0 < self.decision_threshold < 1:
            raise ConfigurationError("decision_threshold must be between 0 and 1")
        if self.include_columns and self.drop_columns:
            overlap = sorted(set(self.include_columns) & set(self.drop_columns))
            if overlap:
                raise ConfigurationError(f"columns cannot be both included and dropped: {overlap}")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save(self, path: str | Path) -> None:
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(self.to_dict(), indent=2, default=str), encoding="utf-8")

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "TrainingConfig":
        payload = dict(payload)
        payload["ratio_features"] = [RatioFeatureConfig(**item) for item in payload.get("ratio_features", [])]
        payload["temporal_features"] = [TemporalFeatureConfig(**item) for item in payload.get("temporal_features", [])]
        config = cls(**payload)
        config.validate()
        return config

    @classmethod
    def load(cls, path: str | Path) -> "TrainingConfig":
        source = Path(path)
        text = source.read_text(encoding="utf-8")
        payload = yaml.safe_load(text) if source.suffix.lower() in {".yaml", ".yml"} else json.loads(text)
        if not isinstance(payload, dict):
            raise ConfigurationError("configuration root must be a mapping")
        return cls.from_dict(payload)
