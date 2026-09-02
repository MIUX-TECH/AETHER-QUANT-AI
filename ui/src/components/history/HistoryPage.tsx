// src/components/history/HistoryPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, PnlDisplay, SignalBadge, EmptyState, fmtPrice, fmtTime } from '../shared'
import { History, Filter, TrendingUp, TrendingDown } from 'lucide-react'

export default function HistoryPage() {
  const { history, refreshHistory, loading } = useStore()
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [symbolFilter, setSymbolFilter] = useState('')

  useEffect(() => { refreshHistory() }, [])

  const filtered = history
    .filter(t => filter === 'all' || t.result === filter)
    .filter(t => !symbolFilter || t.symbol?.includes(symbolFilter.toUpperCase()))
    .sort((a, b) => (b.closed_at || '').localeCompare(a.closed_at || ''))

  const wins = history.filter(t => t.result === 'win').length
  const losses = history.filter(t => t.result === 'loss').length
  const winRate = history.length > 0 ? (wins / history.length * 100).toFixed(1) : '0'
  const totalPnl = history.reduce((s, t) => s + (t.pnl_usdt || 0), 0)

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Jurnal Transaksi</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {history.length} trades · Win Rate: {winRate}% · PnL: ${totalPnl.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid-4 gap-3 mb-4">
        {[
          { label: 'Total Trades', value: history.length },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Total PnL', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}` },
          { label: 'Avg RR', value: history.length > 0 ? (history.reduce((s, t) => s + (t.rr_ratio || 0), 0) / history.length).toFixed(2) : '—' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'win', 'loss'] as const).map(f => (
          <button key={f} className={`btn btn-ghost btn-sm ${filter === f ? '' : ''}`}
            style={filter === f ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'win' ? `✅ Wins (${wins})` : `❌ Losses (${losses})`}
          </button>
        ))}
        <input
          className="input"
          style={{ width: 100, padding: '4px 10px', fontSize: 12 }}
          placeholder="Symbol..."
          value={symbolFilter}
          onChange={e => setSymbolFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={<History size={32} />} message="Belum ada transaksi tercatat." />
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((trade: any, i: number) => (
          <TradeRow key={i} trade={trade} />
        ))}
      </div>
    </div>
  )
}

function TradeRow({ trade }: { trade: any }) {
  const [open, setOpen] = useState(false)
  const isWin = trade.result === 'win'

  return (
    <div className="card" style={{ overflow: 'hidden', borderLeft: `3px solid ${isWin ? 'var(--bull)' : 'var(--bear)'}` }}>
      <div className="flex items-center gap-3 p-3" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isWin ? 'var(--bull)' : 'var(--bear)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {trade.symbol?.replace('USDT', '')}
            </span>
            <span className={`badge ${trade.side === 'BUY' ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 9 }}>
              {trade.side === 'BUY' ? '▲ LONG' : '▼ SHORT'}
            </span>
            {trade.leverage > 1 && (
              <span className="badge badge-warn" style={{ fontSize: 9 }}>{trade.leverage}x</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {trade.strategy}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {fmtTime(trade.closed_at || '')} · {trade.close_reason} · held {trade.hold_duration || '?'}
          </div>
        </div>
        <div className="text-right">
          <PnlDisplay value={trade.pnl_usdt || 0} pct={trade.pnl_pct} size="sm" />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            RR: {trade.rr_ratio || '—'}
          </div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--bg-border)', padding: '12px 16px', background: 'var(--bg-deep)' }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            <span>Entry: <strong>{fmtPrice(trade.entry_price)}</strong></span>
            <span>Exit: <strong>{fmtPrice(trade.close_price)}</strong></span>
            <span>Size: <strong>${(trade.position_usdt || 0).toFixed(2)}</strong></span>
            <span>Qty: <strong>{(trade.qty || 0).toFixed(6)}</strong></span>
            <span>SL was: <strong>{fmtPrice(trade.sl_price)}</strong></span>
            <span>TP was: <strong>{fmtPrice(trade.tp_price)}</strong></span>
            <span>Conf: <strong>{((trade.confidence || 0) * 100).toFixed(0)}%</strong></span>
            <span>Regime: <strong>{trade.regime || '—'}</strong></span>
            <span>Fee: <strong>${(trade.fee_total || 0).toFixed(4)}</strong></span>
          </div>
          {trade.reasoning && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>AI Reasoning</div>
              <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {trade.reasoning}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
