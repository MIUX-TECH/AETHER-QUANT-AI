// src/components/ai/AIDecisionsPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, SignalBadge, EmptyState, fmtTime } from '../shared'
import { Brain, Filter, RefreshCw } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  entry_spot: 'var(--bull)',
  entry_futures_buy: 'var(--bull)',
  entry_futures_sell: 'var(--bear)',
  exit_stop_loss: 'var(--bear)',
  exit_take_profit: 'var(--bull)',
  exit_trailing_stop: 'var(--warn)',
  exit_signal_reversal: 'var(--warn)',
  partial_tp: 'var(--accent-lime)',
  skip: 'var(--text-muted)',
  blocked: 'var(--bear)',
  futures_blocked: 'var(--bear)',
  hold: 'var(--text-secondary)',
}

const ACTION_ICON: Record<string, string> = {
  entry_spot: '📈',
  entry_futures_buy: '🚀',
  entry_futures_sell: '📉',
  exit_stop_loss: '🛑',
  exit_take_profit: '✅',
  exit_trailing_stop: '🔄',
  exit_signal_reversal: '↩️',
  partial_tp: '½',
  skip: '⏭️',
  blocked: '🚫',
  futures_blocked: '🚫',
  hold: '⏸️',
}

export default function AIDecisionsPage() {
  const { decisions, refreshDecisions } = useStore()
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => { refreshDecisions() }, [])

  const actionTypes = Array.from(new Set(decisions.map((d: any) => d.action))).slice(0, 10)

  const filtered = decisions
    .filter((d: any) => actionFilter === 'all' || d.action === actionFilter)
    .slice().reverse()
    .slice(0, 100)

  const entryCount = decisions.filter((d: any) => d.action?.startsWith('entry')).length
  const skipCount = decisions.filter((d: any) => d.action === 'skip' || d.action === 'blocked').length
  const exitCount = decisions.filter((d: any) => d.action?.startsWith('exit')).length

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Log Keputusan AI</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {decisions.length} decisions · {entryCount} entries · {exitCount} exits · {skipCount} skipped
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refreshDecisions}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button className={`btn btn-ghost btn-sm`}
          style={actionFilter === 'all' ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
          onClick={() => setActionFilter('all')}>All</button>
        {['entry_spot', 'exit_take_profit', 'exit_stop_loss', 'skip', 'blocked'].map(a => (
          <button key={a} className="btn btn-ghost btn-sm"
            style={actionFilter === a ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
            onClick={() => setActionFilter(a)}>
            {ACTION_ICON[a] || ''} {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={<Brain size={32} />} message="No decisions recorded yet. The AI will log all decisions here." />
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((dec: any, i: number) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${ACTION_COLORS[dec.action] || 'var(--bg-border)'}` }}>
            <div className="flex items-start gap-3 p-3">
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ACTION_ICON[dec.action] || '◈'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: ACTION_COLORS[dec.action] || 'var(--text-primary)' }}>
                    {dec.action?.toUpperCase().replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {dec.symbol || '—'}
                  </span>
                  {dec.signal && <SignalBadge signal={dec.signal} />}
                  {dec.confidence > 0 && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {(dec.confidence * 100).toFixed(0)}% conf
                    </span>
                  )}
                  {dec.regime && (
                    <span className="badge badge-muted" style={{ fontSize: 9 }}>
                      {dec.regime}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                    {fmtTime(dec.timestamp)}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                  {dec.reason}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge mode-${dec.mode}`} style={{ fontSize: 9 }}>{dec.mode?.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
