from __future__ import annotations

import hmac
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .artifacts import load_inference_bundle
from .inference import InferenceBundle

app = FastAPI(title="LoanPulse ML inference", version="1.0.0", docs_url=None, redoc_url=None)
_bundle: InferenceBundle | None = None


def bundle() -> InferenceBundle:
    global _bundle
    if _bundle is None:
        artifact = os.environ.get("MODEL_ARTIFACT_PATH")
        if not artifact:
            raise HTTPException(503, "MODEL_ARTIFACT_PATH is not configured")
        _bundle = load_inference_bundle(Path(artifact))
    return _bundle


def authorize(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("ML_SERVICE_API_KEY")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(401, "invalid service credential")


class RecordRequest(BaseModel):
    records: list[dict[str, Any]] = Field(min_length=1, max_length=1000)


class ExplainRequest(RecordRequest):
    top_k: int = Field(default=10, ge=1, le=30)


class ScenarioInputs(BaseModel):
    incomeDecline: float = Field(ge=0, le=30)
    dtiIncrease: float = Field(ge=0, le=20)
    rateShock: float = Field(ge=0, le=500)
    paymentBurden: float = Field(ge=0, le=15)


class ScenarioRequest(BaseModel):
    loan_id: str
    record: dict[str, Any]
    inputs: ScenarioInputs


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "service": "loanpulse-ml"}


@app.get("/ready", dependencies=[Depends(authorize)])
def ready() -> dict[str, Any]:
    loaded = bundle()
    return {"status": "ready", "model": loaded.metadata.get("primary_model"), "calibration": loaded.metadata.get("calibration_method")}


@app.post("/v1/predict", dependencies=[Depends(authorize)])
def predict(request: RecordRequest) -> dict[str, Any]:
    result = bundle().predict(pd.DataFrame.from_records(request.records))
    return {"predictions": result.reset_index(drop=True).to_dict(orient="records"), "model": bundle().metadata}


@app.post("/v1/explain", dependencies=[Depends(authorize)])
def explain(request: ExplainRequest) -> dict[str, Any]:
    return {"explanations": bundle().explain(pd.DataFrame.from_records(request.records), request.top_k)}


@app.post("/v1/scenario", dependencies=[Depends(authorize)])
def scenario(request: ScenarioRequest) -> dict[str, Any]:
    model = bundle()
    observed = dict(request.record)
    stressed = dict(observed)
    feature_map = json.loads(os.environ.get("SCENARIO_FEATURE_MAP", "{}")) or {
        "incomeDecline": "annual_income", "dtiIncrease": "dti", "rateShock": "interest_rate", "paymentBurden": "payment_burden"
    }
    missing: list[str] = []
    values = request.inputs.model_dump()
    for control, feature in feature_map.items():
        change = float(values.get(control, 0))
        if change == 0:
            continue
        if feature not in stressed or stressed[feature] is None:
            missing.append(feature)
            continue
        current = float(stressed[feature])
        if control == "incomeDecline": stressed[feature] = current * (1 - change / 100)
        elif control == "rateShock": stressed[feature] = current + change / 10_000
        else: stressed[feature] = current + (change / 100 if abs(current) <= 2 else change)
    if missing:
        raise HTTPException(422, f"scenario record is missing configured features: {sorted(set(missing))}")
    predictions = model.predict(pd.DataFrame.from_records([observed, stressed])).reset_index(drop=True)
    baseline_pd = float(predictions.loc[0, "probability_calibrated"])
    scenario_pd = float(predictions.loc[1, "probability_calibrated"])
    explanation = model.explain(pd.DataFrame.from_records([stressed]), top_k=3)[0]
    exposure = float(observed.get("exposure", 0))
    lgd = float(observed.get("lgd", .45))
    return {
        "pd": scenario_pd,
        "rawPd": float(predictions.loc[1, "probability_raw"]),
        "expectedLoss": scenario_pd * exposure * lgd,
        "band": str(predictions.loc[1, "risk_band"]).title(),
        "delta": scenario_pd - baseline_pd,
        "drivers": [{"label": item["feature"], "value": abs(float(item["shap_value"])) * 100} for item in explanation["drivers"]],
    }


def main() -> None:
    import uvicorn
    uvicorn.run("loanpulse_ml.service:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
