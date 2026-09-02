// src/components/positions/PositionsPage.tsx

import React, { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, PnlDisplay, SignalBadge, RegimePill, ConfidenceBar, fmtPrice, fmtTime, EmptyState } from '../shared'
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react'

export default function PositionsPage() {
  const { positions, refresh, loading } = useStore()
  const spot = positions?.spot || []
  const futures = positions?.futures || []
  const total = spot.length + futures.length

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Posisi Aktif</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {total} open · spot: {spot.length} · futures: {futures.length}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>
          <RefreshCw size={12} />
        </button>
      </div>

      {total === 0 && (
        <EmptyState
          icon={<Activity size={32} />}
          message="No active positions. System will enter when conditions are met."
        />
      )}

      {/* Spot positions */}
      {spot.length > 0 && (
        <div className="mb-4">
          <SectionHeader title="Posisi Spot" subtitle={`${spot.length} aktif`} />
          <div className="flex flex-col gap-3">
            {spot.map((pos: any, i: number) => (
              <PositionCard key={i} position={pos} type="spot" />
            ))}
          </div>
        </div>
      )}

      {/* Futures positions */}
      {futures.length > 0 && (
        <div>
          <SectionHeader title="Posisi Futures" subtitle={`${futures.length} aktif · berlever`} />
          <div className="flex flex-col gap-3">
            {futures.map((pos: any, i: number) => (
              <PositionCard key={i} position={pos} type="futures" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PositionCard({ position: pos, type }: { position: any; type: string }) {
  const isBull = pos.side === 'BUY'
  const pnl = pos.unrealized_pnl || 0
  const pnlPct = pos.unrealized_pnl_pct || 0
  const isProfit = pnl >= 0

  const riskToSL = pos.entry_price && pos.sl_price
    ? ((pos.entry_price - pos.sl_price) / pos.entry_price * 100).toFixed(2)
    : null
  const toTP = pos.entry_price && pos.tp_price
    ? ((pos.tp_price - pos.entry_price) / pos.entry_price * 100).toFixed(2)
    : null

  return (
    <div className="card" style={{ overflow: 'hidden', borderLeft: `3px solid ${isBull ? 'var(--bull)' : 'var(--bear)'}` }}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {isBull
              ? <TrendingUp size={14} style={{ color: 'var(--bull)' }} />
              : <TrendingDown size={14} style={{ color: 'var(--bear)' }} />
            }
            <span style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.02em' }}>
              {pos.symbol?.replace('USDT', '')}
            </span>
            <span className={`badge ${isBull ? 'badge-bull' : 'badge-bear'}`}>
              {isBull ? 'LONG' : 'SHORT'}
            </span>
            {type === 'futures' && (
              <span className="badge badge-warn">{pos.leverage}x</span>
            )}
            {pos.partial_tp_taken && (
              <span className="badge badge-lime">½TP</span>
            )}
          </div>
          <PnlDisplay value={pnl} pct={pnlPct} size="md" />
        </div>

        {/* Price levels grid */}
        <div className="grid-4 gap-2 mb-3">
          <PriceBox label="Harga Masuk" value={fmtPrice(pos.entry_price)} />
          <PriceBox label="Saat Ini" value={fmtPrice(pos.current_price)} highlight />
          <PriceBox label="Stop Loss" value={fmtPrice(pos.sl_price)} danger />
          <PriceBox label="Take Profit" value={fmtPrice(pos.tp_price)} bull />
        </div>

        {/* Trailing stop */}
        {pos.trailing_stop_price && (
          <div className="flex items-center gap-2 mb-3" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>
            <AlertTriangle size={11} />
            Trailing Stop: {fmtPrice(pos.trailing_stop_price)}
          </div>
        )}

        {/* Details */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Detail label="Ukuran" value={`$${(pos.position_usdt || 0).toFixed(2)}`} />
          <Detail label="Kuantitas" value={(pos.qty || 0).toFixed(6)} />
          {riskToSL && <Detail label="Risiko SL" value={`${riskToSL}%`} danger />}
          {toTP && <Detail label="ke TP" value={`${toTP}%`} bull />}
          <Detail label="Strategi" value={pos.strategy || '—'} />
          <Detail label="Regim" value={pos.regime || '—'} />
          <Detail label="Dibuka" value={fmtTime(pos.opened_at || '')} />
          {pos.confidence && <Detail label="Keyakinan" value={`${(pos.confidence * 100).toFixed(0)}%`} />}
        </div>
      </div>
    </div>
  )
}

function PriceBox({ label, value, highlight, danger, bull }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; bull?: boolean
}) {
  return (
    <div style={{
      background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)',
      padding: '6px 10px', border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : bull ? 'rgba(34,197,94,0.15)' : 'var(--bg-border)'}`,
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500,
        color: danger ? 'var(--bear)' : bull ? 'var(--bull)' : highlight ? 'var(--accent-lime)' : 'var(--text-primary)',
      }}>{value}</div>
    </div>
  )
}

function Detail({ label, value, danger, bull }: {
  label: string; value: string; danger?: boolean; bull?: boolean
}) {
  return (
    <div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}: </span>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)',
        color: danger ? 'var(--bear)' : bull ? 'var(--bull)' : 'var(--text-secondary)',
      }}>{value}</span>
    </div>
  )
}
