import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, BarChart, Bar, ReferenceLine } from 'recharts'
import type { Point } from '../lib/curves'

const BLUE = '#2563EB'   // classical
const ORANGE = '#F59E0B' // quantum

export function MetricBars({ data }: { data: Array<{ metric: string; Classical: number; Quantum: number }> }) {
  return (
    <div className="card">
      <div className="font-semibold mb-2">Headline metrics</div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="metric" />
            <YAxis />
            <RTooltip />
            <Legend />
            <Bar dataKey="Classical" name="Classical" fill={BLUE} radius={[6,6,0,0]} />
            <Bar dataKey="Quantum"   name="Quantum"   fill={ORANGE} radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-600 mt-2">Higher is better for Accuracy, F1, AUC. Lower is better for Loss and Time.</div>
    </div>
  )
}

export function RocCurve({ classical, quantum }: { classical: Point[]; quantum: Point[] }) {
  return (
    <div className="card">
      <div className="font-semibold mb-2">ROC curve (micro-average)</div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" domain={[0,1]} name="False positive rate" />
            <YAxis type="number" domain={[0,1]} name="True positive rate" />
            <RTooltip />
            <Legend />
            {/* optional diagonal reference */}
            <ReferenceLine segment={[{ x:0, y:0 }, { x:1, y:1 }]} stroke="#9CA3AF" strokeDasharray="4 4" ifOverflow="extendDomain" />
            <Line data={classical} dataKey="y" name="Classical" dot={false} stroke={BLUE} strokeWidth={2} />
            <Line data={quantum}   dataKey="y" name="Quantum"   dot={false} stroke={ORANGE} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-600 mt-2">Above the diagonal is good. Closer to the top-left means fewer false alarms and more correct detections.</div>
    </div>
  )
}

export function PrCurve({ classical, quantum }: { classical: Point[]; quantum: Point[] }) {
  return (
    <div className="card">
      <div className="font-semibold mb-2">Precision–Recall curve (micro-average)</div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" domain={[0,1]} name="Recall" />
            <YAxis type="number" dataKey="y" domain={[0,1]} name="Precision" />
            <RTooltip />
            <Legend />
            <Line data={classical} dataKey="y" name="Classical" dot={false} stroke={BLUE} strokeWidth={2} />
            <Line data={quantum}   dataKey="y" name="Quantum"   dot={false} stroke={ORANGE} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-600 mt-2">Higher is better. Curves near the top-right indicate fewer misses and fewer false positives.</div>
    </div>
  )
}
