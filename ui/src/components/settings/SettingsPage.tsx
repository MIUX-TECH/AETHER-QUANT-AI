// src/components/settings/SettingsPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, ModeBadge, fmtTime } from '../shared'
import { Settings, AlertTriangle, Shield, RefreshCw, Save, Plus, X, Zap } from 'lucide-react'
import { api } from '../../utils/api'

const MODES = ['paper', 'live', 'safe', 'analysis'] as const
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT']

export default function SettingsPage() {
  const { system, risk, scanner, scheduler, control, refreshScheduler, refresh } = useStore()
  const [config, setConfig] = useState<any>(null)
  const [tradingConfig, setTradingConfig] = useState<any>(null)
  const [symbols, setSymbols] = useState<string[]>(scanner?.symbols || DEFAULT_SYMBOLS)
  const [newSymbol, setNewSymbol] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('system')

  useEffect(() => {
    api.getConfig().then(c => {
      setConfig(c.app || {})
      setTradingConfig(c.trading || {})
    })
    refreshScheduler()
  }, [])

  useEffect(() => {
    setSymbols(scanner?.symbols || DEFAULT_SYMBOLS)
  }, [scanner?.symbols])

  const saveSymbols = async () => {
    await control('update_symbols', { symbols })
  }

  const addSymbol = () => {
    const s = newSymbol.trim().toUpperCase()
    if (s && !symbols.includes(s)) {
      setSymbols([...symbols, s])
      setNewSymbol('')
    }
  }

  const removeSymbol = (sym: string) => {
    setSymbols(symbols.filter(s => s !== sym))
  }

  const saveTradingConfig = async () => {
    setSaving(true)
    await api.updateConfig('trading', tradingConfig)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections = [
    { id: 'system', label: 'Sistem' },
    { id: 'symbols', label: 'Simbol' },
    { id: 'risk', label: 'Risiko' },
    { id: 'trading', label: 'Perdagangan' },
    { id: 'scheduler', label: 'Penjadwal' },
  ]

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Pengaturan</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Konfigurasi sistem · disimpan ke file lokal
          </p>
        </div>
        <ModeBadge mode={system?.mode || 'paper'} />
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {sections.map(s => (
          <button key={s.id} className="btn btn-ghost btn-sm"
            style={activeSection === s.id ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
            onClick={() => setActiveSection(s.id)}>{s.label}</button>
        ))}
      </div>

      {/* System section */}
      {activeSection === 'system' && (
        <div className="flex flex-col gap-4">
          {/* Kill switch */}
          <div className="card p-4" style={{ borderColor: system?.kill_switch ? 'var(--bear)' : 'var(--bg-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} style={{ color: 'var(--bear)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Sakelar Darurat</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Segera menghentikan SEMUA perdagangan. Tidak ada entri atau keluar baru.
                </p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={!!system?.kill_switch}
                  onChange={e => control('kill_switch', { value: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
            {system?.kill_switch && (
              <div className="flex items-center gap-2 mt-3 p-2" style={{ background: 'var(--bear-bg)', borderRadius: 'var(--radius-sm)' }}>
                <AlertTriangle size={12} style={{ color: 'var(--bear)' }} />
                <span style={{ fontSize: 11, color: 'var(--bear)', fontFamily: 'var(--font-mono)' }}>
                  SAKELAR DARURAT AKTIF — semua perdagangan dihentikan
                </span>
              </div>
            )}
          </div>

          {/* Safe mode */}
          <div className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} style={{ color: 'var(--warn)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Mode Aman</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Hanya pantau. Tidak ada entri baru tapi mengizinkan keluar.
                </p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={!!system?.safe_mode}
                  onChange={e => control('safe_mode', { value: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* Trading mode */}
          <div className="card p-4">
            <SectionHeader title="Mode Perdagangan" subtitle="Berlaku segera" />
            <div className="grid-2 gap-2">
              {MODES.map(m => (
                <button key={m} className={`btn btn-ghost`}
                  style={{
                    justifyContent: 'center',
                    ...(system?.mode === m ? { borderColor: 'var(--accent-lime-dim)', background: 'var(--accent-lime-glow)', color: 'var(--accent-lime)' } : {}),
                  }}
                  onClick={() => control('set_mode', { mode: m })}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>paper</strong> — Perdagangan simulasi, tidak pakai uang asli<br />
              <strong style={{ color: 'var(--text-secondary)' }}>live</strong> — Eksekusi Binance nyata (butuh API key)<br />
              <strong style={{ color: 'var(--text-secondary)' }}>safe</strong> — Hanya analisis, tidak ada eksekusi trade<br />
              <strong style={{ color: 'var(--text-secondary)' }}>analysis</strong> — Hanya pindai dan skor
            </p>
          </div>

          {/* Manual job triggers */}
          <div className="card p-4">
            <SectionHeader title="Pemicu Manual" subtitle="Jalankan tugas terjadwal sesuai permintaan" />
            <div className="grid-2 gap-2">
              {[
                { label: '⚡ Jalankan Pindai', job: 'scan' },
                { label: '⚖️ Rebalance', job: 'rebalance' },
                { label: '🧠 Update Pembelajaran', job: 'learning' },
                { label: '📊 Laporan Harian', job: 'report' },
              ].map(j => (
                <button key={j.job} className="btn btn-ghost"
                  style={{ justifyContent: 'center', fontSize: 12 }}
                  onClick={() => control('run_job', { mode: j.job })}>
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Symbols section */}
      {activeSection === 'symbols' && (
        <div className="card p-4">
          <SectionHeader title="Simbol yang Dipindai" subtitle="Simbol untuk dipindai dan ditrading" />
          <div className="flex flex-col gap-2 mb-4">
            {symbols.map(sym => (
              <div key={sym} className="flex items-center gap-2 p-2" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{sym}</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeSymbol(sym)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="Tambah simbol (contoh: BNBUSDT)" value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSymbol()} />
            <button className="btn btn-ghost" onClick={addSymbol}><Plus size={14} /></button>
          </div>
          <button className="btn btn-lime w-full" onClick={saveSymbols}>
            <Save size={12} /> Simpan Simbol
          </button>
        </div>
      )}

      {/* Risk section */}
      {activeSection === 'risk' && tradingConfig?.risk && (
        <div className="card p-4">
          <SectionHeader title="Parameter Risiko" />
          <div className="flex flex-col gap-4">
            {[
              { key: 'max_risk_per_trade_pct', label: 'Risiko Maks per Trade', pct: true },
              { key: 'max_portfolio_exposure_pct', label: 'Eksposur Portofolio Maks', pct: true },
              { key: 'max_exposure_per_coin_pct', label: 'Eksposur per Koin Maks', pct: true },
              { key: 'max_daily_loss_pct', label: 'Kerugian Harian Maks', pct: true },
              { key: 'max_drawdown_pct', label: 'Drawdown Maks', pct: true },
              { key: 'min_confidence_to_trade', label: 'Keyakinan Min (Spot)', pct: true },
              { key: 'min_confidence_futures', label: 'Keyakinan Min (Futures)', pct: true },
              { key: 'cooldown_after_loss_streak', label: 'Cooldown Setelah N Rugi', pct: false },
              { key: 'cooldown_duration_minutes', label: 'Durasi Cooldown (menit)', pct: false },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  {field.label}
                </label>
                <input type="number" className="input" step={field.pct ? 0.01 : 1}
                  value={tradingConfig.risk[field.key] ?? ''}
                  onChange={e => setTradingConfig((prev: any) => ({
                    ...prev, risk: { ...prev.risk, [field.key]: parseFloat(e.target.value) }
                  }))} />
                {field.pct && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    = {((tradingConfig.risk[field.key] || 0) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
            <button className="btn btn-lime w-full" onClick={saveTradingConfig} disabled={saving}>
              <Save size={12} /> {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan Konfigurasi Risiko'}
            </button>
          </div>
        </div>
      )}

      {/* Trading section */}
      {activeSection === 'trading' && tradingConfig?.portfolio && (
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <SectionHeader title="Alokasi Portofolio" />
            <div className="flex flex-col gap-4">
              {[
                { key: 'total_capital_usdt', label: 'Modal Total (USDT)', obj: 'portfolio' },
                { key: 'spot_allocation_pct', label: 'Alokasi Spot', obj: 'portfolio', pct: true },
                { key: 'futures_allocation_pct', label: 'Alokasi Futures', obj: 'portfolio', pct: true },
                { key: 'spot_btc_pct', label: 'BTC % dari Spot', obj: 'portfolio', pct: true },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    {field.label}
                  </label>
                  <input type="number" className="input" step={field.pct ? 0.01 : 1}
                    value={tradingConfig[field.obj]?.[field.key] ?? ''}
                    onChange={e => setTradingConfig((prev: any) => ({
                      ...prev, [field.obj]: { ...prev[field.obj], [field.key]: parseFloat(e.target.value) }
                    }))} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-lime w-full" onClick={saveTradingConfig} disabled={saving}>
            <Save size={12} /> {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan Konfigurasi Trading'}
          </button>
        </div>
      )}

      {/* Scheduler section */}
      {activeSection === 'scheduler' && (
        <div className="card p-4">
          <SectionHeader title="Status Penjadwal" action={
            <button className="btn btn-ghost btn-sm" onClick={refreshScheduler}><RefreshCw size={12} /></button>
          } />
          <div className="flex flex-col gap-2">
            {scheduler?.jobs && Object.entries(scheduler.jobs).map(([name, job]: [string, any]) => (
              <div key={name} style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--bg-border)' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      setiap {job.interval_seconds}s
                    </span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: job.enabled ? 'var(--bull)' : 'var(--text-muted)' }}>
                      {job.enabled ? '● aktif' : '○ dijeda'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 16 }}>
                  <span>Jalan: {job.run_count}</span>
                  <span>Error: {job.error_count}</span>
                  <span>Berikutnya dalam: {job.next_run_in}s</span>
                  {job.last_error && <span style={{ color: 'var(--bear)' }}>⚠ {job.last_error.slice(0, 40)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
