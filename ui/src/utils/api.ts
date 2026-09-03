// src/utils/api.ts

export const getAdminToken = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ADMIN_TOKEN') || 'aether-quant-admin-2026'
  }
  return 'aether-quant-admin-2026'
}

export const setAdminToken = (token: string) => {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('ADMIN_TOKEN', token.trim())
    } else {
      localStorage.removeItem('ADMIN_TOKEN')
    }
  }
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('API_URL')
    if (saved && (saved.includes('aether-quant-ai-api.onrender.com') || saved.includes('localhost') || saved === '/api')) {
      localStorage.removeItem('API_URL')
    } else if (saved) {
      return saved.replace(/\/$/, '')
    }
  }
  return (import.meta as any).env?.VITE_API_BASE_URL || 'https://aether-quant-api-sg.onrender.com'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  let url = ''
  if (base.startsWith('http')) {
    const apiPrefix = base.endsWith('/api') ? '' : '/api'
    url = `${base}${apiPrefix}${cleanPath}`
  } else {
    url = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`
  }

  const token = getAdminToken()
  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    customHeaders['Authorization'] = `Bearer ${token}`
    customHeaders['X-Admin-Token'] = token
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...customHeaders,
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  verifyAdminToken: (token?: string) => {
    const t = token || getAdminToken()
    return request<any>('/auth/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${t}`,
        'X-Admin-Token': t
      }
    })
  },
  getStatus: () => request<any>('/status'),
  getHealth: () => request<any>('/health'),
  getScanResults: () => request<any>('/scan'),
  triggerScan: () => request<any>('/scan/trigger', { method: 'POST' }),
  getPortfolio: () => request<any>('/portfolio'),
  getPositions: () => request<any>('/positions'),
  closePosition: (symbol: string, trade_type = 'spot') =>
    request<any>('/positions/close', { method: 'POST', body: JSON.stringify({ symbol, trade_type }) }),
  closeAllPositions: () =>
    request<any>('/positions/close-all', { method: 'POST' }),
  getDeposits: (limit = 20) => request<any[]>(`/binance/deposits?limit=${limit}`),
  getWithdrawals: (limit = 20) => request<any[]>(`/binance/withdrawals?limit=${limit}`),
  getTransfers: (limit = 20) => request<any[]>(`/binance/transfers?limit=${limit}`),
  getOpenOrders: () => request<any[]>('/orders/open'),
  getWallet: () => request<any>('/wallet'),
  getHistory: (params?: { limit?: number; months?: number; symbol?: string; strategy?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.months) q.set('months', String(params.months))
    if (params?.symbol) q.set('symbol', params.symbol)
    if (params?.strategy) q.set('strategy', params.strategy)
    return request<any[]>(`/history?${q}`)
  },
  getPerformance: (months = 1) => request<any>(`/reports/performance?months=${months}`),
  getDailyReport: () => request<any>('/reports/daily'),
  getDecisions: (limit = 50) => request<any[]>(`/decisions?limit=${limit}`),
  getNews: (symbol?: string) => request<any>(symbol ? `/news?symbol=${symbol}` : '/news'),
  getMemory: () => request<any>('/memory'),
  getConfig: () => request<any>('/config'),
  updateConfig: (config_name: string, data: any) =>
    request<any>('/config', { method: 'POST', body: JSON.stringify({ config_name, data }) }),
  control: (action: string, opts?: { value?: boolean; mode?: string; symbols?: string[] }) =>
    request<any>('/control', { method: 'POST', body: JSON.stringify({ action, ...opts }) }),
  getScheduler: () => request<any>('/scheduler'),
  getCandles: (symbol: string, interval = '1h', limit = 100) =>
    request<{ symbol: string; interval: string; candles: any[] }>(`/candles/${symbol}?interval=${interval}&limit=${limit}`),
  switchMode: (mode: string, api_key?: string, secret_key?: string) =>
    request<any>('/mode/switch', { method: 'POST', body: JSON.stringify({ mode, api_key, secret_key }) }),
  executeTransfer: (amount: number, direction = 'spot_to_futures', asset = 'USDT') =>
    request<any>('/binance/transfer', { method: 'POST', body: JSON.stringify({ amount, direction, asset }) }),
}
