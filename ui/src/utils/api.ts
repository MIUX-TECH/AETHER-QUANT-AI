const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('API_URL')
    if (saved && saved !== '/api') return saved.replace(/\/$/, '')
  }
  return (import.meta as any).env?.VITE_API_BASE_URL || ''
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

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getStatus: () => request<any>('/status'),
  getHealth: () => request<any>('/health'),
  getScanResults: () => request<any>('/scan'),
  triggerScan: () => request<any>('/scan/trigger', { method: 'POST' }),
  getPortfolio: () => request<any>('/portfolio'),
  getPositions: () => request<any>('/positions'),
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
    request<any>(`/candles/${symbol}?interval=${interval}&limit=${limit}`),
  getWallet: () => request<{ mode: string; total_equity_usd: number; assets: Array<any> }>('/wallet'),
  switchMode: (mode: string, api_key?: string, secret_key?: string) =>
    request<any>('/mode/switch', { method: 'POST', body: JSON.stringify({ mode, api_key, secret_key }) }),
  getOpenOrders: () => request<any[]>('/orders/open'),
}
