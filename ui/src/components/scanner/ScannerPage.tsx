// src/components/scanner/ScannerPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SignalBadge, RegimePill, ConfidenceBar, SectionHeader, fmtPrice, fmtPct, fmtTime } from '../shared'
import { Radar, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react'

export default function ScannerPage() {
  const { scanResults, scanner, system, triggerScan, refreshScan, loading } = useStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'confidence' | 'change' | 'signal'>('confidence')

  useEffect(() => {
    refreshScan()
  }, [])

  const entries = Object.entries(scanResults).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    price: r?.price || 0,
    change: (r?.price_change_24h || 0) * 100,
    volume: r?.quote_volume_24h || 0,
    signal: r?.score?.signal || 'WAIT',
    confidence: r?.score?.confidence || 0,
    regime: r?.regime?.regime || 'unknown',
    regime_conf: r?.regime?.confidence || 0,
    bullish: r?.score?.bullish_factors || [],
    bearish: r?.score?.bearish_factors || [],
    reasoning: r?.score?.reasoning || '',
    components: r?.score?.component_scores || {},
    indicators: r?.indicators || {},
    status: r?.scan_status || 'ok',
    timestamp: r?.timestamp || '',
    volatility: r?.volatility_pct || 0,
  }))

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === 'confidence') return b.confidence - a.confidence
    if (sortBy === 'change') return Math.abs(b.change) - Math.abs(a.change)
    const order = ['STRONG_BUY', 'BUY', 'SHORT', 'HOLD', 'REDUCE', 'SELL', 'WAIT', 'AVOID']
    return order.indexOf(a.signal) - order.indexOf(b.signal)
  })

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Pemindai Pasar</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {entries.length} simbol · Terakhir: {fmtTime(system?.last_scan || '')}
          </p>
        </div>
        <button className="btn btn-lime btn-sm" onClick={triggerScan}>
          <Radar size={12} />
          Scan Now
        </button>
      </div>

      {/* Sort */}
      <div className="flex gap-2 mb-4">
        {(['confidence', 'change', 'signal'] as const).map(s => (
          <button key={s} className={`btn btn-ghost btn-sm ${sortBy === s ? 'active' : ''}`}
            style={sortBy === s ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
            onClick={() => setSortBy(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="card p-8 text-center">
          <Radar size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            No scan data yet. Click "Scan Now" to start.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map(entry => (
          <div key={entry.symbol} className="card" style={{ overflow: 'hidden' }}>
            {/* Main row */}
            <div
              className="flex items-center gap-3 p-4"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === entry.symbol ? null : entry.symbol)}
            >
              {/* Symbol */}
              <div style={{ minWidth: 64 }}>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {entry.symbol.replace('USDT', '')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>USDT</div>
              </div>

              {/* Price */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {fmtPrice(entry.price)}
                </div>
                <div style={{ fontSize: 11, color: entry.change >= 0 ? 'var(--bull)' : 'var(--bear)', fontFamily: 'var(--font-mono)' }}>
                  {fmtPct(entry.change)}
                </div>
              </div>

              {/* Regime */}
              <div className="truncate" style={{ display: 'none', flex: 1 }}>
                <RegimePill regime={entry.regime} />
              </div>

              {/* Signal */}
              <div style={{ textAlign: 'right' }}>
                <SignalBadge signal={entry.signal} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                  {(entry.confidence * 100).toFixed(0)}% conf
                </div>
              </div>

              <div style={{ color: 'var(--text-muted)' }}>
                {expanded === entry.symbol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>

            {/* Confidence bar (always visible) */}
            <div style={{ padding: '0 16px 12px' }}>
              <ConfidenceBar value={entry.confidence} size="sm" />
            </div>

            {/* Expanded detail */}
            {expanded === entry.symbol && (
              <div style={{ borderTop: '1px solid var(--bg-border)', padding: 16 }}>
                {/* Regime + indicators row */}
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <RegimePill regime={entry.regime} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ATR: {(entry.volatility * 100).toFixed(2)}% | Vol conf: {(entry.regime_conf * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Component scores */}
                {Object.keys(entry.components).length > 0 && (
                  <div className="mb-4">
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Rincian Skor
                    </div>
                    <div className="grid-2 gap-2">
                      {Object.entries(entry.components).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{k}</span>
                          </div>
                          <ConfidenceBar value={v} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key indicators */}
                {entry.indicators['1h'] && (
                  <div className="mb-4">
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                      1H Indicators
                    </div>
                    <div className="grid-4 gap-2">
                      {[
                        { k: 'RSI', v: entry.indicators['1h']?.rsi?.toFixed(1) },
                        { k: 'ADX', v: entry.indicators['1h']?.adx?.toFixed(1) },
                        { k: 'MACD', v: entry.indicators['1h']?.macd_hist?.toFixed(4) },
                        { k: 'ATR%', v: ((entry.indicators['1h']?.atr_pct || 0) * 100).toFixed(2) + '%' },
                      ].filter(i => i.v && i.v !== 'undefined').map(({ k, v }) => (
                        <div key={k} style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', border: '1px solid var(--bg-border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{k}</div>
                          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, marginTop: 1 }}>{v || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Factors */}
                <div className="grid-2 gap-3">
                  {entry.bullish.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--bull)', fontFamily: 'var(--font-mono)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        ✅ Faktor Bullish (Mendukung Naik)
                      </div>
                      {entry.bullish.slice(0, 4).map((f: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '3px 0', borderBottom: '1px solid var(--bg-border)', fontFamily: 'var(--font-mono)' }}>
                          {f}
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.bearish.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--bear)', fontFamily: 'var(--font-mono)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        ⚠️ Faktor Bearish (Mendukung Turun)
                      </div>
                      {entry.bearish.slice(0, 4).map((f: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '3px 0', borderBottom: '1px solid var(--bg-border)', fontFamily: 'var(--font-mono)' }}>
                          {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
