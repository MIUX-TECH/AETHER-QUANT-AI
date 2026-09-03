// src/components/settings/SettingsPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, fmtPct } from '../shared'
import {
  Settings, Key, Shield, Sliders, ToggleLeft, ToggleRight,
  Save, CheckCircle2, AlertTriangle, RefreshCw, Zap, Globe,
  Layers, Brain, Clock, Code, TrendingUp, Target, Database,
  Lock, Unlock, ShieldCheck
} from 'lucide-react'
import { api, getAdminToken, setAdminToken } from '../../utils/api'

export default function SettingsPage() {
  const { system, risk, scanner, switchTradingMode, control, refresh, loading } = useStore()

  const [activeTab, setActiveTab] = useState<'mode' | 'risk' | 'scoring' | 'strategy' | 'indicators' | 'scheduler' | 'watchlist' | 'raw'>('mode')
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

  // Load backend configurations & verify token
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
      setSaveStatus('🔒 Master Token Valid & Tersimpan!')
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

  const handleSaveRawConfig = async (configName: 'trading' | 'app') => {
    setSaveStatus(`Menyimpan ${configName}.json...`)
    try {
      const data = JSON.parse(configName === 'trading' ? rawTradingJSON : rawAppJSON)
      await api.updateConfig(configName, data)
      setSaveStatus(`${configName}.json berhasil disimpan!`)
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (e: any) {
      setSaveStatus(`Format JSON Salah: ${e.message}`)
    }
  }

  const tCfg = config?.trading || {}
  const aCfg = config?.app || {}

  return (
    <div className="page">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={17} style={{ color: 'var(--accent)' }} /> Pusat Konfigurasi & Keamanan Sistem
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Master Token Guard · Manajemen Risiko (Auto-Kill 3%) · Kredensial Binance Mainnet
          </p>
        </div>
        {saveStatus && (
          <span className="badge badge-lime" style={{ fontSize: 10 }}>{saveStatus}</span>
        )}
      </div>

      {/* MASTER SECURITY GUARD LOCK */}
      <div className={`card ${isAuthVerified ? 'card-lime' : ''} p-2.5 mb-3`} style={{ borderColor: isAuthVerified ? 'rgba(163, 230, 53, 0.35)' : 'var(--warn)' }}>
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
                  {isAuthVerified ? '🔒 TEROTENTIKASI (AKSES PENUH)' : '⚠️ TERKUNCI (HANYA BACA)'}
                </span>
              </div>
              <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Token rahasia untuk otentikasi eksekusi order, pergantian mode, dan modifikasi parameter trading.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <input
              type="password"
              className="p-1.5 rounded font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 11, minWidth: 200 }}
              placeholder="Masukkan Master Token Admin..."
              value={adminToken}
              onChange={e => setAdminTokenInput(e.target.value)}
            />
            <button
              className="btn btn-lime btn-xs"
              onClick={handleSaveAdminToken}
              disabled={authChecking}
              style={{ fontSize: 10, padding: '4px 10px' }}
            >
              {authChecking ? 'Memeriksa...' : 'Buka Kunci'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1.5 border-b border-border">
        {[
          { id: 'mode', label: '1. Mode & Kunci API', icon: Key },
          { id: 'risk', label: '2. Manajemen Risiko (3% Limit)', icon: Shield },
          { id: 'scoring', label: '3. Bobot Skoring & Ambang', icon: Target },
          { id: 'strategy', label: '4. Parameter Spot & Futures', icon: TrendingUp },
          { id: 'indicators', label: '5. Indikator & Regime', icon: Sliders },
          { id: 'scheduler', label: '6. Penjadwal Engine', icon: Clock },
          { id: 'watchlist', label: '7. Watchlist Koin', icon: Layers },
          { id: 'raw', label: '8. Editor JSON Lengkap', icon: Code },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              className={`btn btn-sm ${isActive ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{ padding: '4px 10px', fontSize: 10, whiteSpace: 'nowrap' }}
            >
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Mode & API Keys */}
      {activeTab === 'mode' && (
        <div className="flex flex-col gap-3">
          <div className="card p-3">
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

          <div className="card p-3">
            <SectionHeader title="Kredensial API Binance" subtitle="API Key & Secret Key untuk otentikasi pesanan HMAC-SHA256" />
            <div className="flex flex-col gap-2 mt-2">
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
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
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
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
                <button className="btn btn-lime btn-sm" onClick={() => handleSaveMode(currentMode)} disabled={loading} style={{ padding: '4px 12px', fontSize: 11 }}>
                  <Save size={12} /> Simpan Kredensial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Risk Management */}
      {activeTab === 'risk' && (
        <div className="card p-3">
          <SectionHeader title="Aturan & Batas Manajemen Risiko" subtitle="Parameter proteksi modal dan pembatasan eksposur matematis" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
            {[
              { label: 'Batas Risiko Maks per Trade', val: `${(Number(tCfg.risk?.max_risk_per_trade_pct || 0.02) * 100).toFixed(1)}%`, desc: 'Batas kerugian maksimal per posisi' },
              { label: 'Batas Eksposur Portofolio', val: `${(Number(tCfg.risk?.max_portfolio_exposure_pct || 0.85) * 100).toFixed(0)}%`, desc: 'Maks total modal dalam pasar' },
              { label: 'Batas Eksposur per Koin', val: `${(Number(tCfg.risk?.max_exposure_per_coin_pct || 0.25) * 100).toFixed(0)}%`, desc: 'Diversifikasi batas per aset tunggal' },
              { label: 'Batas Kerugian Harian', val: `${(Number(tCfg.risk?.max_daily_loss_pct || 0.05) * 100).toFixed(1)}%`, desc: 'Daily stop-loss limit' },
              { label: 'Batas Maksimum Drawdown', val: `${(Number(tCfg.risk?.max_drawdown_pct || 0.15) * 100).toFixed(0)}%`, desc: 'Batas penurunan modal dari puncak (15%)' },
              { label: 'Cooldown Loss Streak', val: `${tCfg.risk?.cooldown_after_loss_streak || 3}x Trade`, desc: 'Pemicu jeda setelah kerugian beruntun' },
              { label: 'Durasi Cooldown', val: `${tCfg.risk?.cooldown_duration_minutes || 60} Menit`, desc: 'Waktu jeda cooling-off mesin' },
              { label: 'Ambang Keyakinan Minimum Spot', val: `${(Number(tCfg.risk?.min_confidence_to_trade || 0.60) * 100).toFixed(0)}%`, desc: 'Skor minimal untuk eksekusi spot' },
              { label: 'Ambang Keyakinan Minimum Futures', val: `${(Number(tCfg.risk?.min_confidence_futures || 0.75) * 100).toFixed(0)}%`, desc: 'Skor minimal untuk eksekusi futures' },
            ].map((item, i) => (
              <div key={i} className="p-2.5 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 2 }}>{item.val}</div>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Scoring Weights */}
      {activeTab === 'scoring' && (
        <div className="flex flex-col gap-3">
          <div className="card p-3">
            <SectionHeader title="Bobot Komponen Skoring Kuantitatif" subtitle="Total penjumlahan 8 komponen bobot = 100%" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
              {Object.entries(tCfg.scoring?.weights || {
                trend: 0.20, momentum: 0.18, structure: 0.15, volume: 0.12,
                htf_alignment: 0.15, volatility: 0.08, sentiment: 0.07, risk: 0.05
              }).map(([k, v]: [string, any]) => (
                <div key={k} className="p-2 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{k.replace('_', ' ')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 2 }}>{(Number(v) * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <SectionHeader title="Ambang Batas Sinyal (Thresholds)" subtitle="Nilai skoring minimum untuk memicu aksi trading" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
              {Object.entries(tCfg.scoring?.thresholds || {
                STRONG_BUY: 0.82, BUY: 0.68, HOLD: 0.52, REDUCE: 0.42, SELL: 0.32, SHORT: 0.22
              }).map(([k, v]: [string, any]) => (
                <div key={k} className="p-2 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: k.includes('BUY') ? 'var(--bull)' : k.includes('SELL') || k.includes('SHORT') ? 'var(--bear)' : 'var(--warn)', marginTop: 2 }}>
                    ≥ {(Number(v) * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Strategy Spot & Futures */}
      {activeTab === 'strategy' && (
        <div className="flex flex-col gap-3">
          <div className="card p-3">
            <SectionHeader title="Strategi Pasar Spot (90% Alokasi)" subtitle="Take profit, stop loss, dan trailing stop" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Target Take Profit (TP)', val: `${(Number(tCfg.spot?.tp_pct || 0.05) * 100).toFixed(1)}%` },
                { label: 'Batas Stop Loss (SL)', val: `${(Number(tCfg.spot?.sl_pct || 0.03) * 100).toFixed(1)}%` },
                { label: 'Jarak Trailing Stop', val: `${(Number(tCfg.spot?.trailing_stop_pct || 0.02) * 100).toFixed(1)}%` },
                { label: 'Partial Take Profit', val: tCfg.spot?.partial_tp_enabled ? 'AKTIF (50% @ 1.5 R:R)' : 'NONAKTIF' },
                { label: 'Durasi Tahan Min / Maks', val: `${tCfg.spot?.min_hold_duration_minutes || 60}m / ${tCfg.spot?.max_hold_duration_hours || 168}h` },
              ].map((item, i) => (
                <div key={i} className="p-2 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <SectionHeader title="Strategi Pasar Futures (10% Alokasi)" subtitle="Pengaturan leverage dan margin terisolasi" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Leverage Bawaan / Maksimal', val: `${tCfg.futures?.default_leverage || 3}x (Maks ${tCfg.futures?.max_leverage || 10}x)` },
                { label: 'Tipe Margin', val: (tCfg.futures?.margin_mode || 'ISOLATED').toUpperCase() },
                { label: 'Maks Posisi Serentak', val: `${tCfg.futures?.max_concurrent_positions || 2} Posisi` },
                { label: 'Futures TP / SL / Trailing', val: `TP 6.0% | SL 2.5% | Trailing 1.5%` },
                { label: 'Jarak Likuidasi Min', val: '≥ 30% Aman' },
              ].map((item, i) => (
                <div key={i} className="p-2 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Indicators & Regime */}
      {activeTab === 'indicators' && (
        <div className="card p-3">
          <SectionHeader title="Konfigurasi Indikator & Deteksi Regime Pasar" subtitle="Parameter Moving Average, RSI, MACD, ADX, dan Bollinger Bands" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            {[
              { label: 'EMA Cepat / Lambat / Tren / Makro', val: `${tCfg.indicators?.ema_fast || 9} / ${tCfg.indicators?.ema_slow || 21} / ${tCfg.indicators?.ema_trend || 50} / ${tCfg.indicators?.ema_macro || 200}` },
              { label: 'Periode RSI (Overbought/Oversold)', val: `${tCfg.indicators?.rsi_period || 14} (${tCfg.indicators?.rsi_overbought || 70} / ${tCfg.indicators?.rsi_oversold || 30})` },
              { label: 'MACD (Fast / Slow / Signal)', val: `${tCfg.indicators?.macd_fast || 12} / ${tCfg.indicators?.macd_slow || 26} / ${tCfg.indicators?.macd_signal || 9}` },
              { label: 'ADX Trend Threshold', val: `ADX ${tCfg.indicators?.adx_trend_threshold || 25} (Periode ${tCfg.indicators?.adx_period || 14})` },
              { label: 'Bollinger Bands', val: `Periode ${tCfg.indicators?.bb_period || 20} (Std ${tCfg.indicators?.bb_std || 2})` },
              { label: 'Ambang Panic & Euphoria', val: `Panic: -${(Number(tCfg.regime?.panic_drop_pct_1h || 0.04) * 100).toFixed(0)}%/1h | Euphoria: RSI ${tCfg.regime?.euphoria_rsi_min || 78}` },
            ].map((item, i) => (
              <div key={i} className="p-2.5 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 2 }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Scheduler */}
      {activeTab === 'scheduler' && (
        <div className="card p-3">
          <SectionHeader title="Frekuensi & Penjadwal Tugas Engine" subtitle="Interval eksekusi otomatis background scheduler" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
            {[
              { label: 'Pemindaian Pasar (Scan)', val: `${aCfg.scheduler?.scan_interval || 60} Detik` },
              { label: 'Pengecekan Rebalancing', val: `${aCfg.scheduler?.rebalance_interval || 3600} Detik (1 Jam)` },
              { label: 'Laporan Kinerja Harian', val: `${aCfg.scheduler?.report_interval || 86400} Detik (24 Jam)` },
              { label: 'Pembaruan Memori Adaptif', val: `${aCfg.scheduler?.learning_update_interval || 1800} Detik (30 Menit)` },
              { label: 'Refresh Berita Sentimen', val: `${aCfg.scheduler?.news_refresh_interval || 300} Detik (5 Menit)` },
            ].map((item, i) => (
              <div key={i} className="p-2.5 rounded-md" style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: Watchlist */}
      {activeTab === 'watchlist' && (
        <div className="card p-3">
          <SectionHeader title="Daftar Simbol Koin yang Dipindai (Watchlist)" subtitle="Pisahkan dengan tanda koma (misal: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT, NEARUSDT, AVAXUSDT)" />
          <div className="mt-2">
            <textarea
              rows={4}
              className="w-full p-2.5 rounded-md font-mono"
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
      )}

      {/* TAB 8: Advanced Raw JSON Editor */}
      {activeTab === 'raw' && (
        <div className="flex flex-col gap-3">
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="trading.json (Editor Konfigurasi Strategi)" subtitle="Ubah langsung seluruh parameter kuantitatif format JSON" />
              <button className="btn btn-lime btn-sm" onClick={() => handleSaveRawConfig('trading')} style={{ padding: '3px 10px', fontSize: 10 }}>
                <Save size={11} /> Simpan trading.json
              </button>
            </div>
            <textarea
              rows={12}
              className="w-full p-2.5 rounded-md font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--accent)', fontSize: 10, lineHeight: 1.4 }}
              value={rawTradingJSON}
              onChange={e => setRawTradingJSON(e.target.value)}
            />
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="app.json (Editor Konfigurasi Aplikasi & Penjadwal)" subtitle="Ubah konfigurasi port, timezone, dan interval cron" />
              <button className="btn btn-lime btn-sm" onClick={() => handleSaveRawConfig('app')} style={{ padding: '3px 10px', fontSize: 10 }}>
                <Save size={11} /> Simpan app.json
              </button>
            </div>
            <textarea
              rows={8}
              className="w-full p-2.5 rounded-md font-mono"
              style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--accent)', fontSize: 10, lineHeight: 1.4 }}
              value={rawAppJSON}
              onChange={e => setRawAppJSON(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
