// src/components/shared/Navigation.tsx
import React, { useState } from 'react'
import {
  LayoutDashboard, Radar, Briefcase, Activity, History,
  BarChart3, Brain, Newspaper, Settings, BookOpen, AlertTriangle,
  ChevronDown, Globe, ShieldCheck, Zap
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export const TABS = [
  { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
  { id: 'scanner', label: 'Pemindai', icon: Radar },
  { id: 'positions', label: 'Posisi', icon: Activity },
  { id: 'portfolio', label: 'Portofolio', icon: Briefcase },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'ai', label: 'Log AI', icon: Brain },
  { id: 'news', label: 'Berita & Sentimen', icon: Newspaper },
  { id: 'reports', label: 'Laporan', icon: BarChart3 },
  { id: 'memory', label: 'Memori', icon: BookOpen },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
]

export const MOBILE_PRIMARY_TABS = ['dashboard', 'scanner', 'positions', 'portfolio', 'history']

export default function Navigation() {
  const { system, risk, positions, switchTradingMode, loading } = useStore()
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  
  const activeTab = location.pathname.substring(1) || 'dashboard'

  const hasDanger = risk?.kill_switch || risk?.capital_preservation
  const totalPosCount = (positions?.spot?.length || 0) + (positions?.futures?.length || 0)
  const currentMode = system?.mode || 'testnet'

  const handleSelectMode = (mode: string) => {
    setShowModeDropdown(false)
    if (mode !== currentMode) {
      switchTradingMode(mode)
    }
  }

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="sidebar">
        {/* Brand Logo Header */}
        <div className="sidebar-logo">
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent)'
            }}
          >
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>
              ◈
            </span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              AETHER
            </div>
            <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', fontWeight: 700 }}>
              QUANT AI
            </div>
          </div>
        </div>

        {/* Quick Mode Switcher Strip */}
        <div className="p-2 border-b border-border" style={{ position: 'relative' }}>
          <button
            className="w-full flex items-center justify-between p-1.5 rounded-md transition-colors"
            style={{
              background: currentMode === 'live' ? 'rgba(248, 113, 113, 0.1)' : currentMode === 'testnet' ? 'rgba(0, 240, 255, 0.1)' : 'rgba(163, 230, 53, 0.1)',
              border: currentMode === 'live' ? '1px solid var(--bear)' : currentMode === 'testnet' ? '1px solid #00f0ff' : '1px solid var(--accent)',
              cursor: 'pointer'
            }}
            onClick={() => setShowModeDropdown(!showModeDropdown)}
          >
            <div className="flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentMode === 'live' ? 'var(--bear)' : currentMode === 'testnet' ? '#00f0ff' : 'var(--accent)' }} />
              <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                {currentMode === 'live' ? 'BINANCE MAINNET' : currentMode === 'testnet' ? 'BINANCE TESTNET' : 'PAPER TRADING'}
              </span>
            </div>
            <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
          </button>

          {showModeDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 8,
                right: 8,
                marginTop: 4,
                background: 'var(--bg-card2)',
                border: '1px solid var(--bg-border2)',
                borderRadius: 6,
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                overflow: 'hidden'
              }}
            >
              {[
                { id: 'paper', label: '🟢 Paper Trading', desc: 'Simulasi harga real' },
                { id: 'testnet', label: '🔵 Binance Testnet', desc: 'Order saldo virtual' },
                { id: 'live', label: '🔴 Binance Mainnet', desc: 'Order uang sungguhan' },
              ].map(m => (
                <button
                  key={m.id}
                  className="w-full text-left p-2 transition-colors hover:bg-hover border-b border-border last:border-0"
                  style={{ background: currentMode === m.id ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', display: 'block' }}
                  onClick={() => handleSelectMode(m.id)}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}>{m.label}</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Menu Links */}
        <nav className="sidebar-nav">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`sidebar-item ${active ? 'active' : ''}`}
                onClick={() => navigate(`/${tab.id}`)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.id === 'positions' && totalPosCount > 0 && (
                  <span className="badge badge-lime" style={{ fontSize: 9, marginLeft: 'auto', padding: '1px 5px' }}>
                    {totalPosCount}
                  </span>
                )}
                {tab.id === 'positions' && hasDanger && (
                  <AlertTriangle size={11} style={{ color: 'var(--warn)', marginLeft: 'auto' }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer System Status */}
        <div className="p-3 border-t border-border flex items-center justify-between" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--bull)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ● 24/7 LIVE
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            v4.0 PRO
          </span>
        </div>
      </aside>

      {/* Mobile Bottom Bar Navigation (Thumb-friendly) */}
      <nav className="mobile-nav">
        {MOBILE_PRIMARY_TABS.map(id => {
          const tab = TABS.find(t => t.id === id)!
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={id}
              className={`mobile-nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(`/${id}`)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
