// src/components/history/HistoryPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, StatCard, PnlDisplay, fmt, fmtPrice, fmtPct, fmtTime } from '../shared'
import {
  History, RefreshCw, Filter, TrendingUp, TrendingDown,
  Brain, DollarSign, Coins, CheckCircle2, ShieldAlert,
  Flame, Crosshair, ArrowRight
} from 'lucide-react'

export default function HistoryPage() {
  const { history, refreshHistory, loading } = useStore()
  const [filterSymbol, setFilterSymbol] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [period, setPeriod] = useState<'1D' | '7D' | '30D' | 'ALL'>('ALL')

  useEffect(() => {
    refreshHistory()
  }, [])

  const rawTrades = history || []

  // Period filtering
  const now = Date.now()
  const periodFiltered = rawTrades.filter(t => {
    if (period === 'ALL') return true
    const tTime = t.exit_time || t.entry_time || t.timestamp || 0
    const ageMs = now - (typeof tTime === 'number' ? tTime : new Date(tTime).getTime())
    if (period === '1D') return ageMs <= 86400 * 1000
    if (period === '7D') return ageMs <= 7 * 86400 * 1000
    if (period === '30D') return ageMs <= 30 * 86400 * 1000
    return true
  })

  // Symbol & Type filtering
  const filtered = periodFiltered.filter(t => {
    if (filterSymbol !== 'ALL' && t.symbol !== filterSymbol) return false
    if (filterType !== 'ALL') {
      const isWin = (t.realized_pnl || t.pnl || 0) > 0
      if (filterType === 'WIN' && !isWin) return false
      if (filterType === 'LOSS' && isWin) return false
    }
    return true
  })

  // Stats calculation
  const totalTrades = periodFiltered.length
  const winningTrades = periodFiltered.filter(t => (t.realized_pnl || t.pnl || 0) > 0)
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0
  const totalPnl = periodFiltered.reduce((sum, t) => sum + Number(t.realized_pnl || t.pnl || 0), 0)
  const totalFee = periodFiltered.reduce((sum, t) => sum + Number(t.fee || 0), 0)
  const btcVaultProfitUsdt = winningTrades.reduce((sum, t) => sum + (Number(t.realized_pnl || 0) * 0.7), 0)

  const symbols = ['ALL', ...Array.from(new Set(rawTrades.map(t => t.symbol).filter(Boolean)))]

  return (
    <div className="flex flex-col gap-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={16} style={{ color: 'var(--accent)' }} /> Jurnal Riwayat Transaksi & Order
          </h2>
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Rekonsiliasi Eksekusi Binance Riil · Audit Fee & Slippage · Pelacak Konversi Profit BTC
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border">
            {(['1D', '7D', '30D', 'ALL'] as const).map(p => (
              <button
                key={p}
                className={`btn btn-xs ${period === p ? 'btn-lime' : 'btn-ghost'}`}
                style={{ padding: '2px 7px', fontSize: 9 }}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={refreshHistory} disabled={loading} style={{ padding: '3px 7px' }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          label="Total Transaksi"
          value={`${totalTrades}`}
          sub={`${winningTrades.length} Win · ${totalTrades - winningTrades.length} Loss`}
        />
        <StatCard
          label="Tingkat Kemenangan"
          value={`${winRate.toFixed(1)}%`}
          sub="Rasio Win-Rate periode ini"
          accent={winRate >= 50}
        />
        <StatCard
          label="Total Realisasi PnL"
          value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`}
          sub="Profit bersih setelah fee"
          bull={totalPnl > 0}
          danger={totalPnl < 0}
        />
        <div className="card p-3" style={{ borderLeft: '3px solid #00F0FF', background: 'linear-gradient(135deg, rgba(0,240,255,0.04), var(--bg-card))' }}>
          <div className="flex items-center justify-between" style={{ fontSize: 9.5, color: '#00F0FF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <span className="flex items-center gap-1"><Coins size={11} /> BTC VAULT PROFIT</span>
            <span style={{ fontSize: 7.5 }}>70% ALLOC</span>
          </div>
          <div className="mono font-bold" style={{ fontSize: 16, color: '#00F0FF', marginTop: 2 }}>
            ${btcVaultProfitUsdt.toFixed(2)} USDT
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Total Fee: ${totalFee.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-2.5 flex items-center justify-between gap-2 flex-wrap">
        {/* Symbol Filters */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-[180px]">
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginRight: 3 }}>Koin:</span>
          {symbols.map(s => (
            <button
              key={s}
              className={`btn btn-xs ${filterSymbol === s ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterSymbol(s)}
              style={{ padding: '2px 7px', fontSize: 9 }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Win / Loss Filters */}
        <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border">
          {[
            { id: 'ALL', label: 'Semua Status' },
            { id: 'WIN', label: 'Hanya Win' },
            { id: 'LOSS', label: 'Hanya Loss' },
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-xs ${filterType === f.id ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterType(f.id)}
              style={{ padding: '2px 7px', fontSize: 9 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trades Table */}
      <div className="card p-3">
        <SectionHeader title={`Jurnal Order Transaksi (${filtered.length})`} subtitle="Detail order beli, jual, TP1 40% partial, dan runner trailing stop" />

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
            Belum ada transaksi pada periode atau filter yang dipilih.
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu</th>
                  <th style={{ padding: '6px 4px' }}>Simbol</th>
                  <th style={{ padding: '6px 4px' }}>Tipe</th>
                  <th style={{ padding: '6px 4px' }}>Entry</th>
                  <th style={{ padding: '6px 4px' }}>Exit</th>
                  <th style={{ padding: '6px 4px' }}>Qty</th>
                  <th style={{ padding: '6px 4px' }}>Nilai (USDT)</th>
                  <th style={{ padding: '6px 4px' }}>Fee</th>
                  <th style={{ padding: '6px 4px' }}>Net PnL</th>
                  <th style={{ padding: '6px 4px' }}>Alasan / Strategi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const pnl = Number(t.realized_pnl || t.pnl || 0)
                  const pnlPct = Number(t.pnl_pct || t.realized_pnl_pct || 0)
                  const isWin = pnl > 0
                  const isLoss = pnl < 0
                  const timeStr = t.exit_time || t.entry_time || t.timestamp
                    ? new Date(t.exit_time || t.entry_time || t.timestamp).toLocaleString()
                    : '—'

                  const exitReason = t.exit_reason || t.reason || 'Normal Exit'
                  const isTp1 = exitReason.includes('tp1') || exitReason.includes('partial')
                  const isTrail = exitReason.includes('trailing') || exitReason.includes('runner')
                  const isSl = exitReason.includes('sl') || exitReason.includes('stop')

                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--bg-border)',
                        height: 38,
                        background: isWin ? 'rgba(74,222,128,0.015)' : isLoss ? 'rgba(248,113,113,0.015)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 800 }}>
                        <span style={{ color: t.symbol?.includes('BTC') ? '#00F0FF' : 'var(--text-primary)' }}>
                          {t.symbol}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <span className={`badge ${t.side === 'BUY' || t.side === 'LONG' ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 8 }}>
                          {t.side || 'SPOT'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>${fmtPrice(t.entry_price)}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 600 }}>${fmtPrice(t.exit_price || t.price)}</td>
                      <td style={{ padding: '6px 4px' }}>{Number(t.qty || t.quantity || 0).toFixed(4)}</td>
                      <td style={{ padding: '6px 4px' }}>${Number(t.position_usdt || t.cummulative_quote || (t.qty * t.entry_price) || 0).toFixed(2)}</td>
                      <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>${Number(t.fee || 0).toFixed(4)}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <PnlDisplay value={pnl} pct={pnlPct} size="sm" />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <div className="flex items-center gap-1">
                          {isTp1 ? (
                            <span className="badge badge-bull" style={{ fontSize: 7.5 }}>
                              <CheckCircle2 size={7} /> TP1 40%
                            </span>
                          ) : isTrail ? (
                            <span className="badge badge-warn" style={{ fontSize: 7.5 }}>
                              <Flame size={7} /> TRAIL RUNNER
                            </span>
                          ) : isSl ? (
                            <span className="badge badge-bear" style={{ fontSize: 7.5 }}>
                              <ShieldAlert size={7} /> STOP LOSS
                            </span>
                          ) : (
                            <span className="badge badge-muted" style={{ fontSize: 7.5 }}>
                              {exitReason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
