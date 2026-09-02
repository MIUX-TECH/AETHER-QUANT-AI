// src/components/shared/Navigation.tsx

import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard, Radar, Briefcase, Activity, History,
  BarChart3, Brain, Newspaper, Settings, BookOpen, AlertTriangle
} from 'lucide-react'
import { useStore } from '../../store/useStore'

const TABS = [
  { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
  { id: 'scanner', label: 'Pemindai', icon: Radar },
  { id: 'portfolio', label: 'Portofolio', icon: Briefcase },
  { id: 'positions', label: 'Posisi', icon: Activity },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'reports', label: 'Laporan', icon: BarChart3 },
  { id: 'ai', label: 'Log AI', icon: Brain },
  { id: 'news', label: 'Berita', icon: Newspaper },
  { id: 'memory', label: 'Memori', icon: BookOpen },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
]

// Mobile bottom tabs (show only 5 primary, rest accessible via "more")
const PRIMARY_TABS = ['dashboard', 'scanner', 'portfolio', 'positions', 'settings']

export default function Navigation() {
  const { activeTab, setActiveTab, system, risk } = useStore()
  const hasDanger = risk?.kill_switch || risk?.capital_preservation

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <>
      {/* Desktop sidebar - hidden on mobile via state + CSS */}
      {!isMobile && (
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <span style={{ color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>
                ◈ AI
              </span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1, color: 'var(--text-primary)' }}>
                AETHER
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                QUANT AI
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className={`sidebar-item ${active ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.id === 'positions' && hasDanger && (
                    <AlertTriangle size={10} style={{ color: 'var(--warn)', marginLeft: 'auto' }} />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="flex items-center gap-2">
              <span className={`badge mode-${system?.mode || 'paper'}`} style={{ fontSize: 10 }}>
                {(system?.mode || 'PAPER').toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {system?.status || 'siaga'}
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {PRIMARY_TABS.map(id => {
          const tab = TABS.find(t => t.id === id)!
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={id}
              className={`mobile-nav-item ${active ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
