// src/QuantumCircuitBg.tsx
import { memo } from 'react'

/**
 * Lightweight SVG "quantum circuit" background.
 * - Faint wires with moving gates and nodes
 * - Two duplicated bands that pan for a seamless loop
 * - Pointer-events disabled; purely decorative
 */
function QuantumCircuitBgBase() {
  // vertical positions for circuit "wires"
  const wires = [80, 140, 200, 260, 320, 380]
  // x positions (pattern repeats)
  const gates = [0, 140, 280, 420, 560, 700, 840, 980, 1120]

  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
      {/* subtle blur glow backdrop */}
      <div className="absolute -inset-12 blur-[32px] bg-[radial-gradient(60%_50%_at_50%_40%,rgba(99,102,241,0.18),transparent_70%)]" />

      {/* Scrolling layer A */}
      <svg
        className="absolute -inset-x-1 top-0 h-full w-[200%] animate-circuit-pan"
        viewBox="0 0 1200 460"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="qc-wire" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgba(148,163,184,.25)" />
            <stop offset="1" stopColor="rgba(148,163,184,.15)" />
          </linearGradient>
          <linearGradient id="qc-gate" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(129,140,248,.9)" />
            <stop offset="1" stopColor="rgba(99,102,241,.6)" />
          </linearGradient>
          <radialGradient id="qc-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(99,102,241,.95)" />
            <stop offset="60%" stopColor="rgba(129,140,248,.35)" />
            <stop offset="100%" stopColor="rgba(129,140,248,0)" />
          </radialGradient>
        </defs>

        {/* wires */}
        {wires.map((y, i) => (
          <line
            key={`wA-${i}`}
            x1="0"
            y1={y}
            x2="1200"
            y2={y}
            stroke="url(#qc-wire)"
            strokeWidth="1.2"
          />
        ))}

        {/* gates + nodes repeated across */}
        {wires.map((y, row) =>
          gates.map((x, col) => {
            const odd = (row + col) % 2 === 1
            return odd ? (
              // gate (rounded rect)
              <rect
                key={`gA-${row}-${col}`}
                x={x + (row % 2 ? 18 : 0)}
                y={y - 12}
                width="30"
                height="24"
                rx="6"
                fill="url(#qc-gate)"
                className="qc-gate"
              />
            ) : (
              // node (entangled dot with halo)
              <g key={`nA-${row}-${col}`} transform={`translate(${x + 6}, ${y})`}>
                <circle r="3" fill="white" opacity="0.9" />
                <circle r="10" fill="url(#qc-node)" />
              </g>
            )
          })
        )}
      </svg>

      {/* Scrolling layer B (offset for seamless loop & parallax) */}
      <svg
        className="absolute -inset-x-1 top-0 h-full w-[200%] animate-circuit-pan-slower"
        viewBox="0 0 1200 460"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* reuse defs by redrawing simpler shapes with slight offset */}
        {wires.map((y, i) => (
          <line
            key={`wB-${i}`}
            x1="0"
            y1={y + 10}
            x2="1200"
            y2={y + 10}
            stroke="rgba(148,163,184,.12)"
            strokeWidth="1"
          />
        ))}

        {wires.map((y, row) =>
          gates.map((x, col) => (
            <circle
              key={`nB-${row}-${col}`}
              cx={x + 60}
              cy={y + 10}
              r="2.2"
              fill="rgba(255,255,255,.7)"
              className="qc-node-blink"
            />
          ))
        )}
      </svg>
    </div>
  )
}

const QuantumCircuitBg = memo(QuantumCircuitBgBase)
export default QuantumCircuitBg
