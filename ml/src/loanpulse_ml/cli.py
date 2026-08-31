from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from .config import TrainingConfig
from .training import train_model


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train and persist the LoanPulse loan-performance model")
    parser.add_argument("train", nargs="?", default="train")
    parser.add_argument("--input", required=True, help="CSV or Parquet training dataset")
    parser.add_argument("--config", help="JSON or YAML training configuration")
    parser.add_argument("--artifacts", default="artifacts", help="Artifact output directory")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    source = Path(args.input)
    if source.suffix.lower() in {".parquet", ".pq"}:
        frame = pd.read_parquet(source)
    else:
        frame = pd.read_csv(source)
    config = TrainingConfig.load(args.config) if args.config else TrainingConfig()
    result = train_model(frame, config, args.artifacts)
    print(json.dumps({"run_directory": result.run_directory, "metrics": result.metrics}, indent=2))


if __name__ == "__main__":
    main()
