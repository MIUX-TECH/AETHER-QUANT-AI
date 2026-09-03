// src/components/scanner/ScannerPage.tsx
import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  SectionHeader, SignalBadge, ConfidenceBar, RegimePill, fmtPrice, fmtPct
} from '../shared'
import {
  Radar, RefreshCw, Zap, Search, Filter, ArrowUpDown,
  TrendingUp, TrendingDown, Layers, Shield
} from 'lucide-react'

export default function ScannerPage() {
  const { scanResults, scanner, triggerScan, refresh, loading } = useStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'bullish' | 'high_conf'>('all')

  const items = Object.entries(scanResults || {}).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    signal: r?.score?.signal || 'WAIT',
    confidence: Number(r?.score?.confidence || 0),
    price: Number(r?.price || 0),
    change: Number(r?.price_change_24h || 0),
    regime: r?.regime?.regime || 'unknown',
    bullish_factors: r?.score?.bullish_factors || [],
    bearish_factors: r?.score?.bearish_factors || [],
    reasoning: r?.score?.reasoning || '',
    support_dist: r?.support_resistance?.distance_to_support_pct || 0,
    resist_dist: r?.support_resistance?.distance_to_resistance_pct || 0,
    indicators: r?.indicators || {},
  })).filter(i => i.price > 0)

  // Filter and search
  const filtered = items.filter(item => {
    const matchSearch = item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false
    if (filterType === 'buy') return item.signal.includes('BUY')
    if (filterType === 'bullish') return item.regime.includes('trending_up') || item.regime.includes('expansion')
    if (filterType === 'high_conf') return item.confidence >= 0.60
    return true
  })

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radar size={18} style={{ color: 'var(--accent)' }} /> Pemindai Pasar Kuantitatif (50+ Koin)
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Multi-Timeframe Analysis · 8-Component Quant Score · AI Setup Validation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading} style={{ padding: '4px 10px' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-lime btn-sm" onClick={triggerScan} disabled={loading} style={{ padding: '4px 12px', fontSize: 11 }}>
            <Zap size={12} />
            <span>Pindai Sekarang</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]" style={{ background: 'var(--bg-deep)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Cari simbol koin (misal: BTC, SOL, PEPE)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 11, width: '100%', outline: 'none' }}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: `Semua (${items.length})` },
            { id: 'buy', label: 'Sinyal BUY' },
            { id: 'bullish', label: 'Regime Bullish' },
            { id: 'high_conf', label: 'Skor Tinggi (≥60%)' },
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-sm ${filterType === f.id ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterType(f.id as any)}
              style={{ padding: '3px 8px', fontSize: 10 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Scanned Coins */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {filtered.map(item => {
          const isUp = item.change >= 0
          const ind1h = item.indicators?.['1h'] || {}
          const rsi1h = ind1h.rsi ? ind1h.rsi.toFixed(1) : '—'
          return (
            <div key={item.symbol} className="card p-3 flex flex-col justify-between">
              <div>
                {/* Top Row: Symbol, Price, Signal */}
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{item.symbol}</span>
                      <span className={`badge ${isUp ? 'badge-bull' : 'badge-bear'}`} style={{ fontSize: 9, padding: '1px 4px' }}>
                        {isUp ? '+' : ''}{(item.change * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 2 }}>
                      ${fmtPrice(item.price)}
                    </div>
                  </div>
                  <SignalBadge signal={item.signal} />
                </div>

                {/* Confidence Bar */}
                <div className="mb-2">
                  <ConfidenceBar value={item.confidence} />
                </div>

                {/* Technical Metric Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <div style={{ background: 'var(--bg-deep)', padding: '3px 4px', borderRadius: 4, textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 8 }}>RSI 1H</div>
                    <div style={{ fontWeight: 600 }}>{rsi1h}</div>
                  </div>
                  <div style={{ background: 'var(--bg-deep)', padding: '3px 4px', borderRadius: 4, textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 8 }}>JARAK SUPP</div>
                    <div style={{ fontWeight: 600, color: 'var(--bull)' }}>+{item.support_dist.toFixed(1)}%</div>
                  </div>
                  <div style={{ background: 'var(--bg-deep)', padding: '3px 4px', borderRadius: 4, textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 8 }}>JARAK RES</div>
                    <div style={{ fontWeight: 600, color: 'var(--bear)' }}>-{item.resist_dist.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Factors summary */}
                {item.bullish_factors.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--bull)', fontFamily: 'var(--font-mono)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ✓ {item.bullish_factors[0]}
                  </div>
                )}
                {item.bearish_factors.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--bear)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ✗ {item.bearish_factors[0]}
                  </div>
                )}
              </div>

              {/* Bottom Regime Pill */}
              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                <RegimePill regime={item.regime} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Skor {(item.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
