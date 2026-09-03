// src/components/portfolio/PortfolioPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, SectionHeader, PnlDisplay, fmt, fmtPrice, fmtPct, TestnetWalletWidget } from '../shared'
import {
  Briefcase, RefreshCw, PieChart, Shield, TrendingUp,
  Layers, CheckCircle2, Wallet, ArrowUpRight, ArrowDownRight, DollarSign
} from 'lucide-react'
import { api } from '../../utils/api'
import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PortfolioPage() {
  const { portfolio, wallet, positions, risk, system, refresh, loading } = useStore()
  const [alloc, setAlloc] = useState<any>(null)
  const [activeWalletTab, setActiveWalletTab] = useState<'spot' | 'futures' | 'allocations'>('spot')

  useEffect(() => {
    refresh()
    api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    const interval = setInterval(() => {
      refresh()
      api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  const assets = wallet?.assets || []
  const totalEquityUSD = Number(wallet?.total_equity_usd || portfolio?.total_equity || 10000)
  const unrealized = Number(portfolio?.unrealized_pnl || 0)
  const realizedToday = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100
  const peakEquity = Number(portfolio?.peak_equity || totalEquityUSD)

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []

  // Deployed vs free cash
  const deployedSpot = allSpot.reduce((sum: number, p: any) => sum + Number(p.position_usdt || p.cost || 0), 0)
  const deployedFutures = allFutures.reduce((sum: number, p: any) => sum + Number(p.margin_used || p.margin || 0), 0)
  const totalDeployed = deployedSpot + deployedFutures

  const usdtAsset = assets.find(a => a.asset === 'USDT')
  const freeUSDT = usdtAsset ? usdtAsset.free : Math.max(0, totalEquityUSD - totalDeployed)

  // Pie chart breakdown across top assets
  const colors = ['#00ff9d', '#f59e0b', '#60a5fa', '#eab308', '#a855f7', '#ec4899', '#64748b']
  const pieData = assets.map((a, i) => ({
    name: a.asset,
    value: Number(a.usd_value || (a.total * a.price) || 0),
    color: colors[i % colors.length]
  })).filter(d => d.value > 1.0)

  return (
    <div className="page">
      {/* Real-time Binance Testnet Widget */}
      <TestnetWalletWidget />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={18} style={{ color: 'var(--accent)' }} /> Portofolio & Manajemen Multi-Aset
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Agregasi Saldo Dompet Riil · Valuasi Multi-Koin Real-Time · Alokasi Otomatis
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading} style={{ padding: '4px 10px' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Sinkron Saldo</span>
        </button>
      </div>

      {/* Hero Total Valuation Banner */}
      <div className="card card-lime p-3 mb-3" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Total Valuasi Portofolio (USD)
            </div>
            <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)', marginTop: 2 }}>
              ${totalEquityUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: unrealized >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                Belum Realisasi: {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: realizedToday >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                Hari Ini: {realizedToday >= 0 ? '+' : ''}{fmt(realizedToday)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '1px solid var(--bg-border)', paddingLeft: 12 }}>
            <div className="flex justify-between items-center" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kas USDT Bebas:</span>
              <span style={{ fontWeight: 700, color: 'var(--bull)' }}>${freeUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Modal Terpakai (Posisi):</span>
              <span style={{ fontWeight: 600 }}>{fmt(totalDeployed)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Mode Trading:</span>
              <span className="badge badge-lime" style={{ fontSize: 9 }}>{(system?.mode || 'TESTNET').toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid-4 gap-2 mb-3">
        <StatCard
          label="Kas USDT Siap Trade"
          value={`$${freeUSDT.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="Likuiditas eksekusi order"
          accent
        />
        <StatCard
          label="Aset Kripto Terdaftar"
          value={`${assets.length} Koin`}
          sub="BTC, ETH, BNB, SOL, dll"
        />
        <StatCard
          label="Posisi Terbuka"
          value={`${allSpot.length + allFutures.length}`}
          sub={`${allSpot.length} Spot · ${allFutures.length} Futures`}
        />
        <StatCard
          label="Penurunan (Drawdown)"
          value={`${drawdown.toFixed(2)}%`}
          sub={`Puncak: ${fmt(peakEquity)}`}
        />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
        <button
          className={`btn btn-sm ${activeWalletTab === 'spot' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveWalletTab('spot')}
          style={{ padding: '4px 12px', fontSize: 11 }}
        >
          <Wallet size={12} /> Saldo Dompet Spot ({assets.length})
        </button>
        <button
          className={`btn btn-sm ${activeWalletTab === 'allocations' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveWalletTab('allocations')}
          style={{ padding: '4px 12px', fontSize: 11 }}
        >
          <PieChart size={12} /> Rincian Alokasi & Target
        </button>
      </div>

      {/* Tab 1: Spot Wallet Asset Breakdown */}
      {activeWalletTab === 'spot' && (
        <div className="card p-3 mb-3">
          <SectionHeader
            title="Daftar Aset & Saldo Kepemilikan"
            subtitle="Nilai pasar dan kuantitas aset yang tersinkronisasi langsung dari akun Binance"
          />

          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Aset</th>
                  <th style={{ padding: '6px 4px' }}>Saldo Bebas</th>
                  <th style={{ padding: '6px 4px' }}>Dalam Order</th>
                  <th style={{ padding: '6px 4px' }}>Total Kuantitas</th>
                  <th style={{ padding: '6px 4px' }}>Harga Terkini</th>
                  <th style={{ padding: '6px 4px' }}>Nilai Estimasi (USD)</th>
                  <th style={{ padding: '6px 4px' }}>Porsi (%)</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a, i) => {
                  const weightPct = totalEquityUSD > 0 ? ((a.usd_value / totalEquityUSD) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 36 }}>
                      <td style={{ padding: '6px 4px', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{a.asset}</span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>{a.free >= 1 ? a.free.toLocaleString('en-US', { maximumFractionDigits: 4 }) : a.free.toFixed(6)}</td>
                      <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{a.locked > 0 ? a.locked.toFixed(4) : '0.00'}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 600 }}>{a.total >= 1 ? a.total.toLocaleString('en-US', { maximumFractionDigits: 4 }) : a.total.toFixed(6)}</td>
                      <td style={{ padding: '6px 4px' }}>${fmtPrice(a.price)}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>
                        ${a.usd_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="badge badge-muted" style={{ fontSize: 9 }}>{weightPct}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Allocations Breakdown */}
      {activeWalletTab === 'allocations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
          {/* Donut Chart */}
          <div className="card p-3">
            <SectionHeader title="Komposisi Aset Portofolio" subtitle="Distribusi bobot koin terhadap total modal" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ width: 120, height: 120, position: 'relative', margin: '0 auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      formatter={(v: any) => [`$${Number(v).toFixed(2)}`]}
                    />
                  </RPieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, minWidth: 140 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({((d.value / Math.max(totalEquityUSD, 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Target Rules */}
          <div className="card p-3">
            <SectionHeader title="Target Budget Alokasi" subtitle="Batas kapasitas pasar Spot & Futures" />
            <div className="flex flex-col gap-2.5 mt-2">
              <div>
                <div className="flex justify-between items-center mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pasar Spot (90% Maks)</span>
                  <span style={{ fontWeight: 600 }}>{fmt(totalEquityUSD * 0.9)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '90%', height: '100%', background: 'var(--bull)' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pasar Futures (10% Maks)</span>
                  <span style={{ fontWeight: 600 }}>{fmt(totalEquityUSD * 0.1)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: 'var(--warn)' }} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-deep)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--bg-border)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <CheckCircle2 size={12} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Rebalancing otomatis aktif pada deviasi &gt;5%.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Positions Table */}
      <div className="card p-3">
        <SectionHeader
          title={`Posisi Aktif (${allSpot.length + allFutures.length})`}
          subtitle="Monitoring real-time harga entry, target take profit, dan trailing stop"
        />

        {allSpot.length === 0 && allFutures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Belum ada posisi aktif. Bot memindai peluang setiap 60 detik.
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Aset</th>
                  <th style={{ padding: '6px 4px' }}>Tipe</th>
                  <th style={{ padding: '6px 4px' }}>Posisi (USDT)</th>
                  <th style={{ padding: '6px 4px' }}>Harga Masuk</th>
                  <th style={{ padding: '6px 4px' }}>Harga Saat Ini</th>
                  <th style={{ padding: '6px 4px' }}>Stop Loss / Trailing</th>
                  <th style={{ padding: '6px 4px' }}>Target TP</th>
                  <th style={{ padding: '6px 4px' }}>PnL</th>
                </tr>
              </thead>
              <tbody>
                {[...allSpot, ...allFutures].map((pos: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                    <td style={{ padding: '6px 4px', fontWeight: 700 }}>{pos.symbol}</td>
                    <td style={{ padding: '6px 4px' }}>
                      <span className={`badge ${pos.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 9 }}>
                        {pos.trade_type?.toUpperCase() || 'SPOT'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 4px' }}>{fmt(pos.position_usdt || pos.margin_used)}</td>
                    <td style={{ padding: '6px 4px' }}>${fmtPrice(pos.entry_price)}</td>
                    <td style={{ padding: '6px 4px', fontWeight: 600 }}>${fmtPrice(pos.current_price || pos.entry_price)}</td>
                    <td style={{ padding: '6px 4px', color: 'var(--bear)' }}>${fmtPrice(pos.trailing_stop_price || pos.sl_price)}</td>
                    <td style={{ padding: '6px 4px', color: 'var(--bull)' }}>${fmtPrice(pos.tp_price)}</td>
                    <td style={{ padding: '6px 4px' }}>
                      <PnlDisplay value={Number(pos.unrealized_pnl || 0)} pct={Number(pos.unrealized_pnl_pct || 0)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
