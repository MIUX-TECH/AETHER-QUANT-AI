// src/components/positions/PositionsPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, PnlDisplay, fmtPrice, fmt, EmptyState, TestnetWalletWidget } from '../shared'
import {
  Activity, TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  Layers, Wallet, ArrowUpRight, XCircle, CheckCircle2, ShieldAlert,
  Flame, Zap, Crosshair
} from 'lucide-react'
import { api } from '../../utils/api'

export default function PositionsPage() {
  const { positions, wallet, refresh, loading, setActiveTab } = useStore()
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null)
  const [closingAll, setClosingAll] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const spot = positions?.spot || []
  const futures = positions?.futures || []
  const total = spot.length + futures.length
  const holdings = wallet?.assets?.filter(a => !['USDT', 'USD', 'USDC'].includes(a.asset) && a.total > 0) || []

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleClosePosition = async (symbol: string, tradeType: string) => {
    if (!confirm(`Tutup posisi ${tradeType.toUpperCase()} pada ${symbol} sekarang di harga market?`)) {
      return
    }
    setClosingSymbol(symbol)
    try {
      const res = await api.closePosition(symbol, tradeType)
      setActionMessage(`✅ Posisi ${symbol} berhasil ditutup`)
      setTimeout(() => setActionMessage(null), 4000)
      refresh()
    } catch (e: any) {
      alert(`Gagal menutup posisi: ${e.message}`)
    } finally {
      setClosingSymbol(null)
    }
  }

  const handleCloseAll = async () => {
    if (!confirm('PERINGATAN: Anda yakin ingin menutup SELURUH posisi terbuka (Spot & Futures) sekarang?')) {
      return
    }
    setClosingAll(true)
    try {
      const res = await api.closeAllPositions()
      setActionMessage(`🚨 Berhasil menutup ${res.closed_count || total} posisi terbuka`)
      setTimeout(() => setActionMessage(null), 5000)
      refresh()
    } catch (e: any) {
      alert(`Gagal menutup seluruh posisi: ${e.message}`)
    } finally {
      setClosingAll(false)
    }
  }

  return (
    <div className="page pb-12">
      {/* Testnet / Mainnet Widget */}
      <TestnetWalletWidget />

      {/* Action Notification */}
      {actionMessage && (
        <div className="mb-3 p-2.5 rounded border border-bull bg-deep flex items-center gap-2" style={{ borderColor: 'var(--bull)' }}>
          <CheckCircle2 size={14} style={{ color: 'var(--bull)' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--bull)' }}>{actionMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} /> Posisi Aktif & Manajemen Order
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            {total} Posisi Bot Berjalan · TP1 (40% BE+Fee) · 60% Runner Adaptive Trailing Stop
          </p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              className="btn btn-sm btn-bear"
              onClick={handleCloseAll}
              disabled={closingAll || loading}
              style={{ padding: '4px 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ShieldAlert size={12} />
              <span>{closingAll ? 'Menutup Semua...' : 'Tutup Semua Posisi'}</span>
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading} style={{ padding: '4px 10px' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Active Spot Positions */}
      {spot.length > 0 && (
        <div className="mb-4">
          <SectionHeader title="Posisi Bot Spot" subtitle={`${spot.length} posisi dengan proteksi TP1 dan trailing stop`} />
          <div className="flex flex-col gap-2.5 mt-2">
            {spot.map((pos: any, i: number) => (
              <PositionDetailCard
                key={i}
                position={pos}
                type="spot"
                onClose={() => handleClosePosition(pos.symbol, 'spot')}
                isClosing={closingSymbol === pos.symbol}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Futures Positions */}
      {futures.length > 0 && (
        <div className="mb-4">
          <SectionHeader title="Posisi Bot Futures" subtitle={`${futures.length} kontrak margin leverage aktif`} />
          <div className="flex flex-col gap-2.5 mt-2">
            {futures.map((pos: any, i: number) => (
              <PositionDetailCard
                key={i}
                position={pos}
                type="futures"
                onClose={() => handleClosePosition(pos.symbol, 'futures')}
                isClosing={closingSymbol === pos.symbol}
              />
            ))}
          </div>
        </div>
      )}

      {/* Spot Wallet Asset Holdings */}
      {holdings.length > 0 && (
        <div className="card p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <SectionHeader
              title={`Saldo Koin Spot Binance (${holdings.length})`}
              subtitle="Koin fisik yang tersimpan di dompet Spot Binance"
            />
            <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('portfolio')} style={{ fontSize: 10 }}>
              Lihat Portofolio <ArrowUpRight size={10} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {holdings.map((h: any, i: number) => (
              <div key={i} className="p-2.5" style={{ background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
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
                  <span>Qty: {Number(h.total || 0).toFixed(4)} {h.asset}</span>
                  <span>@${Number(h.price || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && holdings.length === 0 && (
        <EmptyState
          icon={<Activity size={32} />}
          message="Tidak ada posisi terbuka saat ini. Bot sedang memindai peluang di 11 koin watchlist setiap 60 detik."
        />
      )}
    </div>
  )
}

function PositionDetailCard({
  position: pos,
  type,
  onClose,
  isClosing
}: {
  position: any
  type: string
  onClose: () => void
  isClosing: boolean
}) {
  const isBull = pos.side === 'BUY' || pos.side === 'LONG'
  const pnl = pos.unrealized_pnl || 0
  const pnlPct = pos.unrealized_pnl_pct || 0
  const isTp1Taken = Boolean(pos.partial_tp_taken)
  const isRunnerActive = Boolean(pos.runner_active || pos.trailing_stop_price)
  const currentPrice = Number(pos.current_price || pos.entry_price || 0)
  const entryPrice = Number(pos.entry_price || 0)

  // Calculate distance to TP / SL / Trailing in %
  const slPrice = Number(pos.sl_price || 0)
  const tpPrice = Number(pos.tp_price || 0)
  const trailPrice = Number(pos.trailing_stop_price || 0)

  return (
    <div
      className="card p-3"
      style={{
        borderLeft: `4px solid ${isBull ? 'var(--bull)' : 'var(--bear)'}`,
        background: isBull ? 'linear-gradient(135deg, rgba(163,230,53,0.02), var(--bg-card))' : 'linear-gradient(135deg, rgba(248,113,113,0.02), var(--bg-card))'
      }}
    >
      {/* Top Bar: Symbol, Badges, PnL & Emergency Close */}
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          {isBull
            ? <TrendingUp size={14} style={{ color: 'var(--bull)' }} />
            : <TrendingDown size={14} style={{ color: 'var(--bear)' }} />
          }
          <span className="mono" style={{ fontSize: 14, fontWeight: 800 }}>
            {pos.symbol}
          </span>
          <span className={`badge ${isBull ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 9 }}>
            {isBull ? 'LONG / SPOT BUY' : 'SHORT FUTURES'}
          </span>
          {type === 'futures' && (
            <span className="badge badge-warn" style={{ fontSize: 9 }}>{pos.leverage || 3}x LEV</span>
          )}
          {pos.regime && (
            <span className="badge badge-muted" style={{ fontSize: 8 }}>
              {pos.regime.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <PnlDisplay value={pnl} pct={pnlPct} size="md" />
          <button
            className="btn btn-xs btn-bear"
            onClick={onClose}
            disabled={isClosing}
            style={{ padding: '3px 8px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <XCircle size={11} />
            <span>{isClosing ? 'Menutup...' : 'Tutup Market'}</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <PriceBox label="Harga Masuk (Entry)" value={`$${fmtPrice(entryPrice)}`} />
        <PriceBox label="Harga Pasar (Mark)" value={`$${fmtPrice(currentPrice)}`} highlight />
        <PriceBox
          label={isTp1Taken ? "Stop Loss (BEP Aktif)" : "Stop Loss (ATR 2%)"}
          value={`$${fmtPrice(slPrice)}`}
          danger={!isTp1Taken}
          bull={isTp1Taken}
        />
        <PriceBox label="Target TP Penuh" value={`$${fmtPrice(tpPrice)}`} bull />
      </div>

      {/* Position Detail Summary Bar */}
      <div className="p-2 rounded bg-deep border border-border flex justify-between items-center flex-wrap gap-2" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <span style={{ color: 'var(--text-muted)' }}>
            Kuantitas: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Number(pos.qty || 0).toFixed(4)}</span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Nilai Notional: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>${Number(pos.position_usdt || pos.current_value || 0).toFixed(2)} USDT</span>
          </span>
        </div>

        {/* Strategy Execution Status Indicators */}
        <div className="flex items-center gap-2">
          <span
            className={`badge ${isTp1Taken ? 'badge-bull' : 'badge-muted'}`}
            style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            {isTp1Taken ? <CheckCircle2 size={9} /> : <Crosshair size={9} />}
            TP1 (40% BE+Fee): {isTp1Taken ? 'SUDAH DIAMBIL' : 'PENDING'}
          </span>

          {trailPrice > 0 && (
            <span
              className="badge badge-warn"
              style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <Flame size={9} />
              60% RUNNER TRAILING: ${fmtPrice(trailPrice)} ({pos.trailing_stop_pct ? (pos.trailing_stop_pct * 100).toFixed(1) : '2.5'}%)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PriceBox({
  label,
  value,
  highlight,
  danger,
  bull
}: {
  label: string
  value: string
  highlight?: boolean
  danger?: boolean
  bull?: boolean
}) {
  const color = highlight ? 'var(--accent)' : danger ? 'var(--bear)' : bull ? 'var(--bull)' : 'var(--text-primary)'
  return (
    <div style={{ background: 'var(--bg-deep)', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--bg-border)' }}>
      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color, marginTop: 1 }}>
        {value}
      </div>
    </div>
  )
}
