// src/components/reports/ReportsPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, fmt, fmtPct, EmptyState, LoadingSpinner } from '../shared'
import { BarChart3, TrendingUp, RefreshCw } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

export default function ReportsPage() {
  const { performance, refreshPerformance, loading } = useStore()
  const [months, setMonths] = useState(1)

  useEffect(() => { refreshPerformance(months) }, [months])

  const perf = performance

  if (!perf || perf.status === 'no_data') {
    return (
      <div className="page">
        <div className="flex items-center justify-between mb-5">
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Laporan</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => refreshPerformance(months)}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <EmptyState icon={<BarChart3 size={32} />} message="No trade history available yet. Trades will appear here after they close." />
      </div>
    )
  }

  const equity = perf.equity_curve || []

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Laporan Kinerja</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {perf.total_trades} trades · Last {months} month{months > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {([1, 3, 6] as const).map(m => (
            <button key={m} className={`btn btn-ghost btn-sm ${months === m ? '' : ''}`}
              style={months === m ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
              onClick={() => setMonths(m)}>{m}M</button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => refreshPerformance(months)}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid-4 gap-3 mb-4">
        {[
          { label: 'Win Rate', value: `${(perf.win_rate * 100).toFixed(1)}%`, positive: perf.win_rate >= 0.5 },
          { label: 'Total PnL', value: `${perf.total_pnl_usdt >= 0 ? '+' : ''}$${perf.total_pnl_usdt?.toFixed(2)}`, positive: perf.total_pnl_usdt >= 0 },
          { label: 'Profit Factor', value: perf.profit_factor?.toFixed(2), positive: perf.profit_factor >= 1 },
          { label: 'Max Drawdown', value: `${(perf.max_drawdown_pct * 100).toFixed(2)}%`, positive: perf.max_drawdown_pct < 0.1 },
        ].map(m => (
          <div key={m.label} className="card p-4">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em',
              color: m.positive ? 'var(--bull)' : 'var(--bear)',
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid-4 gap-3 mb-5">
        {[
          { label: 'Wins', value: perf.wins, color: 'var(--bull)' },
          { label: 'Losses', value: perf.losses, color: 'var(--bear)' },
          { label: 'Avg Win', value: `+$${perf.avg_win_usdt?.toFixed(2)}`, color: 'var(--bull)' },
          { label: 'Avg Loss', value: `$${perf.avg_loss_usdt?.toFixed(2)}`, color: 'var(--bear)' },
        ].map(m => (
          <div key={m.label} className="card p-3">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 700, color: m.color }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {equity.length > 1 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Kurva Modal" subtitle={`${equity.length} titik data`} />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={equity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                labelStyle={{ color: 'var(--text-muted)' }}
                itemStyle={{ color: 'var(--accent-lime)' }}
              />
              <ReferenceLine y={1000} stroke="var(--text-muted)" strokeDasharray="4 4" opacity={0.4} />
              <Line type="monotone" dataKey="equity" stroke="var(--accent-lime)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--accent-lime)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily PnL bar chart */}
      {equity.length > 1 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Daily PnL" />
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={equity.slice(-30)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" opacity={0.4} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {equity.slice(-30).map((entry: any, index: number) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? 'var(--bull)' : 'var(--bear)'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By symbol */}
      {perf.by_symbol && Object.keys(perf.by_symbol).length > 0 && (
        <div className="card p-4 mb-4">
          <SectionHeader title="Performance by Symbol" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th className="text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perf.by_symbol).map(([sym, s]: [string, any]) => (
                  <tr key={sym}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sym.replace('USDT', '')}</td>
                    <td>{s.total}</td>
                    <td>
                      <span style={{ color: s.win_rate >= 0.5 ? 'var(--bull)' : 'var(--bear)' }}>
                        {(s.win_rate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span style={{ color: s.pnl_usdt >= 0 ? 'var(--bull)' : 'var(--bear)', fontWeight: 600 }}>
                        {s.pnl_usdt >= 0 ? '+' : ''}${s.pnl_usdt?.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By strategy */}
      {perf.by_strategy && Object.keys(perf.by_strategy).length > 0 && (
        <div className="card p-4">
          <SectionHeader title="Performance by Strategy" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th className="text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perf.by_strategy).map(([strat, s]: [string, any]) => (
                  <tr key={strat}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{strat}</td>
                    <td>{s.total}</td>
                    <td>
                      <span style={{ color: s.win_rate >= 0.5 ? 'var(--bull)' : 'var(--bear)' }}>
                        {(s.win_rate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span style={{ color: s.pnl_usdt >= 0 ? 'var(--bull)' : 'var(--bear)', fontWeight: 600 }}>
                        {s.pnl_usdt >= 0 ? '+' : ''}${s.pnl_usdt?.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
