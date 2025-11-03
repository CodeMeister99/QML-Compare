// frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export async function compareModels(
  file: File,
  payload: {
    classicalModel: string
    quantumModel: string
    classicalParams: Record<string, number | string>
    quantumParams: Record<string, number | string>
    targetColumn: string
  }
) {
  const form = new FormData()
  form.append('file', file)
  form.append('classicalModel', payload.classicalModel)
  form.append('quantumModel', payload.quantumModel)
  form.append('classicalParams', JSON.stringify(payload.classicalParams))
  form.append('quantumParams', JSON.stringify(payload.quantumParams))
  form.append('targetColumn', payload.targetColumn)

  const res = await fetch(`${API_BASE}/api/compare`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Compare failed: ${res.status}`)
  return res.json()
}

export async function quickcheck(file: File, opts?: { target?: string, dataType?: 'tabular' | 'image' | 'video' }) {
  const form = new FormData()
  form.append('file', file)
  form.append('data_type', opts?.dataType || 'tabular')
  if (opts?.target) form.append('target', opts.target)
  const res = await fetch(`${API_BASE}/api/quickcheck`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Quickcheck failed: ${res.status}`)
  return res.json()
}
