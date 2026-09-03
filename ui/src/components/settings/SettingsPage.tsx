// src/components/settings/SettingsPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, fmtPct } from '../shared'
import {
  Settings, Key, Shield, Sliders, ToggleLeft, ToggleRight,
  Save, CheckCircle2, AlertTriangle, RefreshCw, Zap, Globe,
  Layers, Brain, Clock, Code, TrendingUp, Target, Database,
  Lock, Unlock, ShieldCheck, Coins
} from 'lucide-react'
import { api, getAdminToken, setAdminToken } from '../../utils/api'

export default function SettingsPage() {
  const { system, risk, scanner, switchTradingMode, control, refresh, loading } = useStore()

  const [activeTab, setActiveTab] = useState<'mode' | 'risk' | 'strategy' | 'watchlist' | 'raw'>('mode')
  const [config, setConfig] = useState<any>(null)
  const [rawTradingJSON, setRawTradingJSON] = useState('')
  const [rawAppJSON, setRawAppJSON] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // Master Token Security state
  const [adminToken, setAdminTokenInput] = useState(getAdminToken())
  const [isAuthVerified, setIsAuthVerified] = useState(false)
  const [authChecking, setAuthChecking] = useState(false)

  // Mode state
  const [currentMode, setCurrentMode] = useState(system?.mode || 'testnet')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [symbolsText, setSymbolsText] = useState((scanner?.symbols || []).join(', '))

  useEffect(() => {
    checkTokenAuth(adminToken)
    api.getConfig().then(cfg => {
      if (cfg) {
        setConfig(cfg)
        setRawTradingJSON(JSON.stringify(cfg.trading || {}, null, 2))
        setRawAppJSON(JSON.stringify(cfg.app || {}, null, 2))
      }
    }).catch(() => null)
  }, [])

  const checkTokenAuth = async (t: string) => {
    setAuthChecking(true)
    try {
      await api.verifyAdminToken(t)
      setIsAuthVerified(true)
      setAdminToken(t)
    } catch {
      setIsAuthVerified(false)
    } finally {
      setAuthChecking(false)
    }
  }

  const handleSaveAdminToken = async () => {
    setSaveStatus('Memverifikasi Master Token...')
    try {
      await api.verifyAdminToken(adminToken)
      setIsAuthVerified(true)
      setAdminToken(adminToken)
      setSaveStatus('🔒 Master Token Valid!')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setIsAuthVerified(false)
      setSaveStatus(`❌ Token Salah: ${e.message}`)
    }
  }

  const handleSaveMode = async (mode: string) => {
    setCurrentMode(mode)
    setSaveStatus('Menyimpan mode...')
    try {
      await switchTradingMode(mode, apiKey || undefined, secretKey || undefined)
      setSaveStatus('✅ Mode berhasil diaktifkan!')
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
      setSaveStatus('✅ Daftar koin berhasil diperbarui!')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setSaveStatus(`Gagal: ${e.message}`)
    }
  }

  const handleSaveRawConfig = async (configName: 'trading' | 'app') => {
    setSaveStatus(`Menyimpan ${configName}.json...`)
    try {
      const data = JSON.parse(configName === 'trading' ? rawTradingJSON : rawAppJSON)
      await api.updateConfig(configName, data)
      setSaveStatus(`✅ ${configName}.json berhasil disimpan!`)
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setSaveStatus(`Format JSON Salah: ${e.message}`)
    }
  }

  const tCfg = config?.trading || {}

  return (
    <div className="flex flex-col gap-3">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={16} style={{ color: 'var(--accent)' }} /> Pusat Konfigurasi & Keamanan Sistem
          </h2>
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Master Token Guard · Batas Risiko (15% Max DD) · Kredensial Binance Mainnet
          </p>
        </div>
        {saveStatus && (
          <span className="badge badge-lime" style={{ fontSize: 9.5 }}>{saveStatus}</span>
        )}
      </div>

      {/* MASTER SECURITY GUARD LOCK */}
      <div className={`card ${isAuthVerified ? 'card-lime' : ''} p-2.5`} style={{ borderColor: isAuthVerified ? 'rgba(163, 230, 53, 0.35)' : 'var(--warn)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isAuthVerified ? (
              <ShieldCheck size={16} style={{ color: 'var(--bull)' }} />
            ) : (
              <Lock size={16} style={{ color: 'var(--warn)' }} />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  MASTER ADMIN TOKEN GUARD
                </span>
                <span className={`badge ${isAuthVerified ? 'badge-bull' : 'badge-warn'}`} style={{ fontSize: 8 }}>
                  {isAuthVerified ? '🔒 TEROTENTIKASI (AKSES PENUH)' : '⚠️ TERKUNCI (READ ONLY)'}
                </span>
              </div>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Diperlukan untuk otentikasi eksekusi order, pergantian mode, dan modifikasi parameter.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <input
              type="password"
              className="p-1 rounded font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11, minWidth: 180 }}
              placeholder="Master Token Admin..."
              value={adminToken}
              onChange={e => setAdminTokenInput(e.target.value)}
            />
            <button
              className="btn btn-lime btn-xs"
              onClick={handleSaveAdminToken}
              disabled={authChecking}
              style={{ fontSize: 9.5, padding: '3px 8px' }}
            >
              {authChecking ? 'Memeriksa...' : 'Buka Kunci'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
        {[
          { id: 'mode', label: '1. Mode & Kunci API', icon: Key },
          { id: 'risk', label: '2. Manajemen Risiko (15% Limit)', icon: Shield },
          { id: 'strategy', label: '3. TP1, Trailing & BTC Vault', icon: TrendingUp },
          { id: 'watchlist', label: '4. Watchlist Koin', icon: Layers },
          { id: 'raw', label: '5. Editor JSON Mentah', icon: Code },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              className={`btn btn-xs ${isActive ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{ padding: '3px 8px', fontSize: 9.5, whiteSpace: 'nowrap' }}
            >
              <Icon size={10} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Mode & API Keys */}
      {activeTab === 'mode' && (
        <div className="flex flex-col gap-3">
          <div className="card p-3">
            <SectionHeader title="Mode Operasi Trading" subtitle="Pilih lingkungan eksekusi pesanan bot" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
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
                  desc: 'Eksekusi order nyata di Binance Testnet dengan saldo virtual.',
                  color: '#00f0ff'
                },
                {
                  id: 'live',
                  title: '🔴 Binance Mainnet Live',
                  badge: 'REAL FUNDS',
                  desc: 'Eksekusi langsung ke bursa Binance asli menggunakan saldo riil Anda.',
                  color: 'var(--bear)'
                },
              ].map(m => {
                const isSelected = (system?.mode || 'testnet') === m.id
                return (
                  <div
                    key={m.id}
                    className="p-2.5 cursor-pointer transition-all rounded"
                    style={{
                      background: isSelected ? 'var(--bg-card2)' : 'var(--bg-deep)',
                      border: isSelected ? `1px solid ${m.color}` : '1px solid var(--bg-border)',
                    }}
                    onClick={() => handleSaveMode(m.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{m.title}</span>
                      {isSelected && <span className="badge badge-lime" style={{ fontSize: 8 }}>AKTIF</span>}
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.35 }}>
                      {m.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-3">
            <SectionHeader title="Kredensial API Binance" subtitle="Kunci HMAC-SHA256 untuk eksekusi pesanan" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
              <div>
                <label style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Binance API Key:</label>
                <input
                  type="password"
                  placeholder="Gg5X••••••••••••••••duzA"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full p-2 rounded mt-1 mono"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Binance Secret Key:</label>
                <input
                  type="password"
                  placeholder="72uy••••••••••••••••Tuwp"
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  className="w-full p-2 rounded mt-1 mono"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11 }}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn btn-lime btn-xs" onClick={() => handleSaveMode(currentMode)} disabled={!isAuthVerified}>
                Simpan & Sinkron Kunci API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Risk Parameters */}
      {activeTab === 'risk' && (
        <div className="card p-3">
          <SectionHeader title="Batas Manajemen Risiko & Failsafe" subtitle="Parameter proteksi modal ketat" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div className="p-2 rounded bg-deep border border-border">
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MAX DRAWDOWN</div>
              <div className="mono font-bold" style={{ fontSize: 14, color: 'var(--bear)', marginTop: 2 }}>15.0%</div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>Pemicu auto kill-switch</div>
            </div>
            <div className="p-2 rounded bg-deep border border-border">
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>RISK PER TRADE</div>
              <div className="mono font-bold" style={{ fontSize: 14, color: 'var(--warn)', marginTop: 2 }}>2.0%</div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>Batas risiko saldo</div>
            </div>
            <div className="p-2 rounded bg-deep border border-border">
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MAX COIN EXPOSURE</div>
              <div className="mono font-bold" style={{ fontSize: 14, color: 'var(--accent)', marginTop: 2 }}>25.0%</div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>Plafon 1 koin</div>
            </div>
            <div className="p-2 rounded bg-deep border border-border">
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LOSS STREAK COOLDOWN</div>
              <div className="mono font-bold" style={{ fontSize: 14, color: 'var(--bull)', marginTop: 2 }}>3 Trades</div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>Jeda trading otomatis</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Strategy & TP/SL Parameters */}
      {activeTab === 'strategy' && (
        <div className="card p-3">
          <SectionHeader title="Strategi TP1, Trailing & Akumulasi BTC" subtitle="Konfigurasi logika posisi tp_modal_trailing_v1" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bull)' }}>TP1 (Break-Even + Fee):</div>
              <div className="mono font-bold" style={{ fontSize: 13, marginTop: 2 }}>40% Porsi @ +0.3% Buffer</div>
              <p style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Tutup 40% posisi segera di titik impas + fee, lalu geser SL sisa ke BEP.
              </p>
            </div>

            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--warn)' }}>60% Runner Trailing Stop:</div>
              <div className="mono font-bold" style={{ fontSize: 13, marginTop: 2 }}>2.5% Trend / 1.2% Range</div>
              <p style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Trailing stop dinamis mengikuti pergerakan tertinggi rezim pasar.
              </p>
            </div>

            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#00F0FF' }}>BTC Treasury Vault Accumulator:</div>
              <div className="mono font-bold" style={{ fontSize: 13, marginTop: 2 }}>70% Realized Profit</div>
              <p style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                70% profit bersih USDT trade langsung dibelikan BTC Spot fisik.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Watchlist Koin */}
      {activeTab === 'watchlist' && (
        <div className="card p-3">
          <SectionHeader title="Watchlist Simbol Koin" subtitle="Daftar pasangan koin yang dipindai setiap 60 detik" />
          <textarea
            rows={3}
            value={symbolsText}
            onChange={e => setSymbolsText(e.target.value)}
            className="w-full p-2 rounded mt-2 mono"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11 }}
          />
          <div className="mt-2 flex justify-end">
            <button className="btn btn-lime btn-xs" onClick={handleSaveSymbols} disabled={!isAuthVerified}>
              Simpan Watchlist
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: Raw JSON */}
      {activeTab === 'raw' && (
        <div className="card p-3">
          <SectionHeader title="Editor Konfigurasi JSON Mentah" subtitle="trading.json & app.json" />
          <textarea
            rows={10}
            value={rawTradingJSON}
            onChange={e => setRawTradingJSON(e.target.value)}
            className="w-full p-2 rounded mt-2 mono"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 10 }}
          />
          <div className="mt-2 flex justify-end">
            <button className="btn btn-lime btn-xs" onClick={() => handleSaveRawConfig('trading')} disabled={!isAuthVerified}>
              Simpan trading.json
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
