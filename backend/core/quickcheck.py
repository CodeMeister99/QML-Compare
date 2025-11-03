# backend/core/quickcheck.py
from __future__ import annotations
import os
from typing import Dict, Any, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_selection import mutual_info_classif
from sklearn.decomposition import PCA

# Try to import OpenCV for image quickcheck; keep optional
try:
    import cv2  # type: ignore
    _HAS_CV2 = True
except Exception:
    _HAS_CV2 = False


class DatasetAnalyzer:
    """
    Lightweight dataset scan to produce quick, cheap signals for UI:
      - shape, type counts, PCA compressibility, average MI to target (tabular)
      - simple size/shape stats for images
    """
    def __init__(self, data, target: Optional[str] = None, data_type: str = "tabular"):
        self.data = data
        self.target = target
        self.data_type = data_type
        self.analysis: Dict[str, Any] = {}

    def analyze(self) -> Dict[str, Any]:
        if self.data_type == "tabular":
            self._analyze_tabular()
        elif self.data_type == "image":
            self._analyze_image()
        elif self.data_type == "video":
            self._analyze_video()
        else:
            raise ValueError("Unsupported data_type")
        return self.analysis

    def _analyze_tabular(self):
        df = self.data.copy()
        # Drop fully-empty rows/cols to avoid PCA/MI crashes
        df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")

        n_samples, n_features = df.shape
        categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

        # Encode categoricals so we can treat everything as numeric when needed
        df_enc = df.copy()
        for col in categorical_cols:
            df_enc[col] = LabelEncoder().fit_transform(df_enc[col].astype(str))

        # PCA on the (encoded) numeric matrix; guard small column counts
        try:
            usable = df_enc.select_dtypes(include=["number"])
            if usable.shape[1] >= 2:
                pca = PCA(n_components=min(5, usable.shape[1]))
                pca.fit(usable)
                explained_var = float(np.sum(pca.explained_variance_ratio_))
            else:
                explained_var = 0.0
        except Exception:
            explained_var = 0.0

        # Average mutual information (feature -> target)
        avg_mi = 0.0
        if self.target and self.target in df_enc.columns:
            y = df_enc[self.target]
            if y.dtype == "object":
                y = LabelEncoder().fit_transform(y.astype(str))
            X = df_enc.drop(columns=[self.target]).select_dtypes(include=["number"])
            try:
                if X.shape[1] > 0:
                    mi = mutual_info_classif(X, y, discrete_features="auto")
                    avg_mi = float(np.mean(mi))
            except Exception:
                avg_mi = 0.0

        self.analysis = {
            "type": "tabular",
            "n_samples": int(n_samples),
            "n_features": int(n_features),
            "n_categorical": int(len(categorical_cols)),
            "n_numeric": int(len(numeric_cols)),
            "explained_var_pca": explained_var,   # 0..1 roughly
            "avg_mutual_info": avg_mi,            # >= 0, higher = stronger link to target
        }

    def _analyze_image(self):
        image_dir = str(self.data)
        files = [f for f in os.listdir(image_dir) if f.lower().endswith(('.png','.jpg','.jpeg'))]
        if not files or not _HAS_CV2:
            self.analysis = {"type": "image", "n_samples": len(files), "avg_height": 0, "avg_width": 0, "channels": 0}
            return

        sizes = []
        for f in files[:50]:  # sample first up to 50 images
            img = cv2.imread(os.path.join(image_dir, f))
            if img is not None:
                sizes.append(img.shape)

        if sizes:
            avg_h = float(np.mean([s[0] for s in sizes]))
            avg_w = float(np.mean([s[1] for s in sizes]))
            channels = int(sizes[0][2]) if len(sizes[0]) > 2 else 1
        else:
            avg_h, avg_w, channels = 0.0, 0.0, 0

        self.analysis = {
            "type": "image",
            "n_samples": len(files),
            "avg_height": avg_h,
            "avg_width": avg_w,
            "channels": channels,
        }

    def _analyze_video(self):
        self.analysis = {
            "type": "video",
            "note": "Video analysis not yet implemented"
        }


class ModelSelector:
    """
    Simple heuristics → suggested starting models.
    Return keys that your frontend understands.
    """
    def __init__(self, analysis: Dict[str, Any]):
        self.a = analysis

    def recommend(self) -> Dict[str, str]:
        dtype = self.a.get("type")
        if dtype == "tabular":
            n = self.a.get("n_samples", 0)
            d = self.a.get("n_features", 0)
            mi = self.a.get("avg_mutual_info", 0.0)
            pca = self.a.get("explained_var_pca", 0.0)

            # Map to YOUR model keys (frontend expects these):
            # classical: mlp | svm | rf | logreg | mlp_torch
            # quantum:   qnn | vqc | qnn_simple | hybrid_torch | aec_qnn
            if d < 50 and mi > 0.05:
                return {"classical": "mlp", "quantum": "qnn_simple"}
            if d >= 50 and pca > 0.70:
                return {"classical": "mlp", "quantum": "aec_qnn"}
            if n > 10000:
                return {"classical": "mlp_torch", "quantum": "vqc"}
            return {"classical": "logreg", "quantum": "qnn"}

        if dtype == "image":
            # Placeholder mapping
            return {"classical": "mlp", "quantum": "vqc"}

        # Fallback
        return {"classical": "mlp", "quantum": "qnn"}
