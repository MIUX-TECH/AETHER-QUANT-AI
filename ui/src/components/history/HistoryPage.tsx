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

  // Total BTC Vault profit converted from winning trades
  const btcVaultProfitUsdt = winningTrades.reduce((sum, t) => sum + (Number(t.realized_pnl || 0) * 0.7), 0)

  const symbols = ['ALL', ...Array.from(new Set(rawTrades.map(t => t.symbol).filter(Boolean)))]

  return (
    <div className="page pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={18} style={{ color: 'var(--accent)' }} /> Jurnal Riwayat Transaksi & Order
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Rekonsiliasi Eksekusi Binance Riil · Audit Fee & Slippage · Riwayat Konversi Profit BTC
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border">
            {(['1D', '7D', '30D', 'ALL'] as const).map(p => (
              <button
                key={p}
                className={`btn btn-xs ${period === p ? 'btn-lime' : 'btn-ghost'}`}
                style={{ padding: '2px 8px', fontSize: 9 }}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refreshHistory} disabled={loading} style={{ padding: '4px 10px' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
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
          sub={`Profit bersih setelah komisi`}
          bull={totalPnl > 0}
          danger={totalPnl < 0}
        />
        <div className="card p-3" style={{ borderLeft: '3px solid #00F0FF', background: 'linear-gradient(135deg, rgba(0,240,255,0.03), var(--bg-card))' }}>
          <div className="flex items-center justify-between" style={{ fontSize: 10, color: '#00F0FF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <span className="flex items-center gap-1"><Coins size={11} /> BTC VAULT PROFIT</span>
            <span style={{ fontSize: 8 }}>70% ALLOC</span>
          </div>
          <div className="mono font-bold" style={{ fontSize: 16, color: '#00F0FF', marginTop: 3 }}>
            ${btcVaultProfitUsdt.toFixed(2)} USDT
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Fee Total: ${totalFee.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Symbol Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-[200px]">
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>Filter Koin:</span>
          {symbols.map(s => (
            <button
              key={s}
              className={`btn btn-xs ${filterSymbol === s ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterSymbol(s)}
              style={{ padding: '2px 8px', fontSize: 9 }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Win / Loss Filters */}
        <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border">
          {[
            { id: 'ALL', label: 'Semua Status' },
            { id: 'WIN', label: 'Hanya Menang (Win)' },
            { id: 'LOSS', label: 'Hanya Kalah (Loss)' },
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-xs ${filterType === f.id ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterType(f.id)}
              style={{ padding: '2px 8px', fontSize: 9 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trades Table */}
      <div className="card p-3">
        <SectionHeader title={`Jurnal Order Transaksi (${filtered.length})`} subtitle="Catatan detail order beli, jual, TP1 partial, dan trailing stop" />

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Belum ada transaksi pada periode atau filter yang dipilih.
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px' }}>Waktu</th>
                  <th style={{ padding: '8px 6px' }}>Simbol</th>
                  <th style={{ padding: '8px 6px' }}>Tipe Order</th>
                  <th style={{ padding: '8px 6px' }}>Harga Masuk</th>
                  <th style={{ padding: '8px 6px' }}>Harga Keluar</th>
                  <th style={{ padding: '8px 6px' }}>Kuantitas</th>
                  <th style={{ padding: '8px 6px' }}>Nilai (USDT)</th>
                  <th style={{ padding: '8px 6px' }}>Fee</th>
                  <th style={{ padding: '8px 6px' }}>Net PnL</th>
                  <th style={{ padding: '8px 6px' }}>Alasan / Strategi</th>
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
                        height: 40,
                        background: isWin ? 'rgba(163,230,53,0.015)' : isLoss ? 'rgba(248,113,113,0.015)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>{timeStr}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 800 }}>
                        <span style={{ color: t.symbol?.includes('BTC') ? '#00F0FF' : 'var(--text-primary)' }}>
                          {t.symbol}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${t.side === 'BUY' || t.side === 'LONG' ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 9 }}>
                          {t.side || 'SPOT'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>${fmtPrice(t.entry_price)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>${fmtPrice(t.exit_price || t.price)}</td>
                      <td style={{ padding: '8px 6px' }}>{Number(t.qty || t.quantity || 0).toFixed(4)}</td>
                      <td style={{ padding: '8px 6px' }}>${Number(t.position_usdt || t.cummulative_quote || (t.qty * t.entry_price) || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>${Number(t.fee || 0).toFixed(4)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <PnlDisplay value={pnl} pct={pnlPct} size="sm" />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <div className="flex items-center gap-1.5">
                          {isTp1 ? (
                            <span className="badge badge-bull" style={{ fontSize: 8 }}>
                              <CheckCircle2 size={8} /> TP1 40%
                            </span>
                          ) : isTrail ? (
                            <span className="badge badge-warn" style={{ fontSize: 8 }}>
                              <Flame size={8} /> TRAILING RUNNER
                            </span>
                          ) : isSl ? (
                            <span className="badge badge-bear" style={{ fontSize: 8 }}>
                              <ShieldAlert size={8} /> STOP LOSS
                            </span>
                          ) : (
                            <span className="badge badge-muted" style={{ fontSize: 8 }}>
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
