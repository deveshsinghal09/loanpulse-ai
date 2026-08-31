# Lending Club training source

LoanPulse uses the Kaggle dataset `wordsforthewise/lending-club` for its public benchmark model.

- Source: https://www.kaggle.com/datasets/wordsforthewise/lending-club
- File: `accepted_2007_to_2018Q4.csv.gz`
- License: CC0 1.0 / Public Domain
- Coverage: accepted Lending Club loans issued from 2007 through 2018
- Raw data policy: downloaded locally into `data/raw/` and never committed

## Why this dataset

It is large, includes a real loan-performance outcome, has an origination month for chronological validation, and contains enough application-time credit attributes for a defensible baseline. Competition datasets with restrictive rules and small synthetic datasets were rejected.

## Outcome policy

Only loans with mature terminal outcomes enter training:

- Performing: `Fully Paid`
- Default: `Charged Off` or `Default`
- Policy-qualified variants of fully paid and charged off are mapped consistently
- Current, late, grace-period, and otherwise unresolved loans are excluded to avoid censoring

## Leakage policy

`scripts/prepare_lending_club.py` reads a strict allow-list of application and origination fields. It excludes all payment, recovery, settlement, hardship, last-credit-pull, and other post-origination outcome fields. Raw dates are used only to create prediction-safe elapsed-time features or chronological partitions.

The generic leakage detector additionally challenged collection-related fields whose naming did not prove their exact observation boundary. The adapter now excludes those fields before it writes the prepared dataset, and the governed model configuration maintains a second strict allow-list.

## Reproduce

```powershell
python -m kaggle datasets download wordsforthewise/lending-club `
  -f accepted_2007_to_2018Q4.csv.gz `
  -p data/raw

.\.venv\Scripts\python.exe scripts\prepare_lending_club.py

.\.venv\Scripts\loanpulse-ml.exe train `
  --input data\processed\lending_club_train.csv.gz `
  --config config\lending-club.yaml `
  --artifacts artifacts
```

The default deterministic hash sample retains approximately one third of mature loans across the full time range. Use `--sample-modulus 1` to train on every mature outcome when adequate compute is available.
