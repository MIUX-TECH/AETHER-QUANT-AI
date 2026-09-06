import React from 'react'
import { SectionHeader, fmtPrice, SignalBadge } from '../shared'
import { ArrowUpRight } from 'lucide-react'

export function TopSignalsList({ signals, navigate }: any) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader
          title="Radar Sinyal 8 Pilar Teratas"
          subtitle="Hasil pemindaian kuantitatif terkonfirmasi Qwen AI"
        />
        <button className="btn btn-ghost btn-xs" onClick={() => navigate('/scanner')} style={{ fontSize: 10 }}>
          Buka Pemindai <ArrowUpRight size={10} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
        {signals.slice(0, 6).map((sig: any, i: number) => (
          <div
            key={i}
            className="p-2 rounded bg-deep border border-border flex flex-col justify-between"
            style={{ minHeight: 80 }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="mono font-bold" style={{ fontSize: 12 }}>{sig.symbol}</span>
                <span className="badge badge-muted" style={{ fontSize: 7.5 }}>{sig.regime.toUpperCase()}</span>
              </div>
              <SignalBadge signal={sig.signal} />
            </div>

            <div className="flex items-center justify-between mono mb-1" style={{ fontSize: 9.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>${fmtPrice(sig.price)}</span>
              <span style={{ color: sig.change >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                {sig.change >= 0 ? '+' : ''}{sig.change.toFixed(2)}%
              </span>
            </div>

            <div className="pt-1 border-t border-border flex items-center justify-between" style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Skor 8 Pilar:</span>
              <span className="font-bold" style={{ color: sig.confidence >= 0.68 ? 'var(--bull)' : 'var(--text-secondary)' }}>
                {(sig.confidence * 100).toFixed(0)}% {sig.confidence >= 0.68 ? '✓ AI APPROVED' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
