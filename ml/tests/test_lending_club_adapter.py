from __future__ import annotations

import importlib.util
from pathlib import Path

import pandas as pd


SCRIPT_PATH = Path(__file__).parents[2] / "scripts" / "prepare_lending_club.py"
SPEC = importlib.util.spec_from_file_location("prepare_lending_club", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def source_frame() -> pd.DataFrame:
    rows = []
    for identifier, status in (("1", "Fully Paid"), ("2", "Charged Off"), ("3", "Current")):
        row = {column: None for column in MODULE.SOURCE_COLUMNS}
        row.update({
            "id": identifier,
            "loan_status": status,
            "issue_d": "Jan-2018",
            "earliest_cr_line": "Jan-2008",
            "loan_amnt": 10000,
            "term": " 36 months",
            "int_rate": 12.5,
            "installment": 350,
            "annual_inc": 70000,
            "dti": 25,
            "revol_util": 40,
            "fico_range_low": 680,
            "fico_range_high": 684,
        })
        rows.append(row)
    return pd.DataFrame(rows)


def test_adapter_keeps_only_mature_outcomes() -> None:
    prepared = MODULE.transform_chunk(source_frame())
    assert list(prepared["defaulted"]) == [0, 1]
    assert set(prepared["loan_id"]) == {"1", "2"}


def test_adapter_normalizes_scenario_features() -> None:
    prepared = MODULE.transform_chunk(source_frame()).iloc[0]
    assert prepared["interest_rate"] == 0.125
    assert prepared["dti"] == 0.25
    assert prepared["revolving_utilization"] == 0.40
    assert round(prepared["payment_burden"], 3) == 0.06
    assert prepared["credit_history_years"] > 9.9


def test_adapter_never_emits_post_outcome_fields() -> None:
    prepared = MODULE.transform_chunk(source_frame())
    forbidden_tokens = ("recover", "settlement", "last_payment", "loan_status", "hardship")
    assert not any(token in column for column in prepared.columns for token in forbidden_tokens)
