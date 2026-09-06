import React from 'react'
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
