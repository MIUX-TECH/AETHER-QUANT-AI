// src/components/shared/TestnetWalletWidget.tsx
import React from 'react'
import { useStore } from '../../store/useStore'
import { RefreshCw, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function TestnetWalletWidget() {
  const { wallet, refreshWallet, loading, system } = useStore()
  const navigate = useNavigate()
  const assets = wallet?.assets && wallet.assets.length > 0 ? wallet.assets : []
  const totalValuation = wallet?.total_equity_usd || assets.reduce((acc, a) => acc + (a.usd_value || (a.total * (a.price || 1))), 0)

  // Primary liquid assets filter
  const displayAssets = assets.filter(a => ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'USD'].includes(a.asset) || a.usd_value > 50).slice(0, 6)

  return (
    <div className="card card-lime mb-2.5" style={{ padding: '10px 12px' }}>
      {/* Top Header Strip */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--bull)',
            boxShadow: '0 0 8px var(--bull)'
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: 'var(--accent)' }}>
            BINANCE TESTNET GATEWAY
          </span>
          <span className="badge badge-lime" style={{ fontSize: 9, padding: '1px 6px' }}>
            {(system?.mode || 'TESTNET').toUpperCase()} ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Total Valuasi: <strong className="bull mono" style={{ fontSize: 12 }}>${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => refreshWallet()}
            disabled={loading}
            style={{ padding: '3px 6px', height: 'auto' }}
            title="Segarkan Saldo"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="btn btn-lime btn-xs"
            onClick={() => navigate('/portfolio')}
            style={{ padding: '3px 8px', height: 'auto', fontSize: 10 }}
          >
            Portofolio <ArrowUpRight size={11} />
          </button>
        </div>
      </div>

      {/* Asset Grid (Refined Institutional Chips) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 6 }}>
        {displayAssets.map(a => {
          const isStable = a.asset === 'USDT' || a.asset === 'USD'
          const displayBal = isStable
            ? `$${Number(a.free || a.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${Number(a.free || a.total || 0).toFixed(4)}`

          return (
            <div
              key={a.asset}
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div className="flex items-center justify-between" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.asset}</span>
                <span>${Number(a.price || 1).toFixed(isStable ? 2 : 2)}</span>
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: isStable ? 'var(--bull)' : 'var(--text-primary)', marginTop: 2 }}>
                {displayBal}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
