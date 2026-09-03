// src/components/scanner/ScannerPage.tsx
import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  SectionHeader, SignalBadge, ConfidenceBar, RegimePill, fmtPrice, fmtPct
} from '../shared'
import {
  Radar, RefreshCw, Zap, Search, Filter, ArrowUpDown,
  TrendingUp, TrendingDown, Layers, Shield, Eye, CheckCircle2,
  AlertCircle, Sparkles, BarChart2
} from 'lucide-react'

export default function ScannerPage() {
  const { scanResults, scanner, triggerScan, refresh, loading } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'short' | 'bullish' | 'high_conf'>('all')
  const [category, setCategory] = useState<'all' | 'majors' | 'memes' | 'altcoins'>('all')
  const [selectedSymbol, setSelectedSymbol] = useState<any | null>(null)

  const MEME_SYMBOLS = ['PEPEUSDT', 'SHIBUSDT', 'DOGEUSDT', 'BONKUSDT', 'FLOKIUSDT']
  const MAJOR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

  const items = Object.entries(scanResults || {}).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    signal: r?.score?.signal || 'WAIT',
    confidence: Number(r?.score?.confidence || 0),
    price: Number(r?.price || 0),
    change: Number(r?.price_change_24h || 0),
    regime: r?.regime?.regime || 'unknown',
    components: r?.score?.components || {},
    bullish_factors: r?.score?.bullish_factors || [],
    bearish_factors: r?.score?.bearish_factors || [],
    reasoning: r?.score?.reasoning || '',
    indicators: r?.indicators || {},
    ai_verdict: r?.score?.ai_verdict || 'APPROVE',
  })).filter(i => i.price > 0)

  // Filter and search
  const filtered = items.filter(item => {
    const matchSearch = item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false

    // Category filter
    if (category === 'majors' && !MAJOR_SYMBOLS.includes(item.symbol)) return false
    if (category === 'memes' && !MEME_SYMBOLS.includes(item.symbol)) return false
    if (category === 'altcoins' && (MAJOR_SYMBOLS.includes(item.symbol) || MEME_SYMBOLS.includes(item.symbol))) return false

    // Signal/Condition filter
    if (filterType === 'buy') return item.signal.includes('BUY')
    if (filterType === 'short') return item.signal === 'SHORT'
    if (filterType === 'bullish') return item.regime.includes('trending_up') || item.regime.includes('expansion')
    if (filterType === 'high_conf') return item.confidence >= 0.68
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Search & Category Filter Bar */}
      <div className="card p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px]" style={{ background: 'var(--bg-deep)', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
            <Search size={12} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari simbol pair (misal: BTC, SOL, PEPE)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 11, width: '100%', outline: 'none' }}
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1 bg-deep p-0.5 rounded border border-border overflow-x-auto">
            {[
              { id: 'all', label: 'Semua Koin' },
              { id: 'majors', label: 'Majors' },
              { id: 'memes', label: 'Memes' },
              { id: 'altcoins', label: 'Altcoins' },
            ].map(c => (
              <button
                key={c.id}
                className={`btn btn-xs ${category === c.id ? 'btn-lime' : 'btn-ghost'}`}
                onClick={() => setCategory(c.id as any)}
                style={{ padding: '2px 7px', fontSize: 9 }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Trigger Scan Button */}
          <button className="btn btn-lime btn-xs" onClick={triggerScan} disabled={loading} style={{ padding: '4px 10px', fontSize: 10 }}>
            <Zap size={10} /> Scan
          </button>
        </div>

        {/* Quick Signal Filters */}
        <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-border overflow-x-auto">
          {[
            { id: 'all', label: `Semua (${items.length})` },
            { id: 'buy', label: 'Sinyal BUY' },
            { id: 'short', label: 'Sinyal SHORT' },
            { id: 'bullish', label: 'Rezim Bullish' },
            { id: 'high_conf', label: 'Lolos AI (≥68%)' },
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-xs ${filterType === f.id ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setFilterType(f.id as any)}
              style={{ padding: '2px 7px', fontSize: 9.5 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Radar Matrix Table */}
      <div className="card p-3">
        <SectionHeader title={`Radar Kuantitatif 8 Pilar (${filtered.length})`} subtitle="Evaluasi indikator teknikal & validasi model AI Qwen 27B" />

        <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Pair</th>
                <th style={{ padding: '6px 4px' }}>Harga</th>
                <th style={{ padding: '6px 4px' }}>24h %</th>
                <th style={{ padding: '6px 4px' }}>Rezim</th>
                <th style={{ padding: '6px 4px' }}>Skor 8 Pilar</th>
                <th style={{ padding: '6px 4px' }}>Sinyal</th>
                <th style={{ padding: '6px 4px' }}>Status AI</th>
                <th style={{ padding: '6px 4px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    Tidak ada koin yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => {
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--bg-border)',
                        height: 38,
                        background: item.confidence >= 0.68 ? 'rgba(163,230,53,0.02)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '6px 4px', fontWeight: 800 }}>
                        <span style={{ color: item.symbol.includes('BTC') ? '#00F0FF' : 'var(--text-primary)' }}>
                          {item.symbol}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', fontWeight: 600 }}>${fmtPrice(item.price)}</td>
                      <td style={{ padding: '6px 4px', color: item.change >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <RegimePill regime={item.regime} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 40, height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(item.confidence * 100, 100)}%`,
                                height: '100%',
                                background: item.confidence >= 0.68 ? 'var(--bull)' : item.confidence <= 0.22 ? 'var(--bear)' : 'var(--warn)'
                              }}
                            />
                          </div>
                          <span className="font-bold" style={{ color: item.confidence >= 0.68 ? 'var(--bull)' : 'var(--text-primary)' }}>
                            {(item.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <SignalBadge signal={item.signal} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        {item.confidence >= 0.68 ? (
                          <span className="badge badge-lime" style={{ fontSize: 7.5 }}>
                            ✓ AI APPROVED
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontSize: 7.5 }}>
                            WAIT / HOLD
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSelectedSymbol(item)}
                          style={{ padding: '2px 5px', fontSize: 8.5, display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          <Eye size={9} /> Rincian
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Pillar Modal Drawer */}
      {selectedSymbol && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => setSelectedSymbol(null)}
        >
          <div
            className="card p-3.5"
            style={{ maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2.5 border-b border-border pb-2">
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800 }}>Rincian 8 Pilar: {selectedSymbol.symbol}</h3>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Harga: ${fmtPrice(selectedSymbol.price)} · Rezim: {selectedSymbol.regime.toUpperCase()}
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setSelectedSymbol(null)}>✕</button>
            </div>

            {/* 8 Pillars Breakdown */}
            <div className="flex flex-col gap-1.5 mb-2.5">
              <SectionHeader title="Matriks Bobot 8 Komponen" subtitle="Kontribusi masing-masing pilar terhadap skor akhir" />
              {Object.entries(selectedSymbol.components || {}).map(([k, v]: [string, any], idx) => (
                <div key={idx} className="flex justify-between items-center p-1.5 rounded bg-deep border border-border" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{k.replace('_', ' ')}</span>
                  <span className="font-bold" style={{ color: Number(v) >= 0.68 ? 'var(--bull)' : 'var(--text-primary)' }}>
                    {(Number(v) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Factors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="p-2 rounded bg-deep border border-border">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bull)', marginBottom: 3 }}>Faktor Bullish:</div>
                <ul style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', paddingLeft: 10 }}>
                  {selectedSymbol.bullish_factors.length > 0
                    ? selectedSymbol.bullish_factors.map((f: string, i: number) => <li key={i}>{f}</li>)
                    : <li>Tidak ada faktor signifikan</li>
                  }
                </ul>
              </div>

              <div className="p-2 rounded bg-deep border border-border">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bear)', marginBottom: 3 }}>Faktor Bearish:</div>
                <ul style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', paddingLeft: 10 }}>
                  {selectedSymbol.bearish_factors.length > 0
                    ? selectedSymbol.bearish_factors.map((f: string, i: number) => <li key={i}>{f}</li>)
                    : <li>Tidak ada faktor signifikan</li>
                  }
                </ul>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-lime btn-xs" onClick={() => setSelectedSymbol(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
