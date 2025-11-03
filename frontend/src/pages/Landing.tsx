// src/pages/Landing.tsx
import { memo, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/** Lightweight SVG quantum-circuit background with built-in CSS */
const QuantumCircuitBg = memo(function QuantumCircuitBg() {
  const wires = [80, 140, 200, 260, 320, 380]
  const gates = [0, 140, 280, 420, 560, 700, 840, 980, 1120]

  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.32] [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
      <style>{`
        @keyframes qc-pan{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .animate-circuit-pan{animation:qc-pan 28s linear infinite}
        .animate-circuit-pan-slower{animation:qc-pan 42s linear infinite}
        @keyframes qc-gate-pulse{0%,100%{opacity:.75;filter:drop-shadow(0 0 0 rgba(129,140,248,0))}50%{opacity:1;filter:drop-shadow(0 0 12px rgba(129,140,248,.35))}}
        .qc-gate{transform-origin:center;animation:qc-gate-pulse 4.8s ease-in-out infinite}
        @keyframes qc-node-blink{0%,100%{opacity:.5}50%{opacity:.95}}
        .qc-node-blink{animation:qc-node-blink 3.6s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){
          .animate-circuit-pan,.animate-circuit-pan-slower,.qc-gate,.qc-node-blink{animation:none!important}
        }
      `}</style>

      {/* soft ambient glow */}
      <div className="absolute -inset-12 blur-[32px] bg-[radial-gradient(60%_50%_at_50%_40%,rgba(99,102,241,0.18),transparent_70%)]" />

      {/* Layer A */}
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

        {wires.map((y, i) => (
          <line key={`wA-${i}`} x1="0" y1={y} x2="1200" y2={y} stroke="url(#qc-wire)" strokeWidth="1.2" />
        ))}

        {wires.map((y, row) =>
          gates.map((x, col) =>
            (row + col) % 2 ? (
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
              <g key={`nA-${row}-${col}`} transform={`translate(${x + 6}, ${y})`}>
                <circle r="3" fill="white" opacity="0.9" />
                <circle r="10" fill="url(#qc-node)" />
              </g>
            )
          )
        )}
      </svg>

      {/* Layer B */}
      <svg
        className="absolute -inset-x-1 top-0 h-full w-[200%] animate-circuit-pan-slower"
        viewBox="0 0 1200 460"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {wires.map((y, i) => (
          <line key={`wB-${i}`} x1="0" y1={y + 10} x2="1200" y2={y + 10} stroke="rgba(148,163,184,.12)" strokeWidth="1" />
        ))}
        {wires.map((y, row) =>
          gates.map((x, col) => (
            <circle key={`nB-${row}-${col}`} cx={x + 60} cy={y + 10} r="2.2" fill="rgba(255,255,255,.7)" className="qc-node-blink" />
          ))
        )}
      </svg>
    </div>
  )
})

export default function Landing() {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-white">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0b0d14] to-[#0e1220]" />

      {/* Quantum circuit backdrop */}
      <QuantumCircuitBg />

      {/* Animated grid */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.55]"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(129,140,248,.7)" />
            <stop offset="1" stopColor="rgba(99,102,241,.3)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 26 }).map((_, i) => {
          const x = i * 40
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1="0"
              x2={x}
              y2="1000"
              stroke="url(#g)"
              strokeWidth="0.8"
              className="animate-draw"
              style={{ animationDelay: `${i * 25}ms` }}
            />
          )
        })}

        {Array.from({ length: 26 }).map((_, i) => {
          const y = i * 40
          return (
            <line
              key={`h-${i}`}
              x1="0"
              y1={y}
              x2="1000"
              y2={y}
              stroke="url(#g)"
              strokeWidth="0.8"
              className="animate-draw"
              style={{ animationDelay: `${i * 25}ms` }}
            />
          )
        })}
      </svg>

      {/* Center content */}
      <div className="relative z-10 mx-auto flex h-screen max-w-5xl items-center justify-center px-6">
        <div className="text-center">
          {/* Boxed emblem with prominent symbol */}
          <div className="mx-auto mb-8 relative grid h-32 w-32 sm:h-36 sm:w-36 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-[2px] animate-fade-in-slow">
            <img
              src="/logo.png"
              alt="QML Compare logo"
              className="h-28 w-28 sm:h-32 sm:w-32 object-contain"
              draggable={false}
              style={{ filter: 'drop-shadow(0 8px 26px rgba(99,102,241,0.5)) saturate(1.1) contrast(1.05)' }}
            />
          </div>

          {/* Wordmark */}
          <h1 className="font-extrabold tracking-tight text-4xl sm:text-5xl md:text-6xl animate-rise">
            QML Compare
          </h1>

          {/* Subline */}
          <p
            className={`mx-auto mt-3 max-w-xl text-sm sm:text-base text-slate-300 transition-opacity duration-600 ${
              showContent ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Classical vs quantum, side by side. Upload a CSV, pick models, read clear metrics.
          </p>

          {/* CTA */}
          <div
            className={`mt-8 inline-block transition-opacity duration-600 ${
              showContent ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Link
              to="/compare"
              className="inline-flex items-center gap-2 px-5 py-2 text-base rounded-lg bg-[rgb(var(--brand))] text-white hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <span>Start comparing</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Skip intro */}
      {!showContent && (
        <button
          onClick={() => setShowContent(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-slate-400/80 hover:text-slate-200 transition"
        >
          Skip intro
        </button>
      )}
    </div>
  )
}
