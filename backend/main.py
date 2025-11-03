# backend/main.py
from __future__ import annotations

import io
import json
import time
from typing import Any, Dict, List, Optional

import numpy as np  # noqa: F401
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

from core.quickcheck import DatasetAnalyzer, ModelSelector
from core.data import prepare_data_from_csv
from core.metrics import metrics_from_probs, details_from_preds
from core.registry import get_classical_runner, get_quantum_runner


app = FastAPI(title="QML Compare API", version="0.3.3")

# CORS: allow Vite dev server (both localhost and 127.0.0.1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Helpers
# ---------------------------
def _read_csv(content: bytes) -> pd.DataFrame:
    """Robust CSV load: try common delimiters, require >= 2 columns."""
    last_err: Optional[Exception] = None
    for sep in (",", ";", "\t", "|"):
        try:
            df = pd.read_csv(io.BytesIO(content), sep=sep)
            if df.shape[1] >= 2:
                return df
        except Exception as e:
            last_err = e
            continue
    if last_err:
        # final attempt, let pandas raise how it wants
        return pd.read_csv(io.BytesIO(content))
    return pd.read_csv(io.BytesIO(content))

def _parse_json_obj(name: str, raw: Optional[str]) -> Dict[str, Any]:
    """Parse a JSON object string safely; return {} if empty."""
    if raw is None or raw == "":
        return {}
    try:
        val = json.loads(raw)
        if isinstance(val, dict):
            return val
        raise ValueError("not a JSON object")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{name} is not valid JSON: {e}")

def _preview_from_df(df: pd.DataFrame, filename: str) -> Dict[str, Any]:
    headers: List[str] = [str(c) for c in df.columns]
    n_rows, n_cols = int(df.shape[0]), int(df.shape[1])
    missing_count = int(df.isna().sum().sum())
    rows_preview: List[List[Any]] = []
    for _, row in df.head(5).iterrows():
        rows_preview.append([None if pd.isna(v) else (v.item() if hasattr(v, "item") else v) for v in row.tolist()])
    return {
        "filename": filename,
        "headers": headers,
        "nRows": n_rows,
        "nCols": n_cols,
        "missingCount": missing_count,
        "rows": rows_preview,
    }

# ---------------------------
# Pydantic models
# ---------------------------
class ComparePayload(BaseModel):
    classicalModel: str
    quantumModel: str
    classicalParams: Dict[str, Any] = {}
    quantumParams: Dict[str, Any] = {}
    targetColumn: Optional[str] = None

# ---------------------------
# Endpoints
# ---------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "service": "qml-compare-api"}

@app.post("/api/preview")
async def preview(file: UploadFile = File(...)):
    """Small CSV preview for the UI head-check."""
    content = await file.read()
    try:
        df = _read_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}")
    if df.empty:
        raise HTTPException(status_code=400, detail="CSV has no rows.")
    if df.shape[1] < 2:
        raise HTTPException(status_code=400, detail="CSV has fewer than 2 columns.")
    return _preview_from_df(df, file.filename or "dataset.csv")

@app.post("/api/quickcheck")
async def quickcheck(
    file: UploadFile = File(...),
    target: Optional[str] = Form(None),
    data_type: str = Form("tabular"),
):
    """Fast scan + heuristic recommendation (tabular)."""
    if data_type != "tabular":
        return {
            "analysis": {"type": data_type, "note": "Only tabular supported in API"},
            "recommendation": {"classical": "mlp", "quantum": "qnn"},
        }
    content = await file.read()
    try:
        df = _read_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}")

    analyzer = DatasetAnalyzer(df, target=target, data_type="tabular")
    analysis = analyzer.analyze()
    rec = ModelSelector(analysis).recommend()
    return {"analysis": analysis, "recommendation": rec}

@app.post("/api/compare")
async def compare_api(
    file: UploadFile = File(...),

    # New-style fields (preferred)
    classicalModel: Optional[str] = Form(None),
    quantumModel: Optional[str] = Form(None),
    classicalParams: Optional[str] = Form(None),
    quantumParams: Optional[str] = Form(None),
    targetColumn: Optional[str] = Form(None),

    # Old-style single JSON payload (backwards compatible)
    payload: Optional[str] = Form(None),
):
    """
    Compare one classical model vs one quantum model.

    Accepts either:
      A) New style separate fields
      B) Old style single 'payload' JSON (ComparePayload)
    """
    print("/api/compare called")

    # 1) Normalize payload
    try:
        if payload and not (classicalModel or quantumModel or classicalParams or quantumParams or targetColumn):
            p = ComparePayload(**json.loads(payload))
        else:
            if not classicalModel or not quantumModel:
                raise HTTPException(status_code=400, detail="Missing classicalModel or quantumModel.")
            c_params = _parse_json_obj("classicalParams", classicalParams)
            q_params = _parse_json_obj("quantumParams", quantumParams)
            p = ComparePayload(
                classicalModel=classicalModel,
                quantumModel=quantumModel,
                classicalParams=c_params,
                quantumParams=q_params,
                targetColumn=targetColumn,
            )
    except (ValidationError, HTTPException):
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    # 2) Prepare data
    csv_bytes = await file.read()
    try:
        (
            X_tr, X_te, y_tr, y_te,
            label_encoder, scaler,
            target_note, dataset_info
        ) = prepare_data_from_csv(csv_bytes, p.targetColumn)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data error: {e}")

    classes = dataset_info["classes"]

    # 3) Run classical
    try:
        run_classical = get_classical_runner(p.classicalModel)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unknown classical model '{p.classicalModel}': {e}")

    try:
        t0 = time.perf_counter()
        proba_c, c_timings, c_extras = run_classical(X_tr, y_tr, X_te, p.classicalParams, classes)
        c_total = (time.perf_counter() - t0) * 1000.0
        c_metrics = metrics_from_probs(y_te, proba_c) | {"latency_ms": c_total}
        c_details = details_from_preds(y_te, proba_c, classes, timings=c_timings, extras=c_extras)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Classical model '{p.classicalModel}' failed: {e}")

    # 4) Run quantum
    try:
        run_quantum = get_quantum_runner(p.quantumModel)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unknown quantum model '{p.quantumModel}': {e}")

    try:
        t0 = time.perf_counter()
        proba_q, q_timings, q_extras = run_quantum(X_tr, y_tr, X_te, p.quantumParams, classes)
        q_total = (time.perf_counter() - t0) * 1000.0
        q_metrics = metrics_from_probs(y_te, proba_q) | {"latency_ms": q_total}
        q_details = details_from_preds(y_te, proba_q, classes, timings=q_timings, extras=q_extras)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Quantum model '{p.quantumModel}' failed: {e}")

    # 5) Diagnostics (cap size)
    max_points = 5000
    diag = {
        "y_true": y_te.tolist()[:max_points],
        "classical": {"proba": proba_c[:max_points].tolist()},
        "quantum":   {"proba": proba_q[:max_points].tolist()},
    }

    # 6) Response
    return {
        "summary": {
            "classicalModel": p.classicalModel,
            "quantumModel": p.quantumModel,
            "samples": dataset_info["n_samples"],
            "target": dataset_info["target"],
            "n_features": dataset_info["n_features"],
            "classes": classes,
            "class_counts": dataset_info["class_counts"],
        },
        "metrics": {"classical": c_metrics, "quantum": q_metrics},
        "details": {"classical": c_details, "quantum": q_details},
        "diagnostics": diag,
        "notes": target_note,
    }

# Dev runner
if __name__ == "__main__":
    import uvicorn
    # pass import string "main:app" to enable --reload behavior
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
