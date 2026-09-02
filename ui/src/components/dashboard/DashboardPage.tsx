// src/components/dashboard/DashboardPage.tsx

import React, { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, RegimePill, SignalBadge, ConfidenceBar, PnlDisplay, ProgressRing, SectionHeader, fmt, fmtPct, fmtTime, fmtPrice, StatusDot } from '../shared'
import { RefreshCw, Zap, Shield, TrendingUp, DollarSign, Activity, BarChart2, AlertTriangle } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts'

export default function DashboardPage() {
  const { portfolio, risk, system, scanResults, scanner, closedToday, positions, refresh, triggerScan, loading } = useStore()
  const pos = positions?.spot || []

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  const signals = Object.entries(scanResults).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    signal: r?.score?.signal || 'WAIT',
    confidence: r?.score?.confidence || 0,
    entry_quality: r?.score?.entry_quality || r?.score?.execution_quality || 0,
    filter_status: r?.score?.filter_status || 'passed',
    price: r?.price || 0,
    change: r?.price_change_24h || 0,
    regime: r?.regime?.regime || 'unknown',
    reasoning: r?.score?.reasoning || '',
    bullish_factors: r?.score?.bullish_factors || [],
    bearish_factors: r?.score?.bearish_factors || [],
    component_scores: r?.score?.component_scores || {},
  }))

  const equity = portfolio?.total_equity || 0
  const unrealPnl = portfolio?.unrealized_pnl || 0
  const realPnl = portfolio?.realized_pnl_today || 0
  const drawdown = (portfolio?.drawdown_pct || 0) * 100
  const exposure = (risk?.total_exposure_pct || 0) * 100

  return (
    <div className="page">
      {/* Mobile-friendly header - more informative */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Dasbor</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading} style={{ padding: '4px 8px' }}>
              <RefreshCw size={11} />
            </button>
            <button className="btn btn-lime btn-sm" onClick={triggerScan} style={{ padding: '4px 10px', fontSize: 11 }}>
              <Zap size={11} /> Pindai
            </button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>Terakhir: {fmtTime(system?.last_scan || '')}</span>
          <span style={{ color: 'var(--accent-lime)' }}>Regim: {scanner?.market_regime || 'N/A'}</span>
          <span>Otomatis: {system?.auto_enabled ? '✓' : '✗'}</span>
        </div>
      </div>

      {/* Risk alerts */}
      {(risk?.kill_switch || risk?.risk_off || risk?.capital_preservation || risk?.cooldown_active) && (
        <div className="card mb-4" style={{ borderColor: 'var(--warn)', padding: '10px 14px' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTriangle size={14} style={{ color: 'var(--warn)' }} />
            {risk.kill_switch && <span className="badge badge-bear">SAKELAR DARURAT AKTIF</span>}
            {risk.risk_off && <span className="badge badge-warn">MODE BEBAS RISIKO</span>}
            {risk.capital_preservation && <span className="badge badge-warn">PELESTARIAN MODAL</span>}
            {risk.cooldown_active && <span className="badge badge-muted">COOLDOWN AKTIF</span>}
          </div>
        </div>
      )}

      {/* Main stats - mobile first, stacks nicely */}
      <div className="grid-2 mb-4" style={{ gap: 8 }}>
        <StatCard
          label="Modal"
          value={fmt(equity)}
          sub={`Belum Realisasi: ${unrealPnl >= 0 ? '+' : ''}${fmt(unrealPnl)}`}
          accent
          icon={<DollarSign size={13} />}
        />
        <StatCard
          label="Eksposur / DD"
          value={`${exposure.toFixed(0)}% / ${drawdown.toFixed(1)}%`}
          sub={`${closedToday?.length || 0} transaksi hari ini`}
          warn={exposure > 50}
          icon={<Activity size={13} />}
        />
      </div>

      {/* Ringkasan Sinyal Langsung - lebih detail */}
      <div className="card mb-4" style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>SINYAL LANGSUNG (6 teratas)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {signals.slice(0, 6).map((s, i) => (
            <div key={i} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-deep)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{s.symbol.replace('USDT','')}</span>
              <SignalBadge signal={s.signal} />
              <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{s.confidence.toFixed(0)}</span>
              {s.entry_quality > 0 && <span style={{fontSize:9, color: '#eab308'}}>EQ{s.entry_quality}</span>}
            </div>
          ))}
        </div>
        {signals[0]?.reasoning && (
          <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--bg-border)', paddingTop: 6 }}>
            Alasan utama: {signals[0].reasoning.substring(0, 120)}...
          </div>
        )}
      </div>

      {/* Ringkasan Posisi Terbuka untuk tampilan cepat */}
      <div className="card mb-4" style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>POSISI TERBUKA</div>
        {pos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pos.slice(0,3).map((p, i) => (
              <div key={i} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.symbol} {p.side}</span>
                <span style={{ color: p.unrealized_pnl > 0 ? 'var(--bull)' : 'var(--bear)' }}>
                  {p.unrealized_pnl > 0 ? '+' : ''}{p.unrealized_pnl?.toFixed(2) || '0'}
                </span>
              </div>
            ))}
          </div>
        ) : <div style={{fontSize:10, color:'var(--text-muted)'}}>Tidak ada posisi terbuka</div>}
      </div>

      {/* Regim Pasar + Sinyal */}
      <div className="grid-2 mb-4">
        <div className="card p-4">
          <SectionHeader title="Regim Pasar" />
          <div className="flex flex-col gap-3">
            {signals.slice(0, 4).map(s => (
              <div key={s.symbol} className="flex items-center gap-3" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, minWidth: 48, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {s.symbol.replace('USDT', '')}
                </span>
                <RegimePill regime={s.regime} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.change >= 0 ? 'var(--bull)' : 'var(--bear)', marginLeft: 'auto', flexShrink: 0 }}>
                  {fmtPct(s.change * 100)}
                </span>
              </div>
            ))}
          </div>
          <div className="sep mt-3 mb-3" />
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>DOMINANT:</span>
            <RegimePill regime={scanner?.market_regime || 'unknown'} />
          </div>
        </div>

        <div className="card p-4">
          <SectionHeader title="Sinyal AI" />
          <div className="flex flex-col gap-3">
            {signals.slice(0, 4).map(s => (
              <div key={s.symbol} className="flex flex-col gap-1" style={{ minWidth: 0 }}>
                <div className="flex items-center justify-between gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, minWidth: 42, flexShrink: 0 }}>
                    {s.symbol.replace('USDT', '')}
                  </span>
                  <SignalBadge signal={s.signal} />
                  {s.entry_quality > 50 && <span style={{fontSize:'9px', color:'#eab308', marginLeft:2, flexShrink: 0}}>EQ {s.entry_quality}</span>}
                </div>
                <ConfidenceBar value={s.confidence} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ikhtisar Portofolio */}
      <div className="card p-4 mb-4">
        <SectionHeader title="Alokasi Portofolio" />
        <div className="grid-3">
          <div className="flex flex-col items-center gap-2 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius)', border: '1px solid var(--bg-border)' }}>
            <ProgressRing value={Math.round(((portfolio?.spot_equity || 0) / Math.max(equity, 1)) * 100)} size={48} label={`${Math.round(((portfolio?.spot_equity || 0) / Math.max(equity, 1)) * 100)}%`} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spot</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(portfolio?.spot_equity || 0)}</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius)', border: '1px solid var(--bg-border)' }}>
            <ProgressRing value={Math.round(((portfolio?.futures_equity || 0) / Math.max(equity, 1)) * 100)} size={48} label={`${Math.round(((portfolio?.futures_equity || 0) / Math.max(equity, 1)) * 100)}%`} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Futures</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(portfolio?.futures_equity || 0)}</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius)', border: '1px solid var(--bg-border)' }}>
            <ProgressRing value={100 - Math.round(exposure)} size={48} label={`${(100 - exposure).toFixed(0)}%`} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cash</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(portfolio?.available_cash || 0)}</span>
          </div>
        </div>
      </div>

      {/* Panel Risiko */}
      <div className="card p-4 mb-4">
        <SectionHeader title="Pemantau Risiko" />
        <div className="grid-2 gap-3">
          <RiskRow label="Kerugian Harian" value={`${((risk?.daily_loss_pct || 0) * 100).toFixed(2)}%`} max="5.00%" danger={(risk?.daily_loss_pct || 0) > 0.03} />
          <RiskRow label="Runtutan Rugi" value={String(risk?.loss_streak || 0)} max="3 max" danger={(risk?.loss_streak || 0) >= 3} />
          <RiskRow label="Penurunan" value={`${drawdown.toFixed(2)}%`} max="15% limit" danger={drawdown > 10} />
          <RiskRow label="Eksposur" value={`${exposure.toFixed(1)}%`} max="85% max" warn={exposure > 70} />
        </div>
      </div>

      {/* Keputusan Terbaru */}
      {closedToday && closedToday.length > 0 && (
        <div className="card p-4">
          <SectionHeader title="Transaksi Hari Ini" subtitle={`${closedToday.length} ditutup`} />
          <div className="flex flex-col gap-2">
            {closedToday.slice(-5).reverse().map((trade: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: trade.result === 'win' ? 'var(--bull)' : 'var(--bear)',
                  boxShadow: trade.result === 'win' ? 'var(--shadow-bull)' : 'var(--shadow-bear)'
                }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, flex: 1 }}>
                  {trade.symbol?.replace('USDT', '')}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>{trade.close_reason}</span>
                <PnlDisplay value={trade.pnl_usdt || 0} pct={trade.pnl_pct} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RiskRow({ label, value, max, danger, warn }: {
  label: string; value: string; max: string; danger?: boolean; warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between p-2" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : warn ? 'rgba(245,158,11,0.15)' : 'var(--bg-border)'}` }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: danger ? 'var(--bear)' : warn ? 'var(--warn)' : 'var(--text-primary)' }}>
          {value}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{max}</span>
      </div>
    </div>
  )
}
