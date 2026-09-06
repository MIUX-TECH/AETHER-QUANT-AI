import os

components_dir = "/root/binance-ai-trader/ui/src/components/dashboard"
os.makedirs(components_dir, exist_ok=True)

# 1. AiCopilotFng.tsx
with open(os.path.join(components_dir, "AiCopilotFng.tsx"), "w") as f:
    f.write("""import React from 'react'
import { Brain, Zap, Activity } from 'lucide-react'

export function AiCopilotFng({
  dominantRegime, triggerScan, loading, aiCommentary, fng, fngColor
}: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Qwen 27B AI Live Copilot Card */}
      <div
        className="card p-3"
        style={{
          background: 'linear-gradient(135deg, rgba(163,230,53,0.03), rgba(0,240,255,0.02), var(--bg-card))',
          border: '1px solid var(--accent-glow)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}
      >
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)' }}>
              <Brain size={13} style={{ color: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em' }}>Qwen 27B AI Copilot</span>
            <span className="badge badge-lime" style={{ fontSize: 8 }}>GATEKEEPER AKTIF</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-muted" style={{ fontSize: 8.5 }}>
              REZIM: {dominantRegime.toUpperCase()}
            </span>
            <button className="btn btn-lime btn-xs" onClick={triggerScan} disabled={loading} style={{ padding: '3px 8px', fontSize: 9.5 }}>
              <Zap size={10} /> Scan
            </button>
          </div>
        </div>
        <p style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {aiCommentary}
        </p>
      </div>

      {/* Fear & Greed Index Card */}
      <div className="card p-3 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={13} style={{ color: fngColor }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Fear & Greed Index</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', color: fngColor, lineHeight: 1.1 }}>
            {fng.value} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: fngColor, fontWeight: 700, marginTop: 2, textTransform: 'uppercase' }}>
            {fng.class}
          </div>
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, maxWidth: 200 }}>
            {fng.value >= 85 ? 'Macro TP (Jual Vault) aktif' : fng.value <= 20 ? 'Buyback Matrix (DCA Beli) aktif' : 'Alokasi portofolio berjalan normal.'}
          </p>
        </div>
        
        <div style={{ width: 80, height: 80, position: 'relative' }}>
          {/* Simple CSS Gauge */}
          <svg viewBox="0 0 100 50" style={{ overflow: 'visible' }}>
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--bg-border)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={fngColor} strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (fng.normalized * 125.6)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: fngColor }}>
            {fng.value}
          </div>
        </div>
      </div>
    </div>
  )
}
""")

# 2. EquityCurveHedge.tsx
with open(os.path.join(components_dir, "EquityCurveHedge.tsx"), "w") as f:
    f.write("""import React from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { SectionHeader } from '../shared'
import { ArrowUpRight } from 'lucide-react'

export function EquityCurveHedge({
  chartPoints, chartRange, setChartRange, totalWalletVal, navigate
}: any) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
      {/* Equity Curve Chart */}
      <div className="card p-3 xl:col-span-2">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <SectionHeader title="Kurva Pertumbuhan Ekuitas" subtitle="Pergerakan nilai portofolio berdasarkan transaksi riil" />
          <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border">
            {(['1D', '7D', '30D', 'ALL'] as const).map(range => (
              <button
                key={range}
                className={`btn btn-xs ${chartRange === range ? 'btn-lime' : 'btn-ghost'}`}
                style={{ padding: '2px 7px', fontSize: 9 }}
                onClick={() => setChartRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 165, width: '100%', marginTop: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A3E635" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#A3E635" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Ekuitas']}
              />
              <Area type="monotone" dataKey="equity" stroke="#A3E635" strokeWidth={2} fillOpacity={1} fill="url(#eqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3-Bucket Hedge Fund Card */}
      <div className="card p-3 flex flex-col justify-between">
        <div>
          <SectionHeader title="Alokasi 3-Bucket Hedge Fund" subtitle="Plafon modal & target akumulasi" />
          <div className="flex flex-col gap-2.5 mt-2.5">
            <div>
              <div className="flex justify-between items-center mb-1" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: '#00F0FF', fontWeight: 700 }}>BTC Vault (Target 70% Spot)</span>
                <span style={{ fontWeight: 600 }}>${(totalWalletVal * 0.7).toFixed(2)}</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '70%', height: '100%', background: '#00F0FF' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--bull)' }}>Spot Altcoins (Target 30% Spot)</span>
                <span style={{ fontWeight: 600 }}>${(totalWalletVal * 0.3).toFixed(2)}</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '30%', height: '100%', background: 'var(--bull)' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--warn)' }}>Futures Hedge (Target 10% Plafon)</span>
                <span style={{ fontWeight: 600 }}>${(totalWalletVal * 0.1).toFixed(2)}</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '10%', height: '100%', background: 'var(--warn)' }} />
              </div>
            </div>

            {/* Buyback Reserve Addition */}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex justify-between items-center mb-1" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  💰 Buyback Reserve
                </span>
                <span style={{ fontWeight: 600, color: 'var(--bull)' }}>$0.00</span>
              </div>
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Siaga untuk DCA Crash & Extreme Fear (F&G &lt; 20)
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-border flex justify-between items-center">
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Deviasi Drift: 5.0%</span>
          <button className="btn btn-ghost btn-xs" onClick={() => navigate('/portfolio')} style={{ fontSize: 9.5 }}>
            Portofolio <ArrowUpRight size={9} />
          </button>
        </div>
      </div>

      {/* BTC Halving Cycle Phase Card */}
      <div className="card p-3 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div>
          <SectionHeader title="Siklus Halving BTC" subtitle="Strategi makro berbasis kuartal" />
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fase Saat Ini:</span>
              <span className="badge badge-lime" style={{ fontSize: 8 }}>MID-CYCLE</span>
            </div>
            <div className="flex items-center justify-between mb-2" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Halving Berikutnya:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>~Apr 2028</span>
            </div>
            
            <div style={{ background: 'var(--bg-deep)', padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: 2 }}>
                ACTION PLAN:
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Akumulasi Grid DCA aktif. Target BTC Vault dipertahankan 60-70%. Tidak ada Macro TP sampai Extreme Greed post-halving.
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-border flex justify-between items-center">
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Block: ~901,245</span>
        </div>
      </div>
    </div>
  )
}
""")

# 3. ActivePositionsTable.tsx
with open(os.path.join(components_dir, "ActivePositionsTable.tsx"), "w") as f:
    f.write("""import React from 'react'
import { SectionHeader, fmtPrice, PnlDisplay } from '../shared'
import { ArrowUpRight } from 'lucide-react'

export function ActivePositionsTable({ allPositions, navigate }: any) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader
          title={`Posisi Bot Terbuka (${allPositions.length})`}
          subtitle="Monitoring real-time harga entry, target take profit, dan trailing stop"
        />
        <button className="btn btn-ghost btn-xs" onClick={() => navigate('/positions')} style={{ fontSize: 10 }}>
          Kelola Posisi <ArrowUpRight size={10} />
        </button>
      </div>

      {allPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
          Belum ada posisi terbuka saat ini. Bot memindai peluang setiap 60 detik.
        </div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Simbol</th>
                <th style={{ padding: '6px 4px' }}>Tipe</th>
                <th style={{ padding: '6px 4px' }}>Nilai (USDT)</th>
                <th style={{ padding: '6px 4px' }}>Harga Masuk</th>
                <th style={{ padding: '6px 4px' }}>Harga Terkini</th>
                <th style={{ padding: '6px 4px' }}>SL / Trailing</th>
                <th style={{ padding: '6px 4px' }}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {allPositions.slice(0, 4).map((pos: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                  <td style={{ padding: '6px 4px', fontWeight: 700 }}>{pos.symbol}</td>
                  <td style={{ padding: '6px 4px' }}>
                    <span className={`badge ${pos.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 8.5 }}>
                      {pos.trade_type?.toUpperCase() || 'SPOT'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 4px' }}>${Number(pos.position_usdt || pos.current_value || 0).toFixed(2)}</td>
                  <td style={{ padding: '6px 4px' }}>${fmtPrice(pos.entry_price)}</td>
                  <td style={{ padding: '6px 4px', fontWeight: 600 }}>${fmtPrice(pos.current_price || pos.entry_price)}</td>
                  <td style={{ padding: '6px 4px', color: 'var(--warn)' }}>${fmtPrice(pos.trailing_stop_price || pos.sl_price)}</td>
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
  )
}
""")

# 4. TopSignalsList.tsx
with open(os.path.join(components_dir, "TopSignalsList.tsx"), "w") as f:
    f.write("""import React from 'react'
import { SectionHeader, fmtPrice, SignalBadge } from '../shared'
import { ArrowUpRight } from 'lucide-react'

export function TopSignalsList({ signals, navigate }: any) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader
          title="Radar Sinyal 8 Pilar Teratas"
          subtitle="Hasil pemindaian kuantitatif terkonfirmasi Qwen AI"
        />
        <button className="btn btn-ghost btn-xs" onClick={() => navigate('/scanner')} style={{ fontSize: 10 }}>
          Buka Pemindai <ArrowUpRight size={10} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
        {signals.slice(0, 6).map((sig: any, i: number) => (
          <div
            key={i}
            className="p-2 rounded bg-deep border border-border flex flex-col justify-between"
            style={{ minHeight: 80 }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="mono font-bold" style={{ fontSize: 12 }}>{sig.symbol}</span>
                <span className="badge badge-muted" style={{ fontSize: 7.5 }}>{sig.regime.toUpperCase()}</span>
              </div>
              <SignalBadge signal={sig.signal} />
            </div>

            <div className="flex items-center justify-between mono mb-1" style={{ fontSize: 9.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>${fmtPrice(sig.price)}</span>
              <span style={{ color: sig.change >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                {sig.change >= 0 ? '+' : ''}{sig.change.toFixed(2)}%
              </span>
            </div>

            <div className="pt-1 border-t border-border flex items-center justify-between" style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Skor 8 Pilar:</span>
              <span className="font-bold" style={{ color: sig.confidence >= 0.68 ? 'var(--bull)' : 'var(--text-secondary)' }}>
                {(sig.confidence * 100).toFixed(0)}% {sig.confidence >= 0.68 ? '✓ AI APPROVED' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
""")

# 5. ChartUtils.ts
with open(os.path.join(components_dir, "ChartUtils.ts"), "w") as f:
    f.write("""export function generateDynamicChartPoints(currentVal: number, trades: any[], range: string) {
  if (currentVal <= 0) return [{ time: 'Sekarang', equity: 0 }]
  
  if (trades.length === 0) {
    return [
      { time: 'T-4', equity: currentVal },
      { time: 'T-3', equity: currentVal },
      { time: 'T-2', equity: currentVal },
      { time: 'T-1', equity: currentVal },
      { time: 'Sekarang', equity: currentVal },
    ]
  }

  // Calculate back cumulative PnL from trades
  const sorted = [...trades].sort((a, b) => (a.exit_time || 0) - (b.exit_time || 0))
  let running = currentVal - sorted.reduce((sum, t) => sum + Number(t.realized_pnl || 0), 0)
  
  const points = [{ time: 'Awal', equity: Number(running.toFixed(2)) }]
  sorted.forEach((t, i) => {
    running += Number(t.realized_pnl || 0)
    const timeStr = t.exit_time ? new Date(t.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i+1}`
    points.push({ time: timeStr, equity: Number(running.toFixed(2)) })
  })
  
  points.push({ time: 'Sekarang', equity: Number(currentVal.toFixed(2)) })
  return points
}
""")

