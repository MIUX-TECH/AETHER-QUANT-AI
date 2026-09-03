// src/components/shared/TestnetWalletWidget.tsx
import React from 'react'
import { useStore } from '../../store/useStore'
import { RefreshCw, Wallet, ArrowUpRight, ShieldCheck } from 'lucide-react'

export function TestnetWalletWidget() {
  const { wallet, refreshWallet, loading, system, setActiveTab } = useStore()
  const assets = wallet?.assets && wallet.assets.length > 0 ? wallet.assets : []
  const totalValuation = wallet?.total_equity_usd || assets.reduce((acc, a) => acc + (a.usd_value || (a.total * (a.price || 1))), 0)

  // Primary liquid assets filter
  const displayAssets = assets.filter(a => ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'USD'].includes(a.asset) || a.usd_value > 50).slice(0, 6)

  return (
    <div className="card p-2.5 mb-2.5" style={{ background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.05) 0%, rgba(0, 255, 157, 0.03) 100%)', borderColor: 'rgba(0, 240, 255, 0.22)' }}>
      {/* Top Header Strip */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
        <div className="flex items-center gap-2">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bull)', boxShadow: '0 0 6px var(--bull)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: 'var(--accent)' }}>
            BINANCE TESTNET GATEWAY
          </span>
          <span className="badge badge-bull" style={{ fontSize: 8, padding: '1px 5px' }}>
            HMAC-SHA256 SYNCED
          </span>
        </div>

        <div className="flex items-center gap-2" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Valuasi Net: <strong className="bull mono">${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => refreshWallet()}
            disabled={loading}
            style={{ padding: '2px 6px', height: 'auto' }}
            title="Segarkan Saldo"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="btn btn-lime btn-xs"
            onClick={() => setActiveTab('portfolio')}
            style={{ padding: '2px 6px', height: 'auto', fontSize: 9 }}
          >
            Portofolio <ArrowUpRight size={10} />
          </button>
        </div>
      </div>

      {/* Asset Grid (Ultra Compact) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 4 }}>
        {displayAssets.map(a => {
          const isStable = a.asset === 'USDT' || a.asset === 'USD'
          const displayBal = isStable
            ? `$${Number(a.free || a.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${Number(a.free || a.total || 0).toFixed(4)}`

          return (
            <div
              key={a.asset}
              style={{
                background: 'var(--bg-deep)',
                padding: '5px 7px',
                borderRadius: 5,
                border: '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div className="flex items-center justify-between" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.asset}</span>
                <span>${Number(a.price || 1).toFixed(isStable ? 2 : 2)}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: isStable ? 'var(--bull)' : 'var(--text-primary)', marginTop: 2 }}>
                {displayBal}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
