// src/components/settings/SettingsPage.tsx
import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader } from '../shared'
import {
  Settings, Key, Shield, Sliders, ToggleLeft, ToggleRight,
  Save, CheckCircle2, AlertTriangle, RefreshCw, Zap, Globe
} from 'lucide-react'

export default function SettingsPage() {
  const { system, risk, scanner, switchTradingMode, control, refresh, loading } = useStore()

  const [currentMode, setCurrentMode] = useState(system?.mode || 'testnet')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [symbolsText, setSymbolsText] = useState((scanner?.symbols || []).join(', '))
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // Risk parameters state
  const [riskPerTrade, setRiskPerTrade] = useState(2.0)
  const [portfolioHeat, setPortfolioHeat] = useState(6.0)
  const [maxDrawdown, setMaxDrawdown] = useState(15.0)

  const handleSaveMode = async (mode: string) => {
    setCurrentMode(mode)
    setSaveStatus('Menyimpan mode...')
    try {
      await switchTradingMode(mode, apiKey || undefined, secretKey || undefined)
      setSaveStatus('Mode berhasil diaktifkan!')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setSaveStatus(`Gagal: ${e.message}`)
    }
  }

  const handleSaveSymbols = async () => {
    const list = symbolsText.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => s.length > 3)
    setSaveStatus('Menyimpan daftar koin...')
    try {
      await control('update_symbols', { symbols: list })
      setSaveStatus('Daftar koin berhasil diperbarui!')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setSaveStatus(`Gagal: ${e.message}`)
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={18} style={{ color: 'var(--accent)' }} /> Pengaturan & Konfigurasi Mesin
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Kontrol Mode Trading · Manajemen Kunci API · Konfigurasi Risiko & Watchlist
          </p>
        </div>
        {saveStatus && (
          <span className="badge badge-lime" style={{ fontSize: 10 }}>{saveStatus}</span>
        )}
      </div>

      {/* Mode Selection Cards */}
      <div className="card p-3 mb-3">
        <SectionHeader title="Mode Operasi Trading" subtitle="Pilih lingkungan eksekusi pesanan bot" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
          {[
            {
              id: 'paper',
              title: '🟢 Paper Trading',
              badge: 'SIMULASI',
              desc: 'Simulasi tanpa API key, harga Binance real-time, saldo virtual $1,000.',
              color: 'var(--bull)'
            },
            {
              id: 'testnet',
              title: '🔵 Binance Testnet',
              badge: 'HMAC TESTNET',
              desc: 'Eksekusi order nyata di Binance Testnet resmi dengan saldo virtual $10,000 USDT.',
              color: '#00f0ff'
            },
            {
              id: 'live',
              title: '🔴 Binance Mainnet Live',
              badge: 'REAL FUNDS',
              desc: 'Eksekusi langsung ke bursa Binance asli menggunakan dana sungguhan Anda.',
              color: 'var(--bear)'
            },
          ].map(m => {
            const isSelected = (system?.mode || 'testnet') === m.id
            return (
              <div
                key={m.id}
                className="p-3 cursor-pointer transition-all"
                style={{
                  background: isSelected ? 'var(--bg-card2)' : 'var(--bg-deep)',
                  border: isSelected ? `1px solid ${m.color}` : '1px solid var(--bg-border)',
                  borderRadius: 6,
                }}
                onClick={() => handleSaveMode(m.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}>{m.title}</span>
                  {isSelected && <span className="badge badge-lime" style={{ fontSize: 9 }}>AKTIF</span>}
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                  {m.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* API Key Management */}
      <div className="card p-3 mb-3">
        <SectionHeader title="Kredensial API Binance" subtitle="API Key & Secret Key untuk otentikasi pesanan HMAC-SHA256" />
        <div className="flex flex-col gap-2.5 mt-2">
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              BINANCE API KEY
            </label>
            <input
              type="text"
              className="w-full p-2 rounded-md font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11 }}
              placeholder="H73PTh2NkHGdFaf48uZwG8pgknQTQTzejxHaTOZIZyCdNusY06cSg8gTnqbduNEV"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              BINANCE SECRET KEY
            </label>
            <input
              type="password"
              className="w-full p-2 rounded-md font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11 }}
              placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
            />
          </div>

          <div className="flex justify-end mt-1">
            <button
              className="btn btn-lime btn-sm"
              onClick={() => handleSaveMode(currentMode)}
              disabled={loading}
              style={{ padding: '4px 12px', fontSize: 11 }}
            >
              <Save size={12} /> Simpan Kredensial
            </button>
          </div>
        </div>
      </div>

      {/* Coin Watchlist Management */}
      <div className="card p-3 mb-3">
        <SectionHeader title="Daftar Koin yang Dipindai (Watchlist)" subtitle="Pisahkan dengan tanda koma (misal: BTCUSDT, ETHUSDT, SOLUSDT, NEARUSDT, AVAXUSDT)" />
        <div className="mt-2">
          <textarea
            rows={3}
            className="w-full p-2 rounded-md font-mono"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11, resize: 'vertical' }}
            value={symbolsText}
            onChange={e => setSymbolsText(e.target.value)}
          />
          <div className="flex justify-between items-center mt-2">
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Total: {symbolsText.split(',').filter((s: string) => s.trim().length > 3).length} simbol aktif
            </span>
            <button
              className="btn btn-lime btn-sm"
              onClick={handleSaveSymbols}
              disabled={loading}
              style={{ padding: '4px 12px', fontSize: 11 }}
            >
              <Save size={12} /> Perbarui Watchlist
            </button>
          </div>
        </div>
      </div>

      {/* Risk Management Sliders */}
      <div className="card p-3">
        <SectionHeader title="Batas & Parameter Manajemen Risiko" subtitle="Perlindungan modal otomatis ATR dan batas drawdown" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
          <div>
            <div className="flex justify-between items-center mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Maks Risiko per Trade</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{riskPerTrade.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={riskPerTrade}
              onChange={e => setRiskPerTrade(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Maksimal Heat Portofolio</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{portfolioHeat.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="15.0"
              step="0.5"
              value={portfolioHeat}
              onChange={e => setPortfolioHeat(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Batas Max Drawdown</span>
              <span style={{ fontWeight: 700, color: 'var(--bear)' }}>{maxDrawdown.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="25.0"
              step="1.0"
              value={maxDrawdown}
              onChange={e => setMaxDrawdown(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--bear)' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
