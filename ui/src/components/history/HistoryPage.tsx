// src/components/history/HistoryPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, StatCard, PnlDisplay, fmt, fmtPrice, fmtPct, fmtTime } from '../shared'
import { History, RefreshCw, Filter, TrendingUp, TrendingDown, Brain, DollarSign } from 'lucide-react'

export default function HistoryPage() {
  const { history, refreshHistory, loading } = useStore()
  const [filterSymbol, setFilterSymbol] = useState('ALL')

  useEffect(() => {
    refreshHistory()
  }, [])

  const trades = history || []
  const filtered = filterSymbol === 'ALL' ? trades : trades.filter(t => t.symbol === filterSymbol)

  // Stats calculation
  const totalTrades = trades.length
  const winningTrades = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0)
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.realized_pnl || t.pnl || 0), 0)

  const symbols = ['ALL', ...Array.from(new Set(trades.map(t => t.symbol).filter(Boolean)))]

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={18} style={{ color: 'var(--accent)' }} /> Jurnal Riwayat Transaksi & Order
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Catatan Eksekusi Binance Riil · Audit Maker/Taker Fee & Slippage · Evaluasi AI
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refreshHistory} disabled={loading} style={{ padding: '4px 10px' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 gap-2 mb-3">
        <StatCard
          label="Total Transaksi"
          value={`${totalTrades}`}
          sub={`${winningTrades.length} Menang · ${totalTrades - winningTrades.length} Kalah`}
        />
        <StatCard
          label="Tingkat Kemenangan"
          value={`${winRate.toFixed(1)}%`}
          sub="Rasio win-rate keseluruhan"
          accent={winRate >= 50}
        />
        <StatCard
          label="Total Realisasi PnL"
          value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`}
          sub="Akumulasi laba/rugi bersih"
          warn={totalPnl < 0}
        />
        <StatCard
          label="Komisi / Fee"
          value={fmt(trades.reduce((sum, t) => sum + Number(t.fee || 0), 0))}
          sub="Maker & Taker fee terbayar"
        />
      </div>

      {/* Filter by symbol */}
      {symbols.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>Filter Koin:</span>
          {symbols.map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filterSymbol === s ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterSymbol(s)}
              style={{ padding: '2px 8px', fontSize: 10 }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Trades Table */}
      <div className="card p-3">
        <SectionHeader title={`Riwayat Order (${filtered.length})`} subtitle="Log eksekusi order limit & market" />

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Belum ada catatan transaksi. Bot akan mencatat setiap eksekusi order secara otomatis.
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu</th>
                  <th style={{ padding: '6px 4px' }}>Simbol</th>
                  <th style={{ padding: '6px 4px' }}>Tipe</th>
                  <th style={{ padding: '6px 4px' }}>Arah</th>
                  <th style={{ padding: '6px 4px' }}>Harga Masuk</th>
                  <th style={{ padding: '6px 4px' }}>Harga Keluar</th>
                  <th style={{ padding: '6px 4px' }}>Ukuran</th>
                  <th style={{ padding: '6px 4px' }}>PnL</th>
                  <th style={{ padding: '6px 4px' }}>Catatan AI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const pnl = Number(t.realized_pnl || t.pnl || 0)
                  const pnlPct = Number(t.pnl_pct || 0)
                  const isBuy = t.side === 'BUY'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                      <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{fmtTime(t.closed_at || t.timestamp)}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 700 }}>{t.symbol}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="badge badge-muted" style={{ fontSize: 9 }}>{t.strategy?.toUpperCase() || 'SPOT'}</span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <span className={`badge ${isBuy ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 9 }}>
                          {t.side || 'BUY'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>${fmtPrice(t.entry_price)}</td>
                      <td style={{ padding: '6px 4px' }}>${fmtPrice(t.exit_price || t.current_price)}</td>
                      <td style={{ padding: '6px 4px' }}>{fmt(t.position_usdt || t.margin_used || 0)}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <PnlDisplay value={pnl} pct={pnlPct} size="sm" />
                      </td>
                      <td style={{ padding: '6px 4px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t.lesson || t.reason || '—'}</span>
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
