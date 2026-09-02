// src/components/memory/MemoryPage.tsx

import React, { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, EmptyState, LoadingSpinner, ConfidenceBar, fmtTime } from '../shared'
import { BookOpen, RefreshCw, Brain, TrendingUp, AlertTriangle } from 'lucide-react'
import { api } from '../../utils/api'

export default function MemoryPage() {
  const { memory, refreshMemory } = useStore()

  useEffect(() => { refreshMemory() }, [])

  const m = memory

  if (!m) {
    return (
      <div className="page">
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 20 }}>Memory & Learning</h1>
        <div className="flex justify-center p-8"><LoadingSpinner size={24} /></div>
      </div>
    )
  }

  const handleLearningUpdate = async () => {
    await api.control('trigger_learning')
    setTimeout(refreshMemory, 1500)
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Memori & Pembelajaran</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {m.total_trades_analyzed || 0} trades analyzed · Last: {fmtTime(m.last_updated || '')}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={handleLearningUpdate}>
            <Brain size={12} /> Update
          </button>
          <button className="btn btn-ghost btn-sm" onClick={refreshMemory}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Adaptive weights */}
      {m.adaptive_weights && Object.keys(m.adaptive_weights).length > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Adaptive Score Weights" subtitle="Adjusted based on historical performance" />
          <div className="flex flex-col gap-3">
            {Object.entries(m.adaptive_weights).map(([key, val]: [string, any]) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    {key}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>
                    {(val * 100).toFixed(1)}%
                  </span>
                </div>
                <ConfidenceBar value={val} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy performance */}
      {m.strategy_performance && Object.keys(m.strategy_performance).length > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Strategy Performance" subtitle="Learned from trade outcomes" />
          <div className="flex flex-col gap-3">
            {Object.entries(m.strategy_performance).map(([strat, s]: [string, any]) => (
              <div key={strat} style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--bg-border)' }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                    {strat.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {s.trade_count || 0} trades
                    </span>
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: (s.win_rate || 0) >= 0.5 ? 'var(--bull)' : 'var(--bear)'
                    }}>
                      {((s.win_rate || 0) * 100).toFixed(1)}% WR
                    </span>
                  </div>
                </div>
                <ConfidenceBar value={s.win_rate || 0.5} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coin profiles */}
      {m.coin_profiles && Object.keys(m.coin_profiles).length > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Coin Profiles" subtitle="Per-asset learned behavior" />
          <div className="grid-2 gap-3">
            {Object.entries(m.coin_profiles).map(([sym, p]: [string, any]) => (
              <div key={sym} style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {sym.replace('USDT', '')}
                </div>
                <div className="flex flex-col gap-1" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  <span>Best strategy: <strong style={{ color: 'var(--accent-lime)' }}>{p.best_strategy || '—'}</strong></span>
                  <span>Trades: <strong>{p.trade_count || 0}</strong></span>
                  <span>Win rate: <strong style={{ color: (p.win_rate || 0) >= 0.5 ? 'var(--bull)' : 'var(--bear)' }}>
                    {((p.win_rate || 0) * 100).toFixed(1)}%
                  </strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regime performance */}
      {m.regime_performance && Object.keys(m.regime_performance).length > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Regime Performance" subtitle="Win rate by market condition" />
          <div className="flex flex-col gap-2">
            {Object.entries(m.regime_performance).map(([regime, r]: [string, any]) => (
              <div key={regime} className="flex items-center gap-3">
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', minWidth: 120, color: 'var(--text-secondary)' }}>
                  {regime.replace(/_/g, ' ')}
                </span>
                <div style={{ flex: 1 }}>
                  <ConfidenceBar value={r.win_rate || 0.5} size="sm" />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right', color: 'var(--text-muted)' }}>
                  {r.trades || 0} trades
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lessons */}
      {m.lessons && m.lessons.length > 0 && (
        <div className="card p-4">
          <SectionHeader title="Lessons Learned" subtitle="Derived from losing trades" />
          <div className="flex flex-col gap-2">
            {m.lessons.slice(0, 10).map((lesson: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={11} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {lesson.symbol?.replace('USDT', '')} · {lesson.regime}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--bear)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                    {lesson.pnl_pct?.toFixed(2)}%
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                  {lesson.note} · Reason: {lesson.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!m.lessons || m.lessons.length === 0) && m.total_trades_analyzed === 0 && (
        <EmptyState icon={<BookOpen size={32} />} message="No learning data yet. The system will analyze trades as they close and adapt its weights accordingly." />
      )}
    </div>
  )
}
