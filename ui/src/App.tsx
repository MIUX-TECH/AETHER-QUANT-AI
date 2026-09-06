// src/App.tsx — Main application shell with unified top header and routing
import React, { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Navigation, { TABS } from './components/shared/Navigation'
import DashboardPage from './components/dashboard/DashboardPage'
import ScannerPage from './components/scanner/ScannerPage'
import PositionsPage from './components/positions/PositionsPage'
import PortfolioPage from './components/portfolio/PortfolioPage'
import HistoryPage from './components/history/HistoryPage'
import AIDecisionsPage from './components/ai/AIDecisionsPage'
import MemoryPage from './components/memory/MemoryPage'
import { Routes, Route, Navigate, useLocation , NavLink } from 'react-router-dom'
import NewsPage from './components/ai/NewsPage'
import ReportsPage from './components/reports/ReportsPage'
import SettingsPage from './components/settings/SettingsPage'
import {
  Lock, Unlock, RefreshCw, Zap, ShieldAlert, ChevronDown,
  Coins, TrendingUp, AlertTriangle, ShieldCheck, LayoutDashboard, Wallet, ScanSearch, Settings, Menu, X, Brain } from 'lucide-react'
import { api, getAdminToken, setAdminToken } from './utils/api'

export default function App() {
  const { refresh, system, portfolio, risk, wallet, switchTradingMode, triggerScan, loading } = useStore()
  const location = useLocation()
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [tokenInput, setTokenInput] = useState(getAdminToken())
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [tokenChecking, setTokenChecking] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    refresh()
    checkAuth(getAdminToken())
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [])

  const checkAuth = async (t: string) => {
    setTokenChecking(true)
    try {
      await api.verifyAdminToken(t)
      setIsUnlocked(true)
      setAdminToken(t)
    } catch {
      setIsUnlocked(false)
    } finally {
      setTokenChecking(false)
    }
  }

  const handleSaveToken = async () => {
    setTokenChecking(true)
    try {
      await api.verifyAdminToken(tokenInput)
      setIsUnlocked(true)
      setAdminToken(tokenInput)
      setShowTokenModal(false)
    } catch (e: any) {
      alert(`Master Token Salah: ${e.message}`)
      setIsUnlocked(false)
    } finally {
      setTokenChecking(false)
    }
  }

  const totalEquity = Number(wallet?.total_equity_usd !== undefined && wallet?.total_equity_usd !== null ? wallet.total_equity_usd : (portfolio?.total_equity || 0))
  const unrealPnl = Number(portfolio?.unrealized_pnl || 0)
  const realToday = Number(portfolio?.realized_pnl_today || 0)
  const currentMode = system?.mode || wallet?.mode || 'live'

  // BTC price live from assets
  const btcPrice = Number(wallet?.assets?.find((a: any) => a.asset === 'BTC' || a.underlying === 'BTC')?.price || 0)
  const ethPrice = Number(wallet?.assets?.find((a: any) => a.asset === 'ETH' || a.underlying === 'ETH')?.price || 0)
  const solPrice = Number(wallet?.assets?.find((a: any) => a.asset === 'SOL' || a.underlying === 'SOL')?.price || 0)

  return (
    <div className="app-shell md:pb-0 pb-14">
      {/* Sidebar Navigation */}
      <Navigation />

      {/* Main Content Area */}
      <div className="main-content">
        {/* UNIFIED SINGLE TOP HEADER */}
        <header className="unified-header">
          {/* Left: Brand & Live Tickers */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: (!system || loading) ? 'var(--warn)' : 'var(--bull)', boxShadow: (!system || loading) ? '0 0 8px var(--warn)' : '0 0 8px var(--bull)' }} />
              <span className="mono font-bold" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                AETHER
              </span>
              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                {(!system || loading) ? 'SYNCING' : 'ONLINE'}
              </span>
            </div>
            
            {/* Global Fear & Greed Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 ml-4 px-2 py-0.5 rounded border border-border" style={{ background: 'rgba(255,255,255,0.03)' }}>
               <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>F&G:</span>
               <span style={{ fontSize: 10, fontWeight: 700, color: (system?.fear_greed?.value >= 75) ? 'var(--bull)' : (system?.fear_greed?.value <= 25) ? 'var(--bear)' : 'var(--warn)' }}>
                 {system?.fear_greed?.value || 50} ({system?.fear_greed?.class || 'Neutral'})
               </span>
            </div>

            {/* Quick Live Prices (Desktop / Tablet) */}
            <div className="hidden sm:flex items-center gap-2.5 mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              <span style={{ color: '#00F0FF' }}>BTC ${btcPrice >= 1000 ? (btcPrice/1000).toFixed(1) + 'k' : btcPrice.toFixed(0)}</span>
              <span>ETH ${ethPrice.toFixed(0)}</span>
              <span>SOL ${solPrice.toFixed(1)}</span>
            </div>
          </div>

          {/* Center: Live Mode Badge with Click-to-Switch */}
          <div className="flex items-center gap-2">
            <button
              className="badge cursor-pointer transition-all"
              style={{
                background: currentMode === 'live' ? 'rgba(248, 113, 113, 0.15)' : currentMode === 'testnet' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(163, 230, 53, 0.15)',
                color: currentMode === 'live' ? 'var(--bear)' : currentMode === 'testnet' ? '#00F0FF' : 'var(--accent)',
                border: currentMode === 'live' ? '1px solid var(--bear-border)' : currentMode === 'testnet' ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(163, 230, 53, 0.3)',
                padding: '3px 8px'
              }}
              onClick={() => setShowModeModal(true)}
              title="Klik untuk ganti mode trading"
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: currentMode === 'live' ? 'var(--bear)' : currentMode === 'testnet' ? '#00F0FF' : 'var(--accent)' }} />
              <span>{currentMode === 'live' ? 'MAINNET LIVE' : currentMode === 'testnet' ? 'BINANCE TESTNET' : 'PAPER TRADING'}</span>
              <ChevronDown size={10} />
            </button>
          </div>

          {/* Right: Equity, Token Guard & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Total Equity Pill */}
            <div className="flex items-center gap-1.5 mono" style={{ fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }} className="hidden sm:inline">Valuasi:</span>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: 10, color: unrealPnl >= 0 ? 'var(--bull)' : 'var(--bear)' }} className="hidden md:inline">
                ({unrealPnl >= 0 ? '+' : ''}{unrealPnl.toFixed(2)})
              </span>
            </div>

            {/* Master Token Guard Lock */}
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setShowTokenModal(true)}
              style={{
                padding: '3px 7px',
                borderColor: isUnlocked ? 'rgba(74, 222, 128, 0.3)' : 'rgba(251, 191, 36, 0.3)',
                color: isUnlocked ? 'var(--bull)' : 'var(--warn)'
              }}
              title={isUnlocked ? 'Master Token Terotentikasi' : 'Master Token Terkunci'}
            >
              {isUnlocked ? <Unlock size={11} /> : <Lock size={11} />}
              <span className="hidden sm:inline" style={{ fontSize: 9.5 }}>{isUnlocked ? 'ADMIN' : 'LOCK'}</span>
            </button>

            {/* Quick Refresh */}
            <button
              className="btn btn-ghost btn-xs"
              onClick={refresh}
              disabled={loading}
              style={{ padding: '3px 6px' }}
              title="Segarkan Data"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Dynamic Page Viewport */}
        <main className="page-viewport">
          <div className="page-container">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/positions" element={<PositionsPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/ai" element={<AIDecisionsPage />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Kinetic Smart Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 border-t flex justify-around items-center h-14" style={{ background: 'rgba(13, 17, 23, 0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--bg-border)' }}>
        <NavLink to="/dashboard" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <LayoutDashboard size={20} className={location.pathname.includes('dashboard') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('dashboard') ? 800 : 500 }}>Dasbor</span>
        </NavLink>
        <NavLink to="/portfolio" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Wallet size={20} className={location.pathname.includes('portfolio') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('portfolio') ? 800 : 500 }}>Portofolio</span>
        </NavLink>
        <NavLink to="/scanner" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <ScanSearch size={20} className={location.pathname.includes('scanner') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('scanner') ? 800 : 500 }}>Pemindai</span>
        </NavLink>
        <NavLink to="/ai" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Brain size={20} className={location.pathname.includes('ai') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('ai') ? 800 : 500 }}>Log AI</span>
        </NavLink>
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className={`kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${showMobileMenu ? 'text-cyan-400' : 'text-gray-500'}`} style={{ color: showMobileMenu ? 'var(--cyan)' : 'var(--text-muted)' }}>
          {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: showMobileMenu ? 800 : 500 }}>Menu</span>
        </button>
      </nav>

      {/* Cyberpunk Mobile Bottom Sheet Drawer */}
      <div 
        className="md:hidden fixed z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          inset: 0,
          top: showMobileMenu ? 0 : '100%',
          background: 'rgba(8, 10, 13, 0.4)',
          backdropFilter: 'blur(8px)',
          opacity: showMobileMenu ? 1 : 0,
          pointerEvents: showMobileMenu ? 'auto' : 'none',
        }}
        onClick={() => setShowMobileMenu(false)}
      >
        <div 
          className="absolute bottom-14 left-0 right-0 p-4 border-t border-border"
          style={{
            background: 'rgba(13, 17, 23, 0.4)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: '0 -10px 40px rgba(0,240,255,0.1)',
            transform: showMobileMenu ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Terminal Menu</h3>
            <button className="btn btn-ghost btn-xs kinetic-card" onClick={() => setShowMobileMenu(false)}><X size={16} /></button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-2">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon
              const active = location.pathname.includes(tab.id)
              return (
                <NavLink
                  key={tab.id}
                  to={`/${tab.id}`}
                  onClick={() => setShowMobileMenu(false)}
                  className="kinetic-card flex items-center gap-3 p-3 rounded-lg border border-border"
                  style={{
                    background: active ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                    borderColor: active ? 'var(--accent)' : 'var(--bg-border)',
                    animationDelay: `${idx * 0.05}s`,
                    opacity: 0,
                    animation: showMobileMenu ? 'var(--animate-fade-in-up)' : 'none'
                  }}
                >
                  <Icon size={16} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {tab.label}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </div>
      </div>

      {/* MASTER TOKEN UNLOCK MODAL */}
      {showTokenModal && (
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
          onClick={() => setShowTokenModal(false)}
        >
          <div className="card p-4" style={{ maxWidth: 380, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 13, fontWeight: 800 }}>Master Admin Token Guard</h3>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowTokenModal(false)}>✕</button>
            </div>

            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              Masukkan Master Token Admin untuk membuka hak akses eksekusi order, modifikasi parameter risiko, dan kontrol sistem.
            </p>

            <input
              type="password"
              placeholder="Masukkan Master Token..."
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="w-full p-2 rounded mb-3 mono"
              style={{ background: 'rgba(13, 17, 23, 0.4)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
            />

            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTokenModal(false)}>Batal</button>
              <button className="btn btn-lime btn-sm" onClick={handleSaveToken} disabled={tokenChecking}>
                {tokenChecking ? 'Memeriksa...' : 'Buka Kunci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE SWITCHER MODAL */}
      {showModeModal && (
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
          onClick={() => setShowModeModal(false)}
        >
          <div className="card p-4" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
              <h3 style={{ fontSize: 14, fontWeight: 800 }}>Pilih Lingkungan Eksekusi Trading</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowModeModal(false)}>✕</button>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              {[
                { id: 'paper', title: '🟢 Paper Trading', desc: 'Simulasi harga real-time tanpa resiko dana.', color: 'var(--bull)' },
                { id: 'testnet', title: '🔵 Binance Testnet', desc: 'Order live di Binance Testnet dengan saldo virtual.', color: '#00F0FF' },
                { id: 'live', title: '🔴 Binance Mainnet Live', desc: 'Order riil dengan dana uang sungguhan di akun Binance Anda.', color: 'var(--bear)' },
              ].map(m => (
                <button
                  key={m.id}
                  className="w-full text-left p-2.5 rounded transition-all flex items-center justify-between"
                  style={{
                    background: currentMode === m.id ? 'var(--bg-card2)' : 'var(--bg-deep)',
                    border: currentMode === m.id ? `1px solid ${m.color}` : '1px solid var(--bg-border)',
                    cursor: 'pointer'
                  }}
                  onClick={() => { switchTradingMode(m.id); setShowModeModal(false); }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{m.title}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.desc}</div>
                  </div>
                  {currentMode === m.id && <span className="badge badge-lime" style={{ fontSize: 8 }}>AKTIF</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
