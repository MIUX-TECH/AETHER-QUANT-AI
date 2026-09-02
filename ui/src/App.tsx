// src/App.tsx — Main application shell with navigation and routing

import React, { useEffect } from 'react'
import { useStore } from './store/useStore'
import Navigation from './components/shared/Navigation'
import DashboardPage from './components/dashboard/DashboardPage'
import ScannerPage from './components/scanner/ScannerPage'
import PortfolioPage from './components/portfolio/PortfolioPage'
import PositionsPage from './components/positions/PositionsPage'
import HistoryPage from './components/history/HistoryPage'
import ReportsPage from './components/reports/ReportsPage'
import AIDecisionsPage from './components/ai/AIDecisionsPage'
import NewsPage from './components/ai/NewsPage'
import MemoryPage from './components/memory/MemoryPage'
import SettingsPage from './components/settings/SettingsPage'

const PAGES: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  scanner: ScannerPage,
  portfolio: PortfolioPage,
  positions: PositionsPage,
  history: HistoryPage,
  reports: ReportsPage,
  ai: AIDecisionsPage,
  news: NewsPage,
  memory: MemoryPage,
  settings: SettingsPage,
}

export default function App() {
  const { activeTab, refresh, system, portfolio, risk, scanner } = useStore()

  useEffect(() => {
    refresh()
  }, [])

  const PageComponent = PAGES[activeTab] || DashboardPage

  const equity = portfolio?.total_equity || 0
  const regime = scanner?.market_regime || system?.status || '—'
  const lastScan = system?.last_scan ? new Date(system.last_scan).toLocaleTimeString() : '—'

  return (
    <div className="app-shell">
      <Navigation />

      {/* Wrapper so top-bar + main are vertical inside the flex content area */}
      <div className="main-content">
        {/* Top status bar - always informative, mobile friendly */}
        <header className="top-bar">
          <div className="top-bar-content">
            <div className="top-bar-left">
              <div className="logo-small">◈</div>
              <div className="status-pills">
                <span className={`pill mode-${system?.mode || 'paper'}`}>{(system?.mode || 'paper').toUpperCase() === 'PAPER' ? 'SIMULASI' : (system?.mode || 'paper').toUpperCase()}</span>
                <span className="pill regime">{regime}</span>
              </div>
            </div>

            <div className="top-bar-center">
              <div className="equity">
                ${equity.toFixed(2)}
                <span className="pnl"> {portfolio?.unrealized_pnl >= 0 ? '+' : ''}{(portfolio?.unrealized_pnl || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="top-bar-right">
              <button className="btn btn-ghost btn-sm" onClick={() => refresh()}>⟳</button>
              <span className="last-scan mono">Terakhir {lastScan}</span>
            </div>
          </div>
        </header>

        <main className="app-main">
          <div className="page-container">
            <PageComponent />
          </div>
        </main>
      </div>

      <style>{`
        /* Modern polished inline styles (complements globals.css) */

        .sidebar-logo {
          display: flex; align-items: center; gap: 12px;
          padding: 20px 18px 16px; border-bottom: 1px solid var(--bg-border);
        }
        .logo-mark {
          width: 34px; height: 34px; background: var(--accent-glow);
          border: 1px solid var(--bg-border2); border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sidebar-nav { flex:1; overflow-y:auto; padding:10px 10px; display:flex; flex-direction:column; gap:4px; }
        .sidebar-item {
          display:flex; align-items:center; gap:12px; padding:10px 14px;
          border-radius:12px; border:none; background:transparent;
          color:var(--text-secondary); font-family:var(--font-ui); font-size:14px; font-weight:500;
          cursor:pointer; transition:all .2s; width:100%; text-align:left;
        }
        .sidebar-item:hover { background:var(--bg-hover); color:var(--text-primary); }
        .sidebar-item.active { background:var(--bg-card2); color:var(--accent); }
        .sidebar-footer { padding:16px 18px; border-top:1px solid var(--bg-border); font-size:12px; }

        .app-main { flex:1; overflow:hidden; display:flex; flex-direction:column; }
        .page-container { flex:1; overflow-y:auto; padding:0; background:var(--bg-void); }
        .page { padding:24px 18px 110px; max-width:1080px; margin:0 auto; }

        /* Sleek modern mobile nav (in case inline overrides) */
        .mobile-nav-item { font-size:10px; gap:3px; padding:7px 3px; border-radius:999px; min-height:48px; }
        .mobile-nav-item.active { color:var(--accent); background:var(--bg-card2); }

        @media (max-width: 768px) {
          .page { padding:16px 12px 105px; }
        }
        @media (max-width: 420px) {
          .page { padding:12px 10px 100px; }
          .top-bar { padding:6px 10px; }
        }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
