// src/store/useStore.ts — Global state with Zustand

import { create } from 'zustand'
import { api } from '../utils/api'

interface SystemState {
  status: string
  mode: string
  kill_switch: boolean
  safe_mode: boolean
  last_scan: string | null
  auto_enabled?: boolean
}

interface Portfolio {
  total_equity: number
  spot_equity: number
  futures_equity: number
  unrealized_pnl: number
  realized_pnl_today: number
  peak_equity: number
  drawdown_pct: number
  available_cash: number
  last_updated: string | null
}

interface Risk {
  daily_loss_pct: number
  loss_streak: number
  cooldown_active: boolean
  cooldown_until: string | null
  risk_off: boolean
  capital_preservation: boolean
  drawdown_pct: number
  total_exposure_pct: number
  kill_switch: boolean
  safe_mode: boolean
}

interface AppStore {
  // Data
  system: SystemState
  portfolio: Portfolio
  risk: Risk
  positions: { spot: any[]; futures: any[] }
  scanResults: Record<string, any>
  decisions: any[]
  history: any[]
  performance: any
  news: any
  memory: any
  health: any
  scanner: any
  scheduler: any
  closedToday: any[]

  // UI state
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  activeTab: string

  // Actions
  refresh: () => Promise<void>
  refreshScan: () => Promise<void>
  refreshHistory: () => Promise<void>
  refreshPerformance: (months?: number) => Promise<void>
  refreshDecisions: () => Promise<void>
  refreshNews: (symbol?: string) => Promise<void>
  refreshMemory: () => Promise<void>
  refreshScheduler: () => Promise<void>
  triggerScan: () => Promise<void>
  control: (action: string, opts?: any) => Promise<void>
  setActiveTab: (tab: string) => void
}

const defaultPortfolio: Portfolio = {
  total_equity: 0,
  spot_equity: 0,
  futures_equity: 0,
  unrealized_pnl: 0,
  realized_pnl_today: 0,
  peak_equity: 0,
  drawdown_pct: 0,
  available_cash: 0,
  last_updated: null,
}

const defaultRisk: Risk = {
  daily_loss_pct: 0,
  loss_streak: 0,
  cooldown_active: false,
  cooldown_until: null,
  risk_off: false,
  capital_preservation: false,
  drawdown_pct: 0,
  total_exposure_pct: 0,
  kill_switch: false,
  safe_mode: false,
}

export const useStore = create<AppStore>((set, get) => ({
  system: { status: 'idle', mode: 'paper', kill_switch: false, safe_mode: false, last_scan: null },
  portfolio: defaultPortfolio,
  risk: defaultRisk,
  positions: { spot: [], futures: [] },
  scanResults: {},
  decisions: [],
  history: [],
  performance: null,
  news: null,
  memory: null,
  health: {},
  scanner: {},
  scheduler: {},
  closedToday: [],
  loading: false,
  error: null,
  lastRefresh: null,
  activeTab: 'dashboard',

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const status = await api.getStatus()
      set({
        system: status.system || {},
        portfolio: status.portfolio || defaultPortfolio,
        risk: status.risk || defaultRisk,
        positions: status.positions || { spot: [], futures: [] },
        scanResults: status.scan_results || {},
        scanner: status.scanner || {},
        health: status.health || {},
        closedToday: status.closed_today || [],
        lastRefresh: new Date(),
        loading: false,
      })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  refreshScan: async () => {
    try {
      const results = await api.getScanResults()
      set({ scanResults: results || {} })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshHistory: async () => {
    try {
      const history = await api.getHistory({ limit: 100, months: 2 })
      set({ history: history || [] })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshPerformance: async (months = 1) => {
    try {
      const perf = await api.getPerformance(months)
      set({ performance: perf })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshDecisions: async () => {
    try {
      const decisions = await api.getDecisions(100)
      set({ decisions: decisions || [] })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshNews: async (symbol?: string) => {
    try {
      const news = await api.getNews(symbol)
      set({ news })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshMemory: async () => {
    try {
      const memory = await api.getMemory()
      set({ memory })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshScheduler: async () => {
    try {
      const scheduler = await api.getScheduler()
      set({ scheduler })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  triggerScan: async () => {
    try {
      await api.triggerScan()
      await get().refresh()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  control: async (action: string, opts?: any) => {
    try {
      await api.control(action, opts)
      await get().refresh()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  setActiveTab: (tab: string) => set({ activeTab: tab }),
}))
