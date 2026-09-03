// src/components/positions/PositionsPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, PnlDisplay, fmtPrice, fmt, EmptyState, TestnetWalletWidget } from '../shared'
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Layers, Wallet, ArrowUpRight } from 'lucide-react'

export default function PositionsPage() {
  const { positions, wallet, refresh, loading, setActiveTab } = useStore()
  const spot = positions?.spot || []
  const futures = positions?.futures || []
  const total = spot.length + futures.length
  const holdings = wallet?.assets?.filter(a => !['USDT', 'USD', 'USDC'].includes(a.asset) && a.total > 0) || []

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page">
      <TestnetWalletWidget />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Posisi & Kepemilikan Terbuka</h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            {total} Posisi Bot Aktif · {holdings.length} Aset Spot Terdaftar
          </p>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={refresh} disabled={loading}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Active Spot Bot Positions */}
      {spot.length > 0 && (
        <div className="mb-3">
          <SectionHeader title="Posisi Bot Spot" subtitle={`${spot.length} posisi dengan proteksi TP/SL aktif`} />
          <div className="flex flex-col gap-2">
            {spot.map((pos: any, i: number) => (
              <PositionCard key={i} position={pos} type="spot" />
            ))}
          </div>
        </div>
      )}

      {/* Active Futures Bot Positions */}
      {futures.length > 0 && (
        <div className="mb-3">
          <SectionHeader title="Posisi Bot Futures" subtitle={`${futures.length} kontrak leverage aktif`} />
          <div className="flex flex-col gap-2">
            {futures.map((pos: any, i: number) => (
              <PositionCard key={i} position={pos} type="futures" />
            ))}
          </div>
        </div>
      )}

      {/* Spot Asset Holdings Section */}
      {holdings.length > 0 && (
        <div className="card p-2.5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <SectionHeader
              title={`Saldo Aset Spot Testnet (${holdings.length})`}
              subtitle="Koin kripto yang saat ini tersimpan di akun Spot Binance Testnet"
            />
            <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('portfolio')} style={{ fontSize: 10 }}>
              Kelola Portofolio <ArrowUpRight size={10} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {holdings.map((h: any, i: number) => (
              <div key={i} className="p-2" style={{ background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{h.asset}</span>
                    <span className="badge badge-bull" style={{ fontSize: 8 }}>SPOT HOLDING</span>
                  </div>
                  <span className="bull mono" style={{ fontSize: 12, fontWeight: 700 }}>
                    ${(h.usd_value || (h.total * h.price)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  <span>Kuantitas: {Number(h.total || 0).toFixed(4)} {h.asset}</span>
                  <span>Harga: ${Number(h.price || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && holdings.length === 0 && (
        <EmptyState
          icon={<Activity size={28} />}
          message="Tidak ada posisi terbuka. Bot akan membuka order saat sinyal teknikal terkonfirmasi."
        />
      )}
    </div>
  )
}

function PositionCard({ position: pos, type }: { position: any; type: string }) {
  const isBull = pos.side === 'BUY' || pos.side === 'LONG'
  const pnl = pos.unrealized_pnl || 0
  const pnlPct = pos.unrealized_pnl_pct || 0

  return (
    <div className="card p-2.5" style={{ overflow: 'hidden', borderLeft: `3px solid ${isBull ? 'var(--bull)' : 'var(--bear)'}` }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {isBull
            ? <TrendingUp size={12} style={{ color: 'var(--bull)' }} />
            : <TrendingDown size={12} style={{ color: 'var(--bear)' }} />
          }
          <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
            {pos.symbol}
          </span>
          <span className={`badge ${isBull ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 8 }}>
            {isBull ? 'LONG / BELI' : 'SHORT / JUAL'}
          </span>
          {type === 'futures' && (
            <span className="badge badge-warn" style={{ fontSize: 8 }}>{pos.leverage}x</span>
          )}
        </div>
        <PnlDisplay value={pnl} pct={pnlPct} size="sm" />
      </div>

      <div className="grid-4 gap-1.5 mb-1.5">
        <PriceBox label="Harga Masuk" value={`$${fmtPrice(pos.entry_price)}`} />
        <PriceBox label="Harga Saat Ini" value={`$${fmtPrice(pos.current_price || pos.entry_price)}`} highlight />
        <PriceBox label="Stop Loss" value={`$${fmtPrice(pos.sl_price)}`} danger />
        <PriceBox label="Take Profit" value={`$${fmtPrice(pos.tp_price)}`} bull />
      </div>

      {pos.trailing_stop_price && (
        <div className="flex items-center gap-1 mono" style={{ fontSize: 9, color: 'var(--warn)' }}>
          <AlertTriangle size={10} />
          Trailing Stop Aktif: ${fmtPrice(pos.trailing_stop_price)}
        </div>
      )}
    </div>
  )
}

function PriceBox({ label, value, highlight, danger, bull }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; bull?: boolean
}) {
  const color = highlight ? 'var(--accent)' : danger ? 'var(--bear)' : bull ? 'var(--bull)' : 'var(--text-primary)'
  return (
    <div style={{ background: 'var(--bg-deep)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bg-border)' }}>
      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 10, fontWeight: 700, color, marginTop: 1 }}>
        {value}
      </div>
    </div>
  )
}
