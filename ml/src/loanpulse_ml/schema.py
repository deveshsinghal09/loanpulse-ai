from __future__ import annotations

from dataclasses import asdict, dataclass, field
import re
from typing import Any

import numpy as np
import pandas as pd

from .config import TrainingConfig
from .errors import ConfigurationError


TARGET_NAMES = {
    "target": 1.0,
    "default": 0.98,
    "defaulted": 0.98,
    "is_default": 0.98,
    "loan_status_bad": 0.92,
    "bad_loan": 0.92,
    "performance_target": 0.90,
    "outcome": 0.72,
    "label": 0.72,
}

TIME_TOKENS = ("prediction", "as_of", "snapshot", "observation", "reporting", "application", "origination", "issue", "date", "time", "month")
ID_PATTERN = re.compile(r"(^id$|_id$|^id_|loan[_-]?id|account|member|customer|borrower[_-]?id|uuid|guid)", re.I)
POST_OUTCOME_PATTERN = re.compile(
    r"(recover|recovery|collection|charge[_ -]?off|write[_ -]?off|final[_ -]?status|default[_ -]?date|"
    r"settlement|post[_ -]?default|loss[_ -]?amount|resolution|foreclosure|repossession|paid[_ -]?after)",
    re.I,
)


@dataclass(frozen=True)
class Candidate:
    column: str
    confidence: float
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class SuspiciousColumn:
    column: str
    kind: str
    confidence: float
    reason: str
    recommended_action: str = "exclude_pending_review"


@dataclass
class SchemaReport:
    target_column: str | None
    target_confidence: float
    target_candidates: list[Candidate]
    time_column: str | None
    time_confidence: float
    time_candidates: list[Candidate]
    identifier_columns: list[str]
    numerical_features: list[str]
    categorical_features: list[str]
    date_columns: list[str]
    suspicious_columns: list[SuspiciousColumn]
    excluded_columns: list[str]
    warnings: list[str] = field(default_factory=list)
    requires_confirmation: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _normalized(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _date_parse_ratio(series: pd.Series) -> float:
    if pd.api.types.is_datetime64_any_dtype(series):
        return 1.0
    non_null = series.dropna()
    if non_null.empty or pd.api.types.is_numeric_dtype(series):
        return 0.0
    sample = non_null.astype(str).head(500)
    parsed = pd.to_datetime(sample, errors="coerce", format="mixed", utc=True)
    return float(parsed.notna().mean())


def _is_binary(series: pd.Series) -> bool:
    values = series.dropna().unique()
    return 1 < len(values) <= 2


def _binary_target(series: pd.Series, positive_label: Any) -> pd.Series | None:
    if not _is_binary(series):
        return None
    values = list(series.dropna().unique())
    if positive_label in values:
        return (series == positive_label).astype(float)
    normalized = {str(value).strip().lower(): value for value in values}
    for token in ("1", "true", "yes", "default", "bad", "charged off", "charge_off"):
        if token in normalized:
            return (series == normalized[token]).astype(float)
    return None


class SchemaDetector:
    """Deterministic schema inference that reports ambiguity instead of hiding it."""

    def inspect(self, frame: pd.DataFrame, config: TrainingConfig | None = None) -> SchemaReport:
        if frame.empty:
            raise ConfigurationError("cannot inspect an empty dataset")
        config = config or TrainingConfig()
        config.validate()
        columns = list(frame.columns)
        warnings: list[str] = []

        target_candidates = self._target_candidates(frame)
        target, target_confidence = self._resolve_target(columns, target_candidates, config)
        if target is None:
            warnings.append("Target inference is ambiguous. Set target_column explicitly before training.")

        identifiers = self._identifier_columns(frame, target, config)
        time_candidates, date_columns = self._time_candidates(frame)
        time_column, time_confidence = self._resolve_time(columns, time_candidates, config)
        if time_candidates and time_column is None:
            warnings.append("One or more date-like columns exist, but no prediction-time field was selected. Configure time_column to enable chronological validation.")

        suspicious = self._suspicious_columns(frame, target, time_column, config)
        configured_drop = set(config.drop_columns)
        if config.suspicious_column_policy == "exclude":
            configured_drop.update(item.column for item in suspicious)
        excluded = sorted(set(identifiers) | configured_drop | ({target} if target else set()))

        feature_pool = config.include_columns or [column for column in columns if column not in excluded]
        unknown_includes = sorted(set(feature_pool) - set(columns))
        if unknown_includes:
            raise ConfigurationError(f"configured include_columns are missing: {unknown_includes}")

        numerical: list[str] = []
        categorical: list[str] = []
        date_set = set(date_columns)
        for column in feature_pool:
            if column in excluded or column in date_set:
                continue
            if pd.api.types.is_numeric_dtype(frame[column]) and not pd.api.types.is_bool_dtype(frame[column]):
                numerical.append(column)
            else:
                categorical.append(column)

        if time_column and time_column not in date_set:
            date_columns.append(time_column)

        return SchemaReport(
            target_column=target,
            target_confidence=target_confidence,
            target_candidates=target_candidates,
            time_column=time_column,
            time_confidence=time_confidence,
            time_candidates=time_candidates,
            identifier_columns=identifiers,
            numerical_features=sorted(numerical),
            categorical_features=sorted(categorical),
            date_columns=sorted(set(date_columns)),
            suspicious_columns=suspicious,
            excluded_columns=excluded,
            warnings=warnings,
            requires_confirmation=target is None,
        )

    def _target_candidates(self, frame: pd.DataFrame) -> list[Candidate]:
        candidates: list[Candidate] = []
        for column in frame.columns:
            normalized = _normalized(column)
            reasons: list[str] = []
            confidence = TARGET_NAMES.get(normalized, 0.0)
            if confidence:
                reasons.append("recognized target name")
            if _is_binary(frame[column]):
                confidence = max(confidence, 0.58)
                reasons.append("binary cardinality")
            if reasons:
                candidates.append(Candidate(column, round(confidence, 3), tuple(reasons)))
        return sorted(candidates, key=lambda item: (-item.confidence, item.column))

    def _resolve_target(self, columns: list[str], candidates: list[Candidate], config: TrainingConfig) -> tuple[str | None, float]:
        if config.target_column:
            if config.target_column not in columns:
                raise ConfigurationError(f"configured target_column is missing: {config.target_column}")
            return config.target_column, 1.0
        if not candidates:
            return None, 0.0
        top = candidates[0]
        if top.confidence >= 0.90:
            tied = [item for item in candidates if item.confidence == top.confidence]
            return (top.column, top.confidence) if len(tied) == 1 else (None, top.confidence)
        binary = [item for item in candidates if item.confidence >= 0.58]
        return (binary[0].column, 0.58) if len(binary) == 1 else (None, top.confidence)

    def _identifier_columns(self, frame: pd.DataFrame, target: str | None, config: TrainingConfig) -> list[str]:
        configured = set(config.id_columns)
        missing = sorted(configured - set(frame.columns))
        if missing:
            raise ConfigurationError(f"configured id_columns are missing: {missing}")
        for column in frame.columns:
            if column == target:
                continue
            uniqueness = frame[column].nunique(dropna=True) / max(1, frame[column].notna().sum())
            if ID_PATTERN.search(_normalized(column)) and uniqueness >= 0.80:
                configured.add(column)
            elif uniqueness >= 0.995 and not pd.api.types.is_float_dtype(frame[column]):
                configured.add(column)
        return sorted(configured)

    def _time_candidates(self, frame: pd.DataFrame) -> tuple[list[Candidate], list[str]]:
        candidates: list[Candidate] = []
        date_columns: list[str] = []
        for column in frame.columns:
            ratio = _date_parse_ratio(frame[column])
            if ratio < 0.80:
                continue
            date_columns.append(column)
            normalized = _normalized(column)
            token_hits = [token for token in TIME_TOKENS if token in normalized]
            confidence = min(1.0, 0.52 + 0.04 * len(token_hits) + (0.20 if any(token in normalized for token in ("prediction", "as_of", "snapshot", "observation")) else 0.0))
            reasons = (f"{ratio:.0%} parseable as datetime",) + tuple(f"name contains '{token}'" for token in token_hits[:3])
            candidates.append(Candidate(column, round(confidence, 3), reasons))
        return sorted(candidates, key=lambda item: (-item.confidence, item.column)), date_columns

    def _resolve_time(self, columns: list[str], candidates: list[Candidate], config: TrainingConfig) -> tuple[str | None, float]:
        configured = config.time_column or config.prediction_time_column
        if configured:
            if configured not in columns:
                raise ConfigurationError(f"configured time column is missing: {configured}")
            return configured, 1.0
        if not candidates:
            return None, 0.0
        top = candidates[0]
        margin = top.confidence - (candidates[1].confidence if len(candidates) > 1 else 0.0)
        if top.confidence >= 0.75 and margin >= 0.10:
            return top.column, top.confidence
        return None, top.confidence

    def _suspicious_columns(
        self,
        frame: pd.DataFrame,
        target: str | None,
        time_column: str | None,
        config: TrainingConfig,
    ) -> list[SuspiciousColumn]:
        suspicious: dict[str, SuspiciousColumn] = {}
        for column in frame.columns:
            if column == target or column in config.id_columns:
                continue
            if POST_OUTCOME_PATTERN.search(_normalized(column)):
                suspicious[column] = SuspiciousColumn(
                    column,
                    "post_outcome_name",
                    0.95,
                    "Column name indicates information commonly created during collections, charge-off, recovery, or final resolution.",
                )

        if target:
            encoded = _binary_target(frame[target], config.positive_label)
            if encoded is not None:
                for column in frame.columns:
                    if column == target or column in suspicious:
                        continue
                    series = frame[column]
                    overlap = series.notna() & encoded.notna()
                    if overlap.sum() < 20:
                        continue
                    if _is_binary(series):
                        mapped = pd.factorize(series[overlap])[0]
                        agreement = max(float(np.mean(mapped == encoded[overlap])), float(np.mean(1 - mapped == encoded[overlap])))
                        if agreement >= 0.995:
                            suspicious[column] = SuspiciousColumn(column, "target_proxy", agreement, "Binary feature nearly reproduces the target.")
                    elif pd.api.types.is_numeric_dtype(series):
                        numeric = pd.to_numeric(series[overlap], errors="coerce")
                        valid = numeric.notna()
                        if valid.sum() >= 20 and numeric[valid].nunique() > 1:
                            correlation = abs(float(np.corrcoef(numeric[valid], encoded[overlap][valid])[0, 1]))
                            if np.isfinite(correlation) and correlation >= 0.98:
                                suspicious[column] = SuspiciousColumn(column, "target_correlation", correlation, "Feature is almost perfectly correlated with the target.")

        if time_column:
            prediction_time = pd.to_datetime(frame[time_column], errors="coerce", utc=True)
            for column in frame.columns:
                if column == time_column or column in suspicious:
                    continue
                normalized = _normalized(column)
                if not any(token in normalized for token in ("date", "time", "timestamp")):
                    continue
                candidate_time = pd.to_datetime(frame[column], errors="coerce", utc=True)
                valid = prediction_time.notna() & candidate_time.notna()
                if valid.sum() and float((candidate_time[valid] > prediction_time[valid]).mean()) >= 0.05:
                    share = float((candidate_time[valid] > prediction_time[valid]).mean())
                    suspicious[column] = SuspiciousColumn(column, "temporal_availability", min(0.99, 0.75 + share), f"{share:.1%} of values occur after the prediction timestamp.")

        return sorted(suspicious.values(), key=lambda item: (-item.confidence, item.column))
