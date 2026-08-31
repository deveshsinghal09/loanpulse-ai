from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from .config import TrainingConfig
from .errors import ValidationError


@dataclass(frozen=True)
class SplitMetadata:
    strategy: Literal["chronological", "stratified_random"]
    limitation: str | None
    time_column: str | None
    train_rows: int
    validation_rows: int
    test_rows: int
    train_start: str | None
    train_end: str | None
    validation_start: str | None
    validation_end: str | None
    test_start: str | None
    test_end: str | None
    shuffled: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SplitResult:
    train_index: np.ndarray
    validation_index: np.ndarray
    test_index: np.ndarray
    metadata: SplitMetadata


def _period(values: pd.Series, indices: np.ndarray) -> tuple[str | None, str | None]:
    subset = values.iloc[indices].dropna()
    if subset.empty:
        return None, None
    return subset.min().isoformat(), subset.max().isoformat()


def _validate_classes(y: pd.Series, indices: np.ndarray, label: str) -> None:
    if y.iloc[indices].nunique(dropna=True) < 2:
        raise ValidationError(f"{label} split contains only one target class; adjust periods or provide more data")


def make_validation_split(frame: pd.DataFrame, y: pd.Series, time_column: str | None, config: TrainingConfig) -> SplitResult:
    """Prefer strict chronological splits; use stratification only when time is absent or unusable."""
    config.validate()
    if len(frame) < 60:
        raise ValidationError("at least 60 rows are required for train/validation/test evaluation")

    if time_column:
        parsed = pd.to_datetime(frame[time_column], errors="coerce", format="mixed", utc=True)
        parse_rate = float(parsed.notna().mean())
        unique_dates = np.sort(parsed.dropna().unique())
        if parse_rate >= 0.95 and len(unique_dates) >= 5:
            train_cut_position = max(0, min(len(unique_dates) - 3, int(np.floor(len(unique_dates) * config.train_fraction)) - 1))
            validation_cut_position = max(train_cut_position + 1, min(len(unique_dates) - 2, int(np.floor(len(unique_dates) * (config.train_fraction + config.validation_fraction))) - 1))
            train_end = unique_dates[train_cut_position]
            validation_end = unique_dates[validation_cut_position]
            train_index = np.flatnonzero((parsed <= train_end).to_numpy())
            validation_index = np.flatnonzero(((parsed > train_end) & (parsed <= validation_end)).to_numpy())
            test_index = np.flatnonzero((parsed > validation_end).to_numpy())
            if min(len(train_index), len(validation_index), len(test_index)) == 0:
                raise ValidationError("chronological split produced an empty partition; adjust split fractions")
            for label, indices in (("train", train_index), ("validation", validation_index), ("test", test_index)):
                _validate_classes(y, indices, label)
            train_start, train_finish = _period(parsed, train_index)
            validation_start, validation_finish = _period(parsed, validation_index)
            test_start, test_finish = _period(parsed, test_index)
            return SplitResult(
                train_index,
                validation_index,
                test_index,
                SplitMetadata(
                    strategy="chronological",
                    limitation=None,
                    time_column=time_column,
                    train_rows=len(train_index),
                    validation_rows=len(validation_index),
                    test_rows=len(test_index),
                    train_start=train_start,
                    train_end=train_finish,
                    validation_start=validation_start,
                    validation_end=validation_finish,
                    test_start=test_start,
                    test_end=test_finish,
                    shuffled=False,
                ),
            )
        limitation = f"Configured/inferred time column '{time_column}' was unusable for chronological validation ({parse_rate:.1%} parseable, {len(unique_dates)} unique timestamps)."
    else:
        limitation = "No usable prediction-time column was identified. Random stratified validation can overstate real-world performance under temporal drift."

    all_indices = np.arange(len(frame))
    train_index, remainder_index = train_test_split(
        all_indices,
        test_size=config.validation_fraction + config.test_fraction,
        random_state=config.random_seed,
        stratify=y,
    )
    test_share_of_remainder = config.test_fraction / (config.validation_fraction + config.test_fraction)
    validation_index, test_index = train_test_split(
        remainder_index,
        test_size=test_share_of_remainder,
        random_state=config.random_seed,
        stratify=y.iloc[remainder_index],
    )
    return SplitResult(
        np.sort(train_index),
        np.sort(validation_index),
        np.sort(test_index),
        SplitMetadata(
            strategy="stratified_random",
            limitation=limitation,
            time_column=time_column,
            train_rows=len(train_index),
            validation_rows=len(validation_index),
            test_rows=len(test_index),
            train_start=None,
            train_end=None,
            validation_start=None,
            validation_end=None,
            test_start=None,
            test_end=None,
            shuffled=True,
        ),
    )
