// src/components/portfolio/PortfolioPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, SectionHeader, ProgressRing, PnlDisplay, fmt, fmtPct, ConfidenceBar } from '../shared'
import { Briefcase, RefreshCw, PieChart } from 'lucide-react'
import { api } from '../../utils/api'
import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PortfolioPage() {
  const { portfolio, positions, risk, refresh } = useStore()
  const [alloc, setAlloc] = useState<any>(null)

  useEffect(() => {
    refresh()
    api.getPortfolio().then(r => setAlloc(r?.allocations))
    const interval = setInterval(refresh, 20000)
    return () => clearInterval(interval)
  }, [])

  const equity = portfolio?.total_equity || 0
  const spot = portfolio?.spot_equity || 0
  const futures = portfolio?.futures_equity || 0
  const cash = equity - spot - futures
  const unrealized = portfolio?.unrealized_pnl || 0
  const drawdown = (portfolio?.drawdown_pct || 0) * 100
  const exposure = (risk?.total_exposure_pct || 0) * 100

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []

  const pieData = [
    { name: 'Spot', value: spot, color: 'var(--bull)' },
    { name: 'Futures', value: futures, color: 'var(--warn)' },
    { name: 'Kas', value: Math.max(cash, 0), color: 'var(--text-muted)' },
  ].filter(d => d.value > 0)

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Portofolio</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Alokasi terkelola · {allSpot.length + allFutures.length} posisi aktif
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh}><RefreshCw size={12} /></button>
      </div>

      {/* Total equity hero */}
      <div className="card card-lime p-5 mb-4" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Total Modal
        </div>
        <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--accent-lime)' }}>
          {fmt(equity)}
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: unrealized >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
            Belum Direalisasi: {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: drawdown > 5 ? 'var(--bear)' : 'var(--text-muted)' }}>
            Penurunan: {drawdown.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 gap-3 mb-4">
        <StatCard label="Spot" value={fmt(spot)} sub={`${((spot / Math.max(equity, 1)) * 100).toFixed(1)}% dari portofolio`} />
        <StatCard label="Futures" value={fmt(futures)} sub={`${((futures / Math.max(equity, 1)) * 100).toFixed(1)}% dari portofolio`} />
        <StatCard label="Cadangan Kas" value={fmt(Math.max(cash, 0))} sub="Modal tersedia" />
        <StatCard label="Terpakai" value={`${exposure.toFixed(1)}%`} sub="Total eksposur" warn={exposure > 70} danger={exposure > 85} />
      </div>

      {/* Pie chart */}
      {equity > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Rincian Alokasi" />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <ResponsiveContainer width={160} height={160}>
              <RPieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" stroke="none">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`]}
                />
              </RPieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(d.value)}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {((d.value / Math.max(equity, 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Target allocations */}
      {alloc && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Alokasi Target" subtitle="Sesuai config + penyesuaian risiko" />
          <div className="flex flex-col gap-2">
            {[
              { label: 'Anggaran BTC', val: alloc.btc_budget },
              { label: 'Anggaran Altcoin', val: alloc.altcoin_budget },
              { label: 'Anggaran Futures', val: alloc.futures_budget },
              { label: 'Cadangan Kas', val: alloc.cash_reserve },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(item.val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open positions summary */}
      {(allSpot.length > 0 || allFutures.length > 0) && (
        <div className="card p-4">
          <SectionHeader title="Eksposur Posisi Terbuka" />
          <div className="flex flex-col gap-2">
            {[...allSpot, ...allFutures].map((pos: any, i: number) => {
              const pnlPct = pos.unrealized_pnl_pct || 0
              return (
                <div key={i} className="flex items-center gap-3 p-2" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pos.side === 'BUY' ? 'var(--bull)' : 'var(--bear)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, flex: 1 }}>
                    {pos.symbol?.replace('USDT', '')}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {fmt(pos.position_usdt)}
                  </span>
                  <PnlDisplay value={pos.unrealized_pnl || 0} pct={pnlPct} size="sm" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
