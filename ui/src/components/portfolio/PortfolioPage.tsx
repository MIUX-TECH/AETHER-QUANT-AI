// src/components/portfolio/PortfolioPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, SectionHeader, PnlDisplay, fmt, fmtPrice, fmtPct } from '../shared'
import { Briefcase, RefreshCw, PieChart, Shield, TrendingUp, Layers, CheckCircle2 } from 'lucide-react'
import { api } from '../../utils/api'
import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PortfolioPage() {
  const { portfolio, positions, risk, system, refresh, loading } = useStore()
  const [alloc, setAlloc] = useState<any>(null)

  useEffect(() => {
    refresh()
    api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    const interval = setInterval(() => {
      refresh()
      api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  const equity = Number(portfolio?.total_equity || 1000)
  const unrealized = Number(portfolio?.unrealized_pnl || 0)
  const realizedToday = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100
  const peakEquity = Number(portfolio?.peak_equity || equity)

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []

  // Calculate actual deployed capital from open positions
  const deployedSpot = allSpot.reduce((sum: number, p: any) => sum + Number(p.position_usdt || p.cost || 0), 0)
  const deployedFutures = allFutures.reduce((sum: number, p: any) => sum + Number(p.margin_used || p.margin || 0), 0)
  const totalDeployed = deployedSpot + deployedFutures

  // Free and reserved cash
  const cashReserve = Number(alloc?.cash_reserve || equity * 0.05)
  const freeCash = Math.max(0, equity - totalDeployed)
  const unreservedCash = Math.max(0, freeCash - cashReserve)

  // Budget allocations
  const spotBudget = Number(alloc?.spot_budget || equity * 0.9)
  const futuresBudget = Number(alloc?.futures_budget || equity * 0.1)
  const btcBudget = Number(alloc?.btc_budget || spotBudget * 0.7)
  const altBudget = Number(alloc?.altcoin_budget || spotBudget * 0.3)

  // Pie chart data (100% accurate, strictly non-negative)
  const pieData = [
    { name: 'Modal Spot Aktif', value: deployedSpot, color: '#00f0ff' },
    { name: 'Modal Futures Aktif', value: deployedFutures, color: '#ffb700' },
    { name: 'Kas Bebas Siap Trade', value: unreservedCash, color: '#00ff9d' },
    { name: 'Cadangan Kas Wajib (5%)', value: cashReserve, color: '#64748b' },
  ].filter(d => d.value > 0.01)

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={20} style={{ color: 'var(--accent)' }} /> Portofolio & Manajemen Modal
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Alokasi Otomatis · Rule: 90% Spot (70% BTC, 30% Alt) · 10% Futures · 5% Cash Reserve
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Sinkron</span>
        </button>
      </div>

      {/* Hero Equity Banner */}
      <div className="card card-lime p-5 mb-4" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Total Nilai Ekuitas (USDT)
            </div>
            <div style={{ fontSize: 34, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--accent)' }}>
              {fmt(equity)}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: unrealized >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                Belum Direalisasi: {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: realizedToday >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                Realisasi Hari Ini: {realizedToday >= 0 ? '+' : ''}{fmt(realizedToday)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '1px solid var(--bg-border)', paddingLeft: 16 }}>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Puncak Saldo:</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(peakEquity)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Penurunan (Drawdown):</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: drawdown > 5 ? 'var(--bear)' : 'var(--bull)' }}>
                {drawdown.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Status Mode Risiko:</span>
              <span className="badge badge-lime" style={{ fontSize: 10 }}>{(portfolio as any)?.mode?.toUpperCase() || (system?.mode || 'NORMAL').toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid-4 gap-3 mb-4">
        <StatCard
          label="Modal Terpakai"
          value={fmt(totalDeployed)}
          sub={`${((totalDeployed / Math.max(equity, 1)) * 100).toFixed(1)}% posisi aktif`}
          accent={totalDeployed > 0}
        />
        <StatCard
          label="Kas Bebas Tersedia"
          value={fmt(freeCash)}
          sub={`${((freeCash / Math.max(equity, 1)) * 100).toFixed(1)}% likuiditas`}
        />
        <StatCard
          label="Cadangan Kas (5%)"
          value={fmt(cashReserve)}
          sub="Buffer batas proteksi"
        />
        <StatCard
          label="Posisi Aktif"
          value={`${allSpot.length + allFutures.length}`}
          sub={`${allSpot.length} Spot · ${allFutures.length} Futures`}
        />
      </div>

      {/* Two Column Section: Donut Breakdown + Target Allocations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Left: Donut Chart */}
        <div className="card p-4">
          <SectionHeader title="Rincian Komposisi Modal" subtitle="Distribusi riil aset & kas saat ini" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ width: 140, height: 140, position: 'relative', margin: '0 auto' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`]}
                  />
                </RPieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              {pieData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(d.value)}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 6 }}>
                      {((d.value / Math.max(equity, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Target Budget Rules & Usage */}
        <div className="card p-4">
          <SectionHeader title="Kapasitas Anggaran & Aturan Alokasi" subtitle="Batas maksimum per kelas aset" />
          <div className="flex flex-col gap-3 mt-3">
            {/* Spot Progress */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Anggaran Pasar Spot (90% Maks = {fmt(spotBudget)})
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {fmt(deployedSpot)} / {fmt(spotBudget)}
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (deployedSpot / Math.max(spotBudget, 1)) * 100)}%`,
                    height: '100%',
                    background: 'var(--bull)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-1" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>BTC Target: {fmt(btcBudget)} (70%)</span>
                <span>Altcoins Target: {fmt(altBudget)} (30%)</span>
              </div>
            </div>

            {/* Futures Progress */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Anggaran Pasar Futures (10% Maks = {fmt(futuresBudget)})
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {fmt(deployedFutures)} / {fmt(futuresBudget)}
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (deployedFutures / Math.max(futuresBudget, 1)) * 100)}%`,
                    height: '100%',
                    background: 'var(--warn)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-1" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>Leverage: Isolated</span>
                <span>Maks Posisi: 2 Posisi</span>
              </div>
            </div>

            {/* Rebalancing & Compounding rule badge */}
            <div style={{ background: 'var(--bg-deep)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bg-border)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Drift Rebalancing aktif pada deviasi &gt;5%. Auto-Compounding aktif pada profit +10%.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions Table with Trailing Stop Markers */}
      <div className="card p-4">
        <SectionHeader
          title={`Posisi Aktif (${allSpot.length + allFutures.length})`}
          subtitle="Monitoring real-time harga entry, target take profit, dan trailing stop"
        />

        {allSpot.length === 0 && allFutures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Belum ada posisi aktif. Bot akan membuka posisi otomatis saat sinyal kuantitatif terkonfirmasi.
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px' }}>Aset</th>
                  <th style={{ padding: '8px 6px' }}>Tipe</th>
                  <th style={{ padding: '8px 6px' }}>Posisi (USDT)</th>
                  <th style={{ padding: '8px 6px' }}>Harga Masuk</th>
                  <th style={{ padding: '8px 6px' }}>Harga Saat Ini</th>
                  <th style={{ padding: '8px 6px' }}>Stop Loss / Trailing</th>
                  <th style={{ padding: '8px 6px' }}>Target TP</th>
                  <th style={{ padding: '8px 6px' }}>PnL</th>
                </tr>
              </thead>
              <tbody>
                {[...allSpot, ...allFutures].map((pos: any, i: number) => {
                  const isBuy = pos.side === 'BUY'
                  const pnl = Number(pos.unrealized_pnl || 0)
                  const pnlPct = Number(pos.unrealized_pnl_pct || 0)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 42 }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{pos.symbol}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${pos.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 9 }}>
                          {pos.trade_type?.toUpperCase() || 'SPOT'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>{fmt(pos.position_usdt || pos.margin_used)}</td>
                      <td style={{ padding: '8px 6px' }}>${fmtPrice(pos.entry_price)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>${fmtPrice(pos.current_price || pos.entry_price)}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--bear)' }}>
                        ${fmtPrice(pos.trailing_stop_price || pos.sl_price)}
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--bull)' }}>
                        ${fmtPrice(pos.tp_price)}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <PnlDisplay value={pnl} pct={pnlPct} size="sm" />
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
