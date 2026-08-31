"""Prepare the CC0 Lending Club dataset for prediction-time-safe training."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd


DATASET_HANDLE = "wordsforthewise/lending-club"
SOURCE_FILENAME = "accepted_2007_to_2018Q4.csv.gz"
LICENSE = "CC0-1.0"

PERFORMING_STATUSES = {
    "Fully Paid",
    "Does not meet the credit policy. Status:Fully Paid",
}
DEFAULT_STATUSES = {
    "Charged Off",
    "Default",
    "Does not meet the credit policy. Status:Charged Off",
}

SOURCE_COLUMNS = [
    "id",
    "loan_amnt",
    "term",
    "int_rate",
    "installment",
    "grade",
    "sub_grade",
    "emp_length",
    "home_ownership",
    "annual_inc",
    "verification_status",
    "issue_d",
    "loan_status",
    "purpose",
    "addr_state",
    "dti",
    "delinq_2yrs",
    "earliest_cr_line",
    "fico_range_low",
    "fico_range_high",
    "inq_last_6mths",
    "mths_since_last_delinq",
    "open_acc",
    "pub_rec",
    "revol_bal",
    "revol_util",
    "total_acc",
    "mths_since_last_major_derog",
    "application_type",
    "annual_inc_joint",
    "dti_joint",
    "acc_now_delinq",
    "tot_cur_bal",
    "mort_acc",
    "pub_rec_bankruptcies",
    "tax_liens",
    "total_bc_limit",
    "total_il_high_credit_limit",
]


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _numeric(frame: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(frame[column], errors="coerce")


def transform_chunk(frame: pd.DataFrame, sample_modulus: int = 1) -> pd.DataFrame:
    """Create a mature-outcome dataset using only fields available at origination."""
    eligible = frame["loan_status"].isin(PERFORMING_STATUSES | DEFAULT_STATUSES)
    prepared = frame.loc[eligible].copy()
    if prepared.empty:
        return pd.DataFrame()

    if sample_modulus > 1:
        stable_hash = pd.util.hash_pandas_object(prepared["id"].astype("string"), index=False)
        prepared = prepared.loc[(stable_hash % sample_modulus) == 0].copy()
    if prepared.empty:
        return pd.DataFrame()

    issue_date = pd.to_datetime(prepared["issue_d"], format="%b-%Y", errors="coerce")
    earliest_credit = pd.to_datetime(prepared["earliest_cr_line"], format="%b-%Y", errors="coerce")
    annual_income = _numeric(prepared, "annual_inc").where(lambda value: value > 0)
    installment = _numeric(prepared, "installment")

    result = pd.DataFrame(index=prepared.index)
    result["loan_id"] = prepared["id"].astype("string")
    result["issue_date"] = issue_date.dt.strftime("%Y-%m-%d")
    result["defaulted"] = prepared["loan_status"].isin(DEFAULT_STATUSES).astype("int8")
    result["loan_amount"] = _numeric(prepared, "loan_amnt")
    result["term_months"] = pd.to_numeric(prepared["term"].astype("string").str.extract(r"(\d+)")[0], errors="coerce")
    result["interest_rate"] = _numeric(prepared, "int_rate") / 100.0
    result["installment"] = installment
    result["grade"] = prepared["grade"].astype("string")
    result["sub_grade"] = prepared["sub_grade"].astype("string")
    result["employment_length"] = prepared["emp_length"].astype("string")
    result["home_ownership"] = prepared["home_ownership"].astype("string")
    result["annual_income"] = annual_income
    result["verification_status"] = prepared["verification_status"].astype("string")
    result["purpose"] = prepared["purpose"].astype("string")
    result["state"] = prepared["addr_state"].astype("string")
    result["dti"] = _numeric(prepared, "dti") / 100.0
    result["delinquencies_2y"] = _numeric(prepared, "delinq_2yrs")
    result["credit_history_years"] = (issue_date - earliest_credit).dt.days / 365.25
    result["fico_score"] = (_numeric(prepared, "fico_range_low") + _numeric(prepared, "fico_range_high")) / 2.0
    result["inquiries_6m"] = _numeric(prepared, "inq_last_6mths")
    result["months_since_last_delinquency"] = _numeric(prepared, "mths_since_last_delinq")
    result["open_accounts"] = _numeric(prepared, "open_acc")
    result["public_records"] = _numeric(prepared, "pub_rec")
    result["revolving_balance"] = _numeric(prepared, "revol_bal")
    result["revolving_utilization"] = _numeric(prepared, "revol_util") / 100.0
    result["total_accounts"] = _numeric(prepared, "total_acc")
    result["months_since_major_derogatory"] = _numeric(prepared, "mths_since_last_major_derog")
    result["application_type"] = prepared["application_type"].astype("string")
    result["joint_annual_income"] = _numeric(prepared, "annual_inc_joint")
    result["joint_dti"] = _numeric(prepared, "dti_joint") / 100.0
    result["currently_delinquent_accounts"] = _numeric(prepared, "acc_now_delinq")
    result["total_current_balance"] = _numeric(prepared, "tot_cur_bal")
    result["mortgage_accounts"] = _numeric(prepared, "mort_acc")
    result["public_record_bankruptcies"] = _numeric(prepared, "pub_rec_bankruptcies")
    result["tax_liens"] = _numeric(prepared, "tax_liens")
    result["bankcard_limit"] = _numeric(prepared, "total_bc_limit")
    result["installment_credit_limit"] = _numeric(prepared, "total_il_high_credit_limit")
    result["payment_burden"] = (installment * 12.0 / annual_income).clip(lower=0, upper=2)
    result["exposure"] = result["loan_amount"]
    result["lgd"] = 0.45

    numeric_columns = result.select_dtypes(include=[np.number]).columns
    result.loc[:, numeric_columns] = result.loc[:, numeric_columns].replace([np.inf, -np.inf], np.nan)
    return result.loc[result["issue_date"].notna()].reset_index(drop=True)


def prepare_dataset(source: Path, output: Path, profile_path: Path, chunk_size: int, sample_modulus: int) -> dict[str, object]:
    output.parent.mkdir(parents=True, exist_ok=True)
    profile_path.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    raw_rows = 0
    eligible_rows = 0
    output_rows = 0
    defaults = 0
    statuses: Counter[str] = Counter()
    earliest: str | None = None
    latest: str | None = None
    wrote_header = False

    chunks = pd.read_csv(
        source,
        compression="gzip",
        usecols=SOURCE_COLUMNS,
        chunksize=chunk_size,
        low_memory=False,
    )
    for chunk in chunks:
        raw_rows += len(chunk)
        status_counts = chunk["loan_status"].fillna("<missing>").astype(str).value_counts()
        statuses.update({str(key): int(value) for key, value in status_counts.items()})
        eligible_rows += int(chunk["loan_status"].isin(PERFORMING_STATUSES | DEFAULT_STATUSES).sum())
        prepared = transform_chunk(chunk, sample_modulus=sample_modulus)
        if prepared.empty:
            continue
        prepared.to_csv(output, mode="a", index=False, header=not wrote_header, compression="gzip")
        wrote_header = True
        output_rows += len(prepared)
        defaults += int(prepared["defaulted"].sum())
        chunk_min = str(prepared["issue_date"].min())
        chunk_max = str(prepared["issue_date"].max())
        earliest = chunk_min if earliest is None else min(earliest, chunk_min)
        latest = chunk_max if latest is None else max(latest, chunk_max)

    if not wrote_header:
        raise RuntimeError("No mature loan outcomes were found in the source dataset")

    profile: dict[str, object] = {
        "dataset": DATASET_HANDLE,
        "source_file": SOURCE_FILENAME,
        "source_sha256": source_sha256(source),
        "license": LICENSE,
        "raw_rows": raw_rows,
        "mature_outcome_rows": eligible_rows,
        "prepared_rows": output_rows,
        "sample_modulus": sample_modulus,
        "positive_rows": defaults,
        "positive_rate": defaults / output_rows,
        "issue_date_min": earliest,
        "issue_date_max": latest,
        "status_counts": dict(sorted(statuses.items())),
        "performing_statuses": sorted(PERFORMING_STATUSES),
        "default_statuses": sorted(DEFAULT_STATUSES),
        "prediction_time_policy": "Only origination/application fields are retained; payment, recovery, hardship, settlement, and other post-outcome fields are excluded.",
    }
    profile_path.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    return profile


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description=__doc__)
    command.add_argument("--source", type=Path, default=Path("data/raw") / SOURCE_FILENAME)
    command.add_argument("--output", type=Path, default=Path("data/processed/lending_club_train.csv.gz"))
    command.add_argument("--profile", type=Path, default=Path("data/processed/lending_club_profile.json"))
    command.add_argument("--chunk-size", type=int, default=100_000)
    command.add_argument("--sample-modulus", type=int, default=3, help="Deterministically retain approximately 1/N mature loans; use 1 for all rows")
    return command


def main() -> None:
    args = parser().parse_args()
    if args.chunk_size < 1 or args.sample_modulus < 1:
        raise SystemExit("chunk-size and sample-modulus must be positive")
    profile = prepare_dataset(args.source, args.output, args.profile, args.chunk_size, args.sample_modulus)
    print(json.dumps(profile, indent=2))


if __name__ == "__main__":
    main()
