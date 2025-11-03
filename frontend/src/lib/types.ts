// frontend/src/lib/types.ts

export type ClassicalModelKey = 'mlp' | 'svm' | 'rf' | 'logreg' | 'mlp_torch'
export type QuantumModelKey = 'qnn' | 'vqc' | 'qnn_simple' | 'hybrid_torch' | 'aec_qnn'

export interface DatasetPreview {
  filename: string
  headers: string[]
  nRows: number
  nCols: number
  missingCount: number
  rows: Array<Array<string | number | null>>
}

export interface ComparePayload {
  classicalModel: ClassicalModelKey
  quantumModel: QuantumModelKey
  classicalParams: Record<string, number | string>
  quantumParams: Record<string, number | string>
  targetColumn: string
}

export interface CompareResult {
  summary: {
    samples: number
    target?: string
    n_features?: number
    classes?: string[]
    class_counts?: Record<string, number>
  }
  metrics: {
    classical: {
      accuracy: number
      f1: number
      auc: number
      loss: number
      latency_ms: number
    }
    quantum: {
      accuracy: number
      f1: number
      auc: number
      loss: number
      latency_ms: number
    }
  }
  diagnostics?: {
    y_true?: number[]
    classical?: { proba?: number[] }
    quantum?: { proba?: number[] }
  }
  details?: {
    classical: { confusion: number[][], timings?: { train_ms: number, infer_ms: number } }
    quantum:   { confusion: number[][], timings?: { train_ms: number, infer_ms: number } }
  }
  notes?: string
}

/* ---------- QuickCheck ---------- */

export interface QuickcheckAnalysisTabular {
  type: 'tabular'
  n_samples: number
  n_features: number
  n_categorical: number
  n_numeric: number
  explained_var_pca: number
  avg_mutual_info: number
}

export interface QuickcheckRecommendation {
  classical: ClassicalModelKey
  quantum: QuantumModelKey
}

export interface QuickcheckResponse {
  analysis: QuickcheckAnalysisTabular // (extend if you add image/video)
  recommendation: QuickcheckRecommendation
}
