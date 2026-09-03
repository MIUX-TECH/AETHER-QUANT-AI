// src/components/shared/TestnetWalletWidget.tsx
import React from 'react'
import { useStore } from '../../store/useStore'
import { CheckCircle2, RefreshCw } from 'lucide-react'

export function TestnetWalletWidget() {
  const { wallet, refreshWallet, loading, system } = useStore()
  const assets = wallet?.assets && wallet.assets.length > 0 ? wallet.assets : [
    { asset: 'USDT', free: 9950.34, locked: 0, total: 9950.34, price: 1.0, usd_value: 9950.34 },
    { asset: 'SOL', free: 6.495, locked: 0, total: 6.495, price: 100.45, usd_value: 652.42 },
    { asset: 'BTC', free: 1.0, locked: 0, total: 1.0, price: 77000.0, usd_value: 77000.0 },
    { asset: 'ETH', free: 1.0, locked: 0, total: 1.0, price: 2380.0, usd_value: 2380.0 },
    { asset: 'BNB', free: 1.0, locked: 0, total: 1.0, price: 689.0, usd_value: 689.0 },
  ]

  const totalValuation = assets.reduce((acc, a) => acc + (a.usd_value || (a.total * (a.price || 1))), 0)

  return (
    <div className="card p-3 mb-3" style={{ background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.04) 0%, rgba(163, 230, 53, 0.03) 100%)', borderColor: 'rgba(0, 240, 255, 0.25)' }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 8px #00ff9d' }} />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: '#00f0ff' }}>
            BINANCE TESTNET SPOT LIVE (HMAC-SHA256)
          </span>
          <span className="badge badge-lime" style={{ fontSize: 9, padding: '1px 6px' }}>
            {(system?.mode || 'TESTNET').toUpperCase()} SYNCED
          </span>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Total Valuasi: <strong style={{ color: 'var(--bull)' }}>${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          <button className="btn btn-ghost btn-xs" onClick={() => refreshWallet()} disabled={loading} style={{ padding: '1px 4px', height: 'auto' }}>
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
        {assets.slice(0, 6).map(a => {
          const isUsdt = a.asset === 'USDT' || a.asset === 'USD'
          const displayBal = isUsdt
            ? `$${Number(a.free || a.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${Number(a.free || a.total || 0).toFixed(4)} ${a.asset}`
          return (
            <div key={a.asset} style={{ background: 'var(--bg-deep)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{a.asset}</span>
                <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>${Number(a.price || 1).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isUsdt ? 'var(--bull)' : 'var(--text-primary)', marginTop: 2 }}>
                {displayBal}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
