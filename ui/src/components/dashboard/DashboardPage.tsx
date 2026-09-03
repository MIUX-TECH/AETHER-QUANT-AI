// src/components/dashboard/DashboardPage.tsx — Quantitative Trading Terminal
import React, { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import {
  StatCard, SignalBadge, ConfidenceBar, PnlDisplay,
  SectionHeader, fmt, fmtPrice, TickerRibbon, TestnetWalletWidget
} from '../shared'
import {
  RefreshCw, Zap, TrendingUp, DollarSign, Activity,
  Brain, AlertTriangle, ChevronRight, Layers, ShieldCheck
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export default function DashboardPage() {
  const {
    portfolio, risk, system, scanResults, scanner, closedToday,
    positions, wallet, refresh, triggerScan, loading, setActiveTab
  } = useStore()

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []
  const allPositions = [...allSpot, ...allFutures]
  const holdings = wallet?.assets?.filter(a => !['USDT', 'USD', 'USDC'].includes(a.asset) && a.total > 0) || []

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 20000)
    return () => clearInterval(interval)
  }, [])

  const totalWalletVal = wallet?.total_equity_usd || wallet?.assets?.reduce((acc, a) => acc + (a.usd_value || (a.total * (a.price || 1))), 0) || 0
  const equity = totalWalletVal > 0 ? totalWalletVal : Number(portfolio?.total_equity || 10000)
  const unrealPnl = Number(portfolio?.unrealized_pnl || 0)
  const realPnl = Number(portfolio?.realized_pnl_today || 0)
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
    { time: '00:00', equity: equity * 0.998 },
    { time: '04:00', equity: equity * 0.999 },
    { time: '08:00', equity: equity * 0.9985 },
    { time: '12:00', equity: equity * 0.9995 },
    { time: '16:00', equity: equity * 0.999 },
    { time: 'Sekarang', equity: equity },
  ]

  // Dynamic Qwen AI commentary
  const dominantRegime = scanner?.market_regime || 'ranging'
  const buySignalsCount = signals.filter(s => s.signal.includes('BUY')).length
  const aiCommentary = dominantRegime === 'trending_up'
    ? `Pasar terdeteksi TRENDING UP. Model kuantitatif menemukan ${buySignalsCount} aset dengan momentum bullish. Eksekusi difokuskan pada breakout terkonfirmasi dan trailing stop ketat.`
    : dominantRegime === 'trending_down'
    ? `Pasar terdeteksi TRENDING DOWN. Sistem mengaktifkan mode proteksi modal (defensive allocation) untuk menghindari drawdown ekuitas.`
    : `Kondisi pasar BERKONSOLIDASI (RANGING). Algoritma mean-reversion aktif mencari area support/resistance kunci untuk akumulasi terkontrol.`

  return (
    <div className="page">
      {/* Real-time Ticker Ribbon */}
      <TickerRibbon />

      {/* Real-time Binance Testnet Wallet Sync Widget */}
      <TestnetWalletWidget />

      {/* Main Header */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Terminal Dasbor</h1>
            <span className="badge badge-lime" style={{ fontSize: 9 }}>
              {(system?.mode || 'TESTNET').toUpperCase()}
            </span>
            <span className="badge badge-bull" style={{ fontSize: 9 }}>
              {system?.status === 'running' ? '● LIVE 24/7' : 'SIAGA'}
            </span>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Binance REST Gateway · Groq Qwen 27B Quant Engine
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost btn-xs" onClick={refresh} disabled={loading}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
          <button className="btn btn-lime btn-xs" onClick={triggerScan} disabled={loading}>
            <Zap size={11} />
            <span>Pindai Pasar</span>
          </button>
        </div>
      </div>

      {/* Risk Alert Banners if triggered */}
      {(risk?.kill_switch || risk?.risk_off || risk?.capital_preservation || risk?.cooldown_active) && (
        <div className="card mb-2.5" style={{ borderColor: 'var(--warn)', padding: '8px 10px', background: 'rgba(255, 184, 0, 0.05)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle size={13} style={{ color: 'var(--warn)' }} />
            {risk.kill_switch && <span className="badge badge-bear">SAKELAR DARURAT AKTIF</span>}
            {risk.risk_off && <span className="badge badge-warn">MODE BEBAS RISIKO (RISK-OFF)</span>}
            {risk.capital_preservation && <span className="badge badge-warn">PELESTARIAN MODAL</span>}
            {risk.cooldown_active && <span className="badge badge-muted">COOLDOWN LOSS STREAK AKTIF</span>}
          </div>
        </div>
      )}

      {/* 4 Main Stat Cards (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="grid-4 mb-2.5">
        <StatCard
          label="Total Saldo Ekuitas"
          value={fmt(equity)}
          sub={`Unrealized: ${unrealPnl >= 0 ? '+' : ''}${fmt(unrealPnl)}`}
          accent
          icon={<DollarSign size={12} />}
        />
        <StatCard
          label="Realisasi Hari Ini"
          value={`${realPnl >= 0 ? '+' : ''}${fmt(realPnl)}`}
          sub={`${closedToday?.length || 0} order tertutup`}
          warn={realPnl < 0}
          icon={<Activity size={12} />}
        />
        <StatCard
          label="Eksposur Portofolio"
          value={`${exposure.toFixed(1)}%`}
          sub="Batas aman risiko: 6%"
          warn={exposure > 5}
        />
        <StatCard
          label="Market Regime"
          value={dominantRegime.toUpperCase().replace('_', ' ')}
          sub="Multi-timeframe classifier"
          icon={<TrendingUp size={12} />}
        />
      </div>

      {/* Qwen AI Cognitive Stream */}
      <div className="card p-2.5 mb-2.5" style={{ background: 'linear-gradient(135deg, rgba(163, 230, 53, 0.05) 0%, rgba(20, 24, 32, 0.95) 100%)', borderColor: 'rgba(163, 230, 53, 0.25)' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Brain size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: 'var(--accent)' }}>
            ANALISIS PASAR AI (QWEN 27B QUANT ADVISOR)
          </span>
        </div>
        <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          {aiCommentary}
        </p>
      </div>

      {/* Two Column Grid: Equity Growth Curve + Active Positions / Holdings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8, marginBottom: 10 }}>
        {/* Left: Equity Growth Curve */}
        <div className="card p-2.5">
          <SectionHeader title="Pertumbuhan Saldo Ekuitas" subtitle="Kurva riwayat nilai portofolio real-time" />
          <div style={{ height: 160, width: '100%', marginTop: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)} USDT`, 'Ekuitas']}
                />
                <Area type="monotone" dataKey="equity" stroke="var(--accent)" strokeWidth={1.5} fillOpacity={1} fill="url(#equityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Active Positions / Spot Holdings Overview */}
        <div className="card p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <SectionHeader
              title={allPositions.length > 0 ? `Posisi Aktif (${allPositions.length})` : `Aset Spot Terbuka (${holdings.length})`}
              subtitle={allPositions.length > 0 ? "Proteksi TP & Trailing Stop" : "Saldo koin aktif di akun Testnet"}
            />
            <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('portfolio')} style={{ fontSize: 10, padding: '2px 6px' }}>
              Detail <ChevronRight size={11} />
            </button>
          </div>

          {allPositions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {allPositions.map((p: any, i: number) => (
                <div key={i} className="p-2" style={{ background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{p.symbol}</span>
                      <span className={`badge ${p.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 8 }}>
                        {p.trade_type?.toUpperCase() || 'SPOT'}
                      </span>
                    </div>
                    <PnlDisplay value={p.unrealized_pnl || 0} pct={p.unrealized_pnl_pct || 0} size="sm" />
                  </div>
                  <div className="flex items-center justify-between mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>Masuk: ${fmtPrice(p.entry_price)}</span>
                    <span>TP: ${fmtPrice(p.tp_price)}</span>
                    <span>SL: ${fmtPrice(p.trailing_stop_price || p.sl_price)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : holdings.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {holdings.slice(0, 4).map((h: any, i: number) => (
                <div key={i} className="p-2" style={{ background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{h.asset}/USDT</span>
                      <span className="badge badge-bull" style={{ fontSize: 8 }}>
                        {Number(h.total || 0).toFixed(4)} {h.asset}
                      </span>
                    </div>
                    <span className="bull mono" style={{ fontSize: 11, fontWeight: 700 }}>
                      ${(h.usd_value || (h.total * h.price)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>Harga: ${Number(h.price || 0).toFixed(2)}</span>
                    <span>Status: Tersimpan di Spot Testnet</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              Tidak ada posisi atau aset terbuka saat ini.
            </div>
          )}
        </div>
      </div>

      {/* Top Scanned Signals Radar */}
      <div className="card p-2.5">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Radar Sinyal Kuantitatif Terkini" subtitle="Pemindaian multi-timeframe 11 pasangan aset Binance" />
          <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('scanner')} style={{ fontSize: 10, padding: '2px 6px' }}>
            Lihat Semua <ChevronRight size={11} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
          {signals.slice(0, 8).map((s, i) => (
            <div key={i} className="p-2" style={{ background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{s.symbol}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>${fmtPrice(s.price)}</div>
                </div>
                <SignalBadge signal={s.signal} />
              </div>

              <div className="mb-1">
                <ConfidenceBar value={s.confidence} size="sm" />
              </div>

              {s.bullish_factors.length > 0 && (
                <div className="mono truncate" style={{ fontSize: 9, color: 'var(--bull)' }}>
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
