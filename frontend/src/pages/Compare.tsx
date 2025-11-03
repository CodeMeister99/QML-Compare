import { useMemo, useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import ModelCard from '../components/ModelCard'
import MetricCard from '../components/MetricCard'
import Modal from '../components/Modal'
import Tooltip from '../components/Tooltip'
import { CLASSICAL_MODELS, QUANTUM_MODELS } from '../lib/modelInfo'
import type {
  ClassicalModelKey,
  DatasetPreview,
  QuantumModelKey,
  ComparePayload,
  CompareResult,
  QuickcheckResponse,
} from '../lib/types'
import { compareModels, quickcheck } from '../lib/api'
import { Play } from 'lucide-react'
import { microRoc, microPr } from '../lib/curves'
import { MetricBars, RocCurve, PrCurve } from '../components/Charts'

const HELP: Record<string, string> = {
  epochs: 'How many passes over the training data.',
  lr: 'Learning rate (how big each step is).',
  batch_size: 'How many rows are used per update.',
  C: 'Regularization strength. Smaller = stronger regularization.',
  gamma: 'RBF kernel width. “scale” is a good default.',
  n_estimators: 'Number of trees.',
  max_depth: 'Max tree depth. Leave empty for auto.',
  shots: 'Number of circuit measurements. 0 = analytic simulation (fastest).',
  noise_prob: 'Amount of depolarizing noise per layer.',
  layers: 'How many variational blocks.',
  n_qubits: 'Number of qubits in the circuit.',
  encoding_dim: 'Bottleneck size for the autoencoder.',
  ae_epochs: 'Training epochs for the autoencoder.',
  q_epochs: 'Training epochs for the quantum classifier.',
  q_lr: 'Learning rate for the quantum classifier.',
}

const FRIENDLY = {
  accuracy: { name: 'Overall correctness', explain: 'How often predictions are right.' },
  f1: { name: 'Balance of precision and recall', explain: 'Helps when classes are uneven.' },
  auc: { name: 'Ranking ability', explain: 'How well positives are ranked above negatives.' },
  loss: { name: 'Penalty for wrong guesses', explain: 'Lower means fewer overconfident mistakes.' },
  latency_ms: { name: 'Run time', explain: 'How long the run took.' },
} as const

const CONTAINER_W = 'max-w-4xl'
const METRIC_ORDER: Array<keyof typeof FRIENDLY> = ['accuracy','f1','auc','loss','latency_ms']

// Fast, CPU-friendly defaults
const FAST_CLASSICAL: Record<ClassicalModelKey, Record<string, number | string>> = {
  mlp:       { epochs: 10, lr: 0.003, batch_size: 32 },
  svm:       { C: 1.0, gamma: 'scale' },
  rf:        { n_estimators: 150, max_depth: '' },
  logreg:    { C: 1.0 },
  mlp_torch: { epochs: 8, lr: 0.001, batch_size: 64 },
}
const FAST_QUANTUM: Record<QuantumModelKey, Record<string, number | string>> = {
  qnn:         { shots: 0, noise_prob: 0.0, layers: 2, epochs: 20, lr: 0.06, n_qubits: 2 },
  vqc:         { shots: 0, noise_prob: 0.0, layers: 2, epochs: 20, lr: 0.06, n_qubits: 2 },
  qnn_simple:  { epochs: 15, lr: 0.08 },
  hybrid_torch:{ n_qubits: 4, layers: 1, epochs: 6,  lr: 0.001, batch_size: 32 },
  aec_qnn:     { encoding_dim: 4, ae_epochs: 8, batch_size: 32, q_epochs: 16, q_lr: 0.06, n_qubits: 4, layers: 2, noise_prob: 0.0, shots: 0 },
}

export default function Compare() {
  // upload + target
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [target, setTarget] = useState<string>('')

  // quickcheck
  const [qc, setQc] = useState<QuickcheckResponse | null>(null)
  const [qcLoading, setQcLoading] = useState(false)
  const [qcError, setQcError] = useState<string | null>(null)

  // selected models
  const [classical, setClassical] = useState<ClassicalModelKey>('mlp')
  const [quantum, setQuantum] = useState<QuantumModelKey>('vqc')

  // remember params per model
  const [cParamsByModel, setCParamsByModel] = useState<Record<ClassicalModelKey, Record<string, number | string>>>({
    mlp: FAST_CLASSICAL.mlp,
    svm: FAST_CLASSICAL.svm,
    rf: FAST_CLASSICAL.rf,
    logreg: FAST_CLASSICAL.logreg,
    mlp_torch: FAST_CLASSICAL.mlp_torch,
  })
  const [qParamsByModel, setQParamsByModel] = useState<Record<QuantumModelKey, Record<string, number | string>>>({
    qnn: FAST_QUANTUM.qnn,
    vqc: FAST_QUANTUM.vqc,
    qnn_simple: FAST_QUANTUM.qnn_simple,
    hybrid_torch: FAST_QUANTUM.hybrid_torch,
    aec_qnn: FAST_QUANTUM.aec_qnn,
  })

  const cParams = cParamsByModel[classical]
  const qParams = qParamsByModel[quantum]

  // run + results
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)

  // modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalBody, setModalBody] = useState('')
  function showDetails(title: string, body: string) { setModalTitle(title); setModalBody(body); setModalOpen(true) }

  function onPreview(f: File, p: DatasetPreview) {
    setFile(f); setPreview(p); setResult(null); setQc(null); setQcError(null)
    // default target guess: last column
    const guess = p.headers?.length ? p.headers[p.headers.length - 1] : ''
    if (!target && guess) setTarget(guess)
    // kick off quickcheck (non-blocking)
    setQcLoading(true)
    quickcheck(f, { target: target || guess, dataType: 'tabular' })
      .then((resp) => { setQc(resp); setQcLoading(false) })
      .catch((err) => { setQcError(err?.message || 'Quickcheck failed'); setQcLoading(false) })
  }

  function setC(key: string, value: string | number) {
    setCParamsByModel(prev => ({ ...prev, [classical]: { ...prev[classical], [key]: value } }))
  }
  function setQ(key: string, value: string | number) {
    setQParamsByModel(prev => ({ ...prev, [quantum]: { ...prev[quantum], [key]: value } }))
  }

  function onPickClassical(key: ClassicalModelKey) { setClassical(key) }
  function onPickQuantum(key: QuantumModelKey) { setQuantum(key) }

  async function run() {
    if (!file || !preview) return alert('Please upload a dataset first.')
    if (!target) return alert('Please choose a target column.')
    setLoading(true); setResult(null)
    try {
      const payload: ComparePayload = {
        classicalModel: classical,
        quantumModel: quantum,
        classicalParams: cParams,
        quantumParams: qParams,
        targetColumn: target,
      }
      const res = await compareModels(file, payload)
      setResult(res)
    } catch (e: any) {
      alert(e.message || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  // verdict helpers
  function overallVerdict() {
    if (!result) return ''
    const C = result.metrics.classical, Q = result.metrics.quantum
    const weights: Record<keyof typeof FRIENDLY, number> = { accuracy: 0.4, f1: 0.3, auc: 0.2, loss: 0.08, latency_ms: 0.02 }
    const keys = Object.keys(weights) as Array<keyof typeof FRIENDLY>
    let cScore = 0, qScore = 0
    for (const k of keys) {
      const c = C[k], q = Q[k]; if (c == null || q == null || Number.isNaN(c) || Number.isNaN(q)) continue
      const lower = k === 'loss' || k === 'latency_ms'
      const maxv = Math.max(c, q), minv = Math.min(c, q), eps = 1e-9
      const normC = lower ? (maxv - c) / (maxv - minv + eps) : (c - minv) / (maxv - minv + eps)
      const normQ = lower ? (maxv - q) / (maxv - minv + eps) : (q - minv) / (maxv - minv + eps)
      cScore += weights[k] * normC; qScore += weights[k] * normQ
    }
    const cname = CLASSICAL_MODELS[classical].name, qname = QUANTUM_MODELS[quantum].name
    if (Math.abs(cScore - qScore) < 0.02) return `Overall: it’s a close call. ${cname} and ${qname} perform similarly on this dataset.`
    const winner = cScore > qScore ? cname : qname
    return `Overall winner: ${winner}. This balances correctness (accuracy and F1) and ranking ability (AUC), with time considered as a minor factor.`
  }

  const barData = useMemo(() => {
    if (!result) return []
    return [
      { metric: 'Accuracy',   Classical: result.metrics.classical.accuracy,   Quantum: result.metrics.quantum.accuracy },
      { metric: 'F1',         Classical: result.metrics.classical.f1,         Quantum: result.metrics.quantum.f1 },
      { metric: 'AUC',        Classical: result.metrics.classical.auc,        Quantum: result.metrics.quantum.auc },
      { metric: 'Loss',       Classical: result.metrics.classical.loss,       Quantum: result.metrics.quantum.loss },
      { metric: 'Time (ms)',  Classical: result.metrics.classical.latency_ms, Quantum: result.metrics.quantum.latency_ms },
    ]
  }, [result])

  const curves = useMemo(() => {
    if (!result?.diagnostics?.y_true) return null
    const y = result.diagnostics.y_true
    const pc = result.diagnostics.classical?.proba || []
    const pq = result.diagnostics.quantum?.proba || []
    return {
      rocC: microRoc(y, pc).curve,
      rocQ: microRoc(y, pq).curve,
      prC:  microPr(y, pc).curve,
      prQ:  microPr(y, pq).curve,
    }
  }, [result])

  // small input helpers
  function NumField({ label, keyName, obj, setFn }:
    { label: string; keyName: string; obj: Record<string, any>; setFn: (k: string, v: any)=>void }) {
    return (
      <div className="space-y-1">
        <div className="label">
          {label} <Tooltip text={HELP[keyName] || ''}><span className="ml-1 text-gray-400 select-none">?</span></Tooltip>
        </div>
        <input
          type="number"
          className="input w-full"
          value={String(obj[keyName] ?? '')}
          onChange={(e) => setFn(keyName, e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
    )
  }
  function TextField({ label, keyName, obj, setFn, placeholder }:
    { label: string; keyName: string; obj: Record<string, any>; setFn: (k: string, v: any)=>void; placeholder?: string }) {
    return (
      <div className="space-y-1">
        <div className="label">
          {label} <Tooltip text={HELP[keyName] || ''}><span className="ml-1 text-gray-400 select-none">?</span></Tooltip>
        </div>
        <input
          type="text"
          className="input w-full"
          placeholder={placeholder}
          value={String(obj[keyName] ?? '')}
          onChange={(e) => setFn(keyName, e.target.value)}
        />
      </div>
    )
  }

  function ClassicalParamCard() {
    return (
      <div className={`card mx-auto ${CONTAINER_W}`}>
        <div className="grid gap-4 md:grid-cols-3">
          {classical === 'mlp' && (<>
            <NumField label="Epochs" keyName="epochs" obj={cParams} setFn={setC} />
            <NumField label="LR" keyName="lr" obj={cParams} setFn={setC} />
            <NumField label="Batch" keyName="batch_size" obj={cParams} setFn={setC} />
          </>)}
          {classical === 'svm' && (<>
            <NumField label="C" keyName="C" obj={cParams} setFn={setC} />
            <TextField label="Gamma" keyName="gamma" obj={cParams} setFn={setC} placeholder="scale | auto" />
          </>)}
          {classical === 'rf' && (<>
            <NumField label="Trees" keyName="n_estimators" obj={cParams} setFn={setC} />
            <TextField label="Max depth" keyName="max_depth" obj={cParams} setFn={setC} placeholder="empty = None" />
          </>)}
          {classical === 'logreg' && (<>
            <NumField label="C" keyName="C" obj={cParams} setFn={setC} />
          </>)}
          {classical === 'mlp_torch' && (<>
            <NumField label="Epochs" keyName="epochs" obj={cParams} setFn={setC} />
            <NumField label="LR" keyName="lr" obj={cParams} setFn={setC} />
            <NumField label="Batch" keyName="batch_size" obj={cParams} setFn={setC} />
          </>)}
        </div>
      </div>
    )
  }

  function QuantumParamCard() {
    return (
      <div className={`card mx-auto ${CONTAINER_W}`}>
        <div className="grid gap-4 md:grid-cols-3">
          {(quantum === 'qnn' || quantum === 'vqc') && (<>
            <NumField label="Shots" keyName="shots" obj={qParams} setFn={setQ} />
            <NumField label="Noise p" keyName="noise_prob" obj={qParams} setFn={setQ} />
            <NumField label="Layers" keyName="layers" obj={qParams} setFn={setQ} />
            <NumField label="Epochs" keyName="epochs" obj={qParams} setFn={setQ} />
            <NumField label="LR" keyName="lr" obj={qParams} setFn={setQ} />
            <NumField label="Qubits" keyName="n_qubits" obj={qParams} setFn={setQ} />
          </>)}
          {quantum === 'qnn_simple' && (<>
            <NumField label="Epochs" keyName="epochs" obj={qParams} setFn={setQ} />
            <NumField label="LR" keyName="lr" obj={qParams} setFn={setQ} />
          </>)}
          {quantum === 'hybrid_torch' && (<>
            <NumField label="Qubits" keyName="n_qubits" obj={qParams} setFn={setQ} />
            <NumField label="Layers" keyName="layers" obj={qParams} setFn={setQ} />
            <NumField label="Epochs" keyName="epochs" obj={qParams} setFn={setQ} />
            <NumField label="LR" keyName="lr" obj={qParams} setFn={setQ} />
            <NumField label="Batch" keyName="batch_size" obj={qParams} setFn={setQ} />
          </>)}
          {quantum === 'aec_qnn' && (<>
            <NumField label="Encoding dim" keyName="encoding_dim" obj={qParams} setFn={setQ} />
            <NumField label="AE epochs" keyName="ae_epochs" obj={qParams} setFn={setQ} />
            <NumField label="Batch" keyName="batch_size" obj={qParams} setFn={setQ} />
            <NumField label="QNN epochs" keyName="q_epochs" obj={qParams} setFn={setQ} />
            <NumField label="QNN LR" keyName="q_lr" obj={qParams} setFn={setQ} />
            <NumField label="Qubits" keyName="n_qubits" obj={qParams} setFn={setQ} />
            <NumField label="Layers" keyName="layers" obj={qParams} setFn={setQ} />
            <NumField label="Noise p" keyName="noise_prob" obj={qParams} setFn={setQ} />
            <NumField label="Shots" keyName="shots" obj={qParams} setFn={setQ} />
          </>)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className={`mx-auto ${CONTAINER_W} px-6 py-10 space-y-10`}>
        {/* 1. Upload */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 text-center">1. Upload a dataset</h3>
          <UploadDropzone onPreview={onPreview} />
          {preview && (
            <div className="card">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="label mb-2">File</div>
                  <div className="font-semibold">{preview.filename}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    Rows: {preview.nRows} · Cols: {preview.nCols} · Missing: {preview.missingCount}
                  </div>
                  <div className="mt-4">
                    <label className="label">Target column</label>
                    <select className="input mt-1 w-full" value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="">Select...</option>
                      {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="label mb-2">Preview</div>
                  <div className="overflow-auto max-h-64 border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>{preview.headers.map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="odd:bg-white even:bg-gray-50">
                            {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QuickCheck panel */}
          {preview && (
            <div className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">QuickCheck</div>
                  <div className="text-sm text-gray-600">
                    A fast scan to suggest sensible starting models.
                  </div>
                </div>
                {qcLoading && <div className="text-sm text-blue-600">Scanning…</div>}
              </div>

              {qcError && <div className="text-sm text-red-600 mt-2">{qcError}</div>}

              {qc && (
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="label">Rows</div>
                    <div className="font-medium">{qc.analysis.n_samples}</div>
                  </div>
                  <div>
                    <div className="label">Columns</div>
                    <div className="font-medium">{qc.analysis.n_features}</div>
                    <div className="text-xs text-gray-600">
                      Num: {qc.analysis.n_numeric} · Cat: {qc.analysis.n_categorical}
                    </div>
                  </div>
                  <div>
                    <div className="label">Feature compactness (PCA)</div>
                    <div className="font-medium">{qc.analysis.explained_var_pca.toFixed(2)}</div>
                    <div className="text-xs text-gray-600">Higher means features compress well</div>
                  </div>
                  <div>
                    <div className="label">Avg feature–target link (MI)</div>
                    <div className="font-medium">{qc.analysis.avg_mutual_info.toFixed(3)}</div>
                    <div className="text-xs text-gray-600">Higher means features relate more to the target</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="label">Suggested start</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Classical: {CLASSICAL_MODELS[qc.recommendation.classical].name}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Quantum: {QUANTUM_MODELS[qc.recommendation.quantum].name}
                      </span>
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1 text-xs"
                        onClick={() => {
                          setClassical(qc.recommendation.classical)
                          setQuantum(qc.recommendation.quantum)
                        }}
                      >
                        Apply suggestion
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. Classical */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 text-center">2. Choose a classical model</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(CLASSICAL_MODELS).map(([key, m]) => (
              <ModelCard
                key={key}
                title={m.name}
                subtitle={m.short}
                description={m.explain}
                active={classical === key}
                onClick={() => setClassical(key as ClassicalModelKey)}
                onMore={() => showDetails(m.name, m.explain)}
              />
            ))}
          </div>
          <ClassicalParamCard />
        </section>

        {/* 3. Quantum */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 text-center">3. Choose a quantum model</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(QUANTUM_MODELS).map(([key, m]) => (
              <ModelCard
                key={key}
                title={m.name}
                subtitle={m.short}
                description={m.explain}
                active={quantum === key}
                onClick={() => setQuantum(key as QuantumModelKey)}
                onMore={() => showDetails(m.name, m.explain)}
              />
            ))}
          </div>
          <QuantumParamCard />
        </section>

        {/* Run */}
        <div className="text-center">
          <button type="button" onClick={run} disabled={loading || !file} className="btn-primary inline-flex items-center gap-2">
            <Play size={16} />
            {loading ? 'Running...' : 'Run comparison'}
          </button>
        </div>

        {/* 4. Results */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 text-center">4. Results</h3>
          {result ? (
            <ResultsBlock result={result} classical={classical} quantum={quantum} />
          ) : (
            <div className="text-sm text-gray-700 text-center">Run a comparison to see results.</div>
          )}
        </section>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
          {modalBody}
        </Modal>
      </div>
    </div>
  )

  function ResultsBlock({ result, classical, quantum }:{ result: CompareResult, classical: ClassicalModelKey, quantum: QuantumModelKey }) {
    const curves = useMemo(() => {
      if (!result?.diagnostics?.y_true) return null
      const y = result.diagnostics.y_true
      const pc = result.diagnostics.classical?.proba || []
      const pq = result.diagnostics.quantum?.proba || []
      return {
        rocC: microRoc(y, pc).curve,
        rocQ: microRoc(y, pq).curve,
        prC:  microPr(y, pc).curve,
        prQ:  microPr(y, pq).curve,
      }
    }, [result])

    const barData = useMemo(() => ([
      { metric: 'Accuracy',   Classical: result.metrics.classical.accuracy,   Quantum: result.metrics.quantum.accuracy },
      { metric: 'F1',         Classical: result.metrics.classical.f1,         Quantum: result.metrics.quantum.f1 },
      { metric: 'AUC',        Classical: result.metrics.classical.auc,        Quantum: result.metrics.quantum.auc },
      { metric: 'Loss',       Classical: result.metrics.classical.loss,       Quantum: result.metrics.quantum.loss },
      { metric: 'Time (ms)',  Classical: result.metrics.classical.latency_ms, Quantum: result.metrics.quantum.latency_ms },
    ]), [result])

    return (
      <div className="space-y-6">
        <div className="card text-center">
          <div className="text-sm text-gray-600">Summary</div>
          <div className="mt-1 font-semibold">
            {CLASSICAL_MODELS[classical].name} vs {QUANTUM_MODELS[quantum].name}
          </div>
          <div className="text-sm text-gray-700">
            Samples: {result.summary.samples}
            {result.summary.target ? <> · Target: <span className="font-mono">{result.summary.target}</span></> : null}
            {result.summary.n_features != null ? <> · Features: {result.summary.n_features}</> : null}
          </div>
          {result.summary.classes && result.summary.class_counts && (
            <div className="mt-2 text-xs text-gray-700">
              Class distribution: {result.summary.classes.map((c) => `${c}=${result.summary.class_counts?.[c] ?? 0}`).join(' · ')}
            </div>
          )}
          {result.notes && <div className="mt-2 text-xs text-gray-600">{result.notes}</div>}
        </div>

        <div className="card">
          <div className="font-semibold text-center">Overall verdict</div>
          <p className="text-sm text-gray-800 mt-1 text-center">{overallVerdict()}</p>
        </div>

        {/* Metric pairs: Classical vs Quantum */}
        <div className="space-y-3">
          {METRIC_ORDER.map((k) => (
            <div key={k} className="grid sm:grid-cols-2 gap-3">
              <MetricCard label={`${FRIENDLY[k].name} (C)`} value={result.metrics.classical[k]} help={FRIENDLY[k].explain} />
              <MetricCard label={`${FRIENDLY[k].name} (Q)`} value={result.metrics.quantum[k]} help={FRIENDLY[k].explain} />
            </div>
          ))}
        </div>

        <MetricBars data={barData} />

        {result.details && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="card">
              <div className="font-semibold mb-2 text-center">Confusion (Classical)</div>
              <ConfusionTable cm={result.details.classical.confusion} classes={result.summary.classes || []} />
              <SmallTimings timings={result.details.classical.timings} />
            </div>
            <div className="card">
              <div className="font-semibold mb-2 text-center">Confusion (Quantum)</div>
              <ConfusionTable cm={result.details.quantum.confusion} classes={result.summary.classes || []} />
              <SmallTimings timings={result.details.quantum.timings} />
            </div>
          </div>
        )}

        {curves && (
          <div className="grid sm:grid-cols-2 gap-3">
            <RocCurve classical={curves.rocC} quantum={curves.rocQ} />
            <PrCurve classical={curves.prC} quantum={curves.prQ} />
          </div>
        )}
      </div>
    )
  }
}

function ConfusionTable({ cm, classes }: { cm: number[][], classes: string[] }) {
  if (!cm?.length) return <div className="text-sm text-gray-600">No confusion matrix.</div>
  const max = Math.max(...cm.flat())
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs border rounded">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1">True \\ Pred →</th>
            {classes.map((c) => <th key={c} className="px-2 py-1">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {cm.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
              <td className="px-2 py-1 font-medium">{classes[i] || i}</td>
              {row.map((v, j) => {
                const a = max > 0 ? v / max : 0
                return (
                  <td key={j} className="px-2 py-1 text-right tabular-nums" style={{ backgroundColor: `rgba(59,130,246,${0.15 * a})` }}>
                    {v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-600 mt-2 text-center">Darker cells show where more examples landed.</div>
    </div>
  )
}

function SmallTimings({ timings }: { timings?: { train_ms: number, infer_ms: number } }) {
  if (!timings) return null
  return (
    <div className="mt-3 text-xs text-gray-600 text-center">
      Train: <span className="tabular-nums">{timings.train_ms.toFixed(1)} ms</span> ·
      Inference: <span className="tabular-nums">{timings.infer_ms.toFixed(1)} ms</span>
    </div>
  )
}
