import React from 'react'
import { StatCard, fmt } from '../shared'
import { Coins } from 'lucide-react'

export function DashboardStats({
  totalWalletVal, system, spotVal, earnVal, futuresVal,
  totalBtcStack, btcValuationUSD, realPnl, closedToday, drawdown
}: any) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <div className="card card-lime p-3">
        <div className="flex items-center justify-between" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
          <span>Total Valuasi Portofolio</span>
          <span className="badge badge-lime" style={{ fontSize: 7.5 }}>{(system?.mode || 'live').toUpperCase()}</span>
        </div>
        <div className="mono font-bold" style={{ fontSize: 20, color: 'var(--accent)', marginTop: 3 }}>
          ${totalWalletVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-2 mt-1.5 mono" style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
          <span>Spot: ${spotVal.toFixed(2)}</span>
          {earnVal > 0 && <span style={{ color: '#00F0FF' }}>· Earn: ${earnVal.toFixed(2)}</span>}
          {futuresVal > 0 && <span>· Futures: ${futuresVal.toFixed(2)}</span>}
        </div>
      </div>

      <div className="card p-3" style={{ borderLeft: '3px solid #00F0FF', background: 'linear-gradient(135deg, rgba(0,240,255,0.04), var(--bg-card))' }}>
        <div className="flex items-center justify-between" style={{ fontSize: 9.5, color: '#00F0FF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <span className="flex items-center gap-1"><Coins size={11} /> BTC VAULT STACK</span>
          <span style={{ fontSize: 7.5 }}>ACCUMULATOR</span>
        </div>
        <div className="mono font-bold" style={{ fontSize: 17, color: '#00F0FF', marginTop: 3 }}>
          {totalBtcStack.toFixed(8)} BTC
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
          Valuasi: ${btcValuationUSD.toFixed(2)} USDT
        </div>
      </div>

      <StatCard
        label="Realisasi Profit Hari Ini"
        value={`${realPnl >= 0 ? '+' : ''}${fmt(realPnl)}`}
        sub={`${closedToday?.length || 0} Trade Ditutup Hari Ini`}
        bull={realPnl > 0}
        danger={realPnl < 0}
      />

      <StatCard
        label="Penurunan (Drawdown)"
        value={`${drawdown.toFixed(2)}%`}
        sub={`Batas Risiko Max: 15.0%`}
        danger={drawdown >= 10}
      />
    </div>
  )
}
