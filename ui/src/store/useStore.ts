// src/store/useStore.ts — Centralized Global State Management
import { create } from 'zustand'
import { api } from '../utils/api'

export interface SystemState {
  status: string
  mode: string
  kill_switch: boolean
  safe_mode: boolean
  last_scan: string | null
  auto_enabled?: boolean
  fear_greed?: any
}

export interface Portfolio {
  total_equity: number
  spot_equity: number
  futures_equity: number
  unrealized_pnl: number
  realized_pnl_today: number
  peak_equity: number
  drawdown_pct: number
  available_cash: number
  last_updated: string | null
  btc_vault?: {
    btc_stack?: number
    total_invested_usdt?: number
    average_cost_basis?: number
    last_buy_at?: string
  }
}

export interface Risk {
  daily_loss_pct: number
  loss_streak: number
  cooldown_active: boolean
  cooldown_until: string | null
  risk_off: boolean
  risk_off_active?: boolean
  capital_preservation: boolean
  drawdown_pct: number
  total_exposure_pct: number
  kill_switch: boolean
  safe_mode: boolean
}

export interface WalletAsset {
  asset: string
  underlying?: string
  category?: 'spot' | 'earn' | 'futures'
  free: number
  locked: number
  total: number
  price: number
  usd_value: number
}

export interface WalletState {
  mode: string
  total_equity_usd: number
  spot_usd?: number
  earn_usd?: number
  futures_usd?: number
  futures_account?: any
  assets: WalletAsset[]
}

export interface AppStore {
  // Data
  system: SystemState
  portfolio: Portfolio
  risk: Risk
  wallet: WalletState
  openOrders: any[]
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

  // Actions
  refresh: () => Promise<void>
  refreshWallet: () => Promise<void>
  refreshScan: () => Promise<void>
  refreshHistory: () => Promise<void>
  refreshPerformance: (months?: number) => Promise<void>
  refreshDecisions: () => Promise<void>
  refreshNews: (symbol?: string) => Promise<void>
  refreshMemory: () => Promise<void>
  refreshScheduler: () => Promise<void>
  triggerScan: () => Promise<void>
  switchTradingMode: (mode: string, api_key?: string, secret_key?: string) => Promise<void>
  control: (action: string, opts?: any) => Promise<void>
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
  btc_vault: {
    btc_stack: 0,
    total_invested_usdt: 0,
    average_cost_basis: 0,
    last_buy_at: undefined
  }
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

const defaultWallet: WalletState = {
  mode: 'live',
  total_equity_usd: 0,
  spot_usd: 0,
  earn_usd: 0,
  futures_usd: 0,
  assets: []
}

export const useStore = create<AppStore>((set, get) => ({
  system: { status: 'idle', mode: 'live', kill_switch: false, safe_mode: false, last_scan: null },
  portfolio: defaultPortfolio,
  risk: defaultRisk,
  wallet: defaultWallet,
  openOrders: [],
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

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const [status, walletData, openOrdersData] = await Promise.all([
        api.getStatus().catch(() => ({})),
        api.getWallet().catch(() => null),
        api.getOpenOrders().catch(() => [])
      ])

      const mode = status?.system?.mode || walletData?.mode || 'testnet'
      const totalEquity = walletData?.total_equity_usd || status?.portfolio?.total_equity || defaultPortfolio.total_equity

      set({
        system: status?.system || { status: 'running', mode },
        portfolio: {
          ...(status?.portfolio || defaultPortfolio),
          total_equity: totalEquity
        },
        wallet: walletData || defaultWallet,
        openOrders: openOrdersData || [],
        risk: status?.risk || defaultRisk,
        positions: status?.positions || { spot: [], futures: [] },
        scanResults: status?.scan_results || {},
        scanner: status?.scanner || {},
        health: status?.health || {},
        closedToday: status?.closed_today || [],
        lastRefresh: new Date(),
        loading: false,
      })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  refreshWallet: async () => {
    try {
      const wallet = await api.getWallet()
      if (wallet) {
        set({ wallet })
      }
    } catch (e: any) {
      console.warn('Wallet refresh failed:', e)
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

  switchTradingMode: async (mode: string, api_key?: string, secret_key?: string) => {
    set({ loading: true })
    try {
      await api.switchMode(mode, api_key, secret_key)
      await get().refresh()
    } catch (e: any) {
      set({ error: e.message, loading: false })
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
}))
