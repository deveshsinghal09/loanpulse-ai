from __future__ import annotations

from dataclasses import asdict, dataclass
import re
from typing import Any

import numpy as np
import pandas as pd

from .schema import SchemaReport


@dataclass(frozen=True)
class ColumnProfile:
    column: str
    dtype: str
    inferred_role: str
    missing_count: int
    missing_rate: float
    unique_count: int
    unique_rate: float
    constant: bool
    near_constant: bool
    high_cardinality: bool
    invalid_count: int
    outlier_count: int
    minimum: Any = None
    maximum: Any = None
    mean: float | None = None
    median: float | None = None
    top_values: tuple[tuple[str, int], ...] = ()
    notes: tuple[str, ...] = ()


@dataclass
class ProfileReport:
    row_count: int
    column_count: int
    duplicate_rows: int
    duplicate_rate: float
    target_distribution: dict[str, int]
    minority_class_rate: float | None
    temporal_start: str | None
    temporal_end: str | None
    temporal_invalid_count: int
    health_scores: dict[str, float]
    columns: list[ColumnProfile]
    suspicious_columns: list[dict[str, Any]]
    transformations_applied: list[str]
    warnings: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _role(column: str, schema: SchemaReport) -> str:
    if column == schema.target_column:
        return "target"
    if column == schema.time_column:
        return "prediction_time"
    if column in schema.identifier_columns:
        return "identifier"
    if column in schema.date_columns:
        return "date"
    if column in schema.numerical_features:
        return "numerical_feature"
    if column in schema.categorical_features:
        return "categorical_feature"
    if column in schema.excluded_columns:
        return "excluded"
    return "unclassified"


def _impossible_numeric_count(column: str, values: pd.Series) -> tuple[int, list[str]]:
    name = re.sub(r"[^a-z0-9]+", "_", column.lower())
    count = 0
    notes: list[str] = []
    if any(token in name for token in ("amount", "balance", "income", "payment", "exposure", "principal")):
        invalid = values < 0
        count += int(invalid.sum())
        if invalid.any():
            notes.append("negative monetary values")
    if any(token in name for token in ("rate", "ratio", "percent", "utilization", "dti", "ltv")):
        upper = 100 if values.dropna().abs().max() > 2 else 1.5
        invalid = (values < 0) | (values > upper)
        count += int(invalid.sum())
        if invalid.any():
            notes.append(f"values outside expected ratio/rate range [0, {upper}]")
    if any(token in name for token in ("days_past_due", "dpd", "loan_age", "term_month")):
        invalid = values < 0
        count += int(invalid.sum())
        if invalid.any():
            notes.append("negative duration values")
    return count, notes


def _health_scores(frame: pd.DataFrame, profiles: list[ColumnProfile], schema: SchemaReport, duplicate_rate: float, temporal_invalid: int) -> dict[str, float]:
    cells = max(1, frame.shape[0] * frame.shape[1])
    missing = sum(profile.missing_count for profile in profiles)
    invalid = sum(profile.invalid_count for profile in profiles)
    completeness = max(0.0, 1.0 - missing / cells)
    validity = max(0.0, 1.0 - invalid / cells)
    consistency_penalty = sum(1 for profile in profiles if any("inconsistent" in note for note in profile.notes)) / max(1, len(profiles))
    consistency = max(0.0, 1.0 - consistency_penalty)
    uniqueness = max(0.0, 1.0 - duplicate_rate)
    if schema.time_column:
        temporal_coverage = max(0.0, 1.0 - temporal_invalid / max(1, len(frame)))
    else:
        temporal_coverage = 0.0
    data_health = 0.30 * completeness + 0.25 * validity + 0.15 * consistency + 0.15 * uniqueness + 0.15 * temporal_coverage
    return {
        "data_health": round(data_health, 4),
        "completeness": round(completeness, 4),
        "consistency": round(consistency, 4),
        "validity": round(validity, 4),
        "uniqueness": round(uniqueness, 4),
        "temporal_coverage": round(temporal_coverage, 4),
    }


def profile_dataset(frame: pd.DataFrame, schema: SchemaReport) -> ProfileReport:
    """Create a JSON-serializable, non-mutating profile of the supplied dataset."""
    profiles: list[ColumnProfile] = []
    row_count = len(frame)
    for column in frame.columns:
        series = frame[column]
        non_null = series.dropna()
        unique_count = int(non_null.nunique())
        unique_rate = unique_count / max(1, len(non_null))
        top = non_null.astype(str).value_counts().head(5)
        top_values = tuple((str(key), int(value)) for key, value in top.items())
        dominant_rate = float(top.iloc[0] / max(1, len(non_null))) if len(top) else 0.0
        notes: list[str] = []
        invalid_count = 0
        outlier_count = 0
        minimum: Any = None
        maximum: Any = None
        mean: float | None = None
        median: float | None = None

        if column in schema.date_columns:
            parsed = pd.to_datetime(series, errors="coerce", format="mixed", utc=True)
            invalid_count = int((series.notna() & parsed.isna()).sum())
            if parsed.notna().any():
                minimum = parsed.min().isoformat()
                maximum = parsed.max().isoformat()
            if invalid_count:
                notes.append("invalid date values")
        elif pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            numeric = pd.to_numeric(series, errors="coerce").astype(float)
            finite = numeric.replace([np.inf, -np.inf], np.nan).dropna()
            invalid_count = int((series.notna() & ~np.isfinite(numeric)).sum())
            if not finite.empty:
                minimum = float(finite.min())
                maximum = float(finite.max())
                mean = float(finite.mean())
                median = float(finite.median())
                q1, q3 = finite.quantile([0.25, 0.75])
                iqr = q3 - q1
                if iqr > 0:
                    outlier_count = int(((finite < q1 - 3 * iqr) | (finite > q3 + 3 * iqr)).sum())
                impossible_count, impossible_notes = _impossible_numeric_count(column, finite)
                invalid_count += impossible_count
                notes.extend(impossible_notes)
            if invalid_count:
                notes.append("non-finite or impossible numerical values")
        elif len(non_null):
            canonical = non_null.astype(str).str.strip().str.casefold()
            if canonical.nunique() < unique_count:
                notes.append("categorical inconsistencies after case/whitespace normalization")

        profiles.append(
            ColumnProfile(
                column=column,
                dtype=str(series.dtype),
                inferred_role=_role(column, schema),
                missing_count=int(series.isna().sum()),
                missing_rate=round(float(series.isna().mean()), 6),
                unique_count=unique_count,
                unique_rate=round(unique_rate, 6),
                constant=unique_count <= 1,
                near_constant=dominant_rate >= 0.995,
                high_cardinality=unique_count >= 100 and unique_rate >= 0.50,
                invalid_count=invalid_count,
                outlier_count=outlier_count,
                minimum=minimum,
                maximum=maximum,
                mean=mean,
                median=median,
                top_values=top_values,
                notes=tuple(dict.fromkeys(notes)),
            )
        )

    duplicate_rows = int(frame.duplicated().sum())
    duplicate_rate = duplicate_rows / max(1, row_count)
    target_distribution: dict[str, int] = {}
    minority_rate: float | None = None
    if schema.target_column:
        counts = frame[schema.target_column].value_counts(dropna=False)
        target_distribution = {str(key): int(value) for key, value in counts.items()}
        non_missing_counts = frame[schema.target_column].dropna().value_counts()
        if len(non_missing_counts) >= 2:
            minority_rate = float(non_missing_counts.min() / non_missing_counts.sum())

    temporal_start: str | None = None
    temporal_end: str | None = None
    temporal_invalid = 0
    if schema.time_column:
        parsed_time = pd.to_datetime(frame[schema.time_column], errors="coerce", format="mixed", utc=True)
        temporal_invalid = int((frame[schema.time_column].notna() & parsed_time.isna()).sum())
        if parsed_time.notna().any():
            temporal_start = parsed_time.min().isoformat()
            temporal_end = parsed_time.max().isoformat()

    warnings = list(schema.warnings)
    if minority_rate is not None and minority_rate < 0.10:
        warnings.append(f"Target is imbalanced; minority class rate is {minority_rate:.1%}. Accuracy is not an appropriate primary metric.")
    if duplicate_rows:
        warnings.append(f"Dataset contains {duplicate_rows} exact duplicate rows. No rows were removed automatically.")
    if any(profile.constant for profile in profiles):
        warnings.append("One or more constant columns were identified and should be excluded before modeling.")

    return ProfileReport(
        row_count=row_count,
        column_count=frame.shape[1],
        duplicate_rows=duplicate_rows,
        duplicate_rate=round(duplicate_rate, 6),
        target_distribution=target_distribution,
        minority_class_rate=minority_rate,
        temporal_start=temporal_start,
        temporal_end=temporal_end,
        temporal_invalid_count=temporal_invalid,
        health_scores=_health_scores(frame, profiles, schema, duplicate_rate, temporal_invalid),
        columns=profiles,
        suspicious_columns=[asdict(item) for item in schema.suspicious_columns],
        transformations_applied=["None. Profiling is read-only; proposed exclusions and issues are reported without silently cleaning data."],
        warnings=warnings,
    )
