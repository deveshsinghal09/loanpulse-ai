# Production model candidate

- Source dataset: `wordsforthewise/lending-club`
- License: CC0 1.0
- Prepared rows: 449,080
- Outcome rate: 19.96%
- Split: chronological, never shuffled
- Train: June 2007–April 2014
- Validation: May 2014–August 2016
- Test: September 2016–December 2018
- Primary model: XGBoost
- Calibration: isotonic
- Test ROC AUC: 0.6973
- Test PR AUC: 0.3710
- Test Brier score: 0.1579
- Test expected calibration error: 0.0194

This is a benchmark/demo candidate trained on historical US peer-to-peer lending data. It is not approved for autonomous credit decisions or direct use on an Indian lending population without representative retraining, fairness review, policy validation, and ongoing monitoring.
