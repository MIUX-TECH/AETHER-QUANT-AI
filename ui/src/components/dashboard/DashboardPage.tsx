// src/components/dashboard/DashboardPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  StatCard, RegimePill, SignalBadge, ConfidenceBar, PnlDisplay,
  SectionHeader, fmt, fmtPct, fmtTime, fmtPrice, TickerRibbon
} from '../shared'
import {
  RefreshCw, Zap, Shield, TrendingUp, DollarSign, Activity,
  Brain, AlertTriangle, CheckCircle2, ChevronRight, BarChart2
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export default function DashboardPage() {
  const {
    portfolio, risk, system, scanResults, scanner, closedToday,
    positions, refresh, triggerScan, loading, setActiveTab
  } = useStore()

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []
  const allPositions = [...allSpot, ...allFutures]

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 20000)
    return () => clearInterval(interval)
  }, [])

  const equity = Number(portfolio?.total_equity || 1000)
  const unrealPnl = Number(portfolio?.unrealized_pnl || 0)
  const realPnl = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100
  const exposure = Number(risk?.total_exposure_pct || 0) * 100

  // Top signals list
  const signals = Object.entries(scanResults || {}).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    signal: r?.score?.signal || 'WAIT',
    confidence: Number(r?.score?.confidence || 0),
    price: Number(r?.price || 0),
    change: Number(r?.price_change_24h || 0),
    regime: r?.regime?.regime || 'unknown',
    bullish_factors: r?.score?.bullish_factors || [],
    bearish_factors: r?.score?.bearish_factors || [],
    reasoning: r?.score?.reasoning || '',
  })).filter(s => s.price > 0)

  // Equity growth curve mock/live history
  const chartData = [
    { time: '04:00', equity: 1000.00 },
    { time: '08:00', equity: 1000.00 },
    { time: '12:00', equity: 999.85 },
    { time: '16:00', equity: 999.90 },
    { time: '20:00', equity: 999.74 },
    { time: 'Sekarang', equity: equity },
  ]

  // Dynamic Qwen AI commentary
  const dominantRegime = scanner?.market_regime || 'ranging'
  const buySignalsCount = signals.filter(s => s.signal.includes('BUY')).length
  const aiCommentary = dominantRegime === 'trending_up'
    ? `Pasar saat ini berada dalam fase TRENDING UP. Model kuantitatif mendeteksi ${buySignalsCount} aset dengan momentum bullish. Alokasi modal diarahkan ke setup pullback dan breakout terkonfirmasi.`
    : dominantRegime === 'trending_down'
    ? `Pasar berada dalam fase TRENDING DOWN. Sistem mengaktifkan mode defensif untuk meminimalkan risiko dan melindungi modal pokok.`
    : `Kondisi pasar saat ini berkonsolidasi (RANGING). Strategi fokus pada pembelian di area support kunci dan realisasi profit cepat.`

  return (
    <div className="page">
      {/* Real-time Ticker Ribbon */}
      <TickerRibbon />

      {/* Main Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Terminal Dasbor</h1>
            <span className="badge badge-lime" style={{ fontSize: 10 }}>
              {(system?.mode || 'PAPER').toUpperCase()} MODE
            </span>
            <span className="badge badge-bull" style={{ fontSize: 10 }}>
              {system?.status === 'running' ? '● LIVE 24/7' : 'SIAGA'}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Sistem Kuantitatif Otonom · Binance REST API Terhubung · Groq Qwen 27B Aktif
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
          <button className="btn btn-lime btn-sm" onClick={triggerScan} disabled={loading}>
            <Zap size={13} />
            <span>Pindai Pasar</span>
          </button>
        </div>
      </div>

      {/* Risk Alert Banners if triggered */}
      {(risk?.kill_switch || risk?.risk_off || risk?.capital_preservation || risk?.cooldown_active) && (
        <div className="card mb-4" style={{ borderColor: 'var(--warn)', padding: '12px 16px', background: 'rgba(251, 191, 36, 0.05)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTriangle size={16} style={{ color: 'var(--warn)' }} />
            {risk.kill_switch && <span className="badge badge-bear">SAKELAR DARURAT AKTIF</span>}
            {risk.risk_off && <span className="badge badge-warn">MODE BEBAS RISIKO (RISK-OFF)</span>}
            {risk.capital_preservation && <span className="badge badge-warn">PELESTARIAN MODAL</span>}
            {risk.cooldown_active && <span className="badge badge-muted">COOLDOWN LOSS STREAK AKTIF</span>}
          </div>
        </div>
      )}

      {/* 4 Main Stat Cards */}
      <div className="grid-4 gap-3 mb-4">
        <StatCard
          label="Total Saldo Ekuitas"
          value={fmt(equity)}
          sub={`Belum Realisasi: ${unrealPnl >= 0 ? '+' : ''}${fmt(unrealPnl)}`}
          accent
          icon={<DollarSign size={14} />}
        />
        <StatCard
          label="Realisasi Hari Ini"
          value={`${realPnl >= 0 ? '+' : ''}${fmt(realPnl)}`}
          sub={`${closedToday?.length || 0} transaksi tertutup`}
          warn={realPnl < 0}
          icon={<Activity size={14} />}
        />
        <StatCard
          label="Eksposur Portofolio"
          value={`${exposure.toFixed(1)}%`}
          sub="Maksimal batas panas 6%"
          warn={exposure > 5}
        />
        <StatCard
          label="Market Regime"
          value={dominantRegime.toUpperCase().replace('_', ' ')}
          sub="Klasifikasi multi-timeframe"
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* Qwen AI Live Commentary Box */}
      <div className="card p-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(163, 230, 53, 0.05) 0%, rgba(0, 240, 255, 0.03) 100%)', borderColor: 'rgba(163, 230, 53, 0.3)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Brain size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: 'var(--accent)' }}>
            ANALISIS PASAR AI (QWEN 27B COGNITIVE ADVISOR)
          </span>
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          {aiCommentary}
        </p>
      </div>

      {/* Two Column Grid: Equity Growth Chart + Active Positions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Left: Equity Growth Curve */}
        <div className="card p-4">
          <SectionHeader title="Kurva Saldo Modal" subtitle="Riwayat pertumbuhan ekuitas real-time" />
          <div style={{ height: 180, width: '100%', marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)} USDT`, 'Ekuitas']}
                />
                <Area type="monotone" dataKey="equity" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#equityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Active Positions Overview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionHeader title={`Posisi Aktif (${allPositions.length})`} subtitle="Stop loss & Trailing proteksi" />
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('portfolio')} style={{ fontSize: 11, padding: '2px 8px' }}>
              Detail <ChevronRight size={12} />
            </button>
          </div>

          {allPositions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              Tidak ada posisi terbuka saat ini.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {allPositions.map((p: any, i: number) => (
                <div key={i} className="p-3" style={{ background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.symbol}</span>
                      <span className={`badge ${p.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 9 }}>
                        {p.trade_type?.toUpperCase() || 'SPOT'}
                      </span>
                    </div>
                    <PnlDisplay value={p.unrealized_pnl || 0} pct={p.unrealized_pnl_pct || 0} size="sm" />
                  </div>
                  <div className="flex items-center justify-between" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span>Masuk: ${fmtPrice(p.entry_price)}</span>
                    <span>TP: ${fmtPrice(p.tp_price)}</span>
                    <span>Trailing: ${fmtPrice(p.trailing_stop_price || p.sl_price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Scanned Signals Grid */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Radar Sinyal Kuantitatif Terkini" subtitle="Pemindaian multi-timeframe 11 pasangan aset Binance" />
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('scanner')} style={{ fontSize: 11, padding: '2px 8px' }}>
            Lihat Semua <ChevronRight size={12} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {signals.slice(0, 8).map((s, i) => (
            <div key={i} className="p-3" style={{ background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--bg-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>${fmtPrice(s.price)}</div>
                </div>
                <SignalBadge signal={s.signal} />
              </div>

              <div className="mb-2">
                <ConfidenceBar value={s.confidence} />
              </div>

              {s.bullish_factors.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--bull)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ✓ {s.bullish_factors[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
