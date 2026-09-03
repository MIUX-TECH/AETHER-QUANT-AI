// src/components/shared/TickerRibbon.tsx
import React from 'react'
import { useStore } from '../../store/useStore'
import { fmtPrice } from './index'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

export function TickerRibbon() {
  const { scanResults, scanner } = useStore()
  const results = Object.values(scanResults || {})

  const featured = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']
  const items = featured.map(sym => {
    const data: any = scanResults?.[sym]
    return {
      symbol: sym.replace('USDT', ''),
      price: data?.price || 0,
      change: data?.price_change_24h || 0,
      regime: data?.regime?.regime || 'ranging',
      signal: data?.score?.signal || 'WAIT'
    }
  }).filter(i => i.price > 0)

  if (items.length === 0) return null

  return (
    <div className="ticker-ribbon">
      <div className="ticker-content">
        {items.map(item => {
          const isUp = item.change >= 0
          return (
            <div key={item.symbol} className="ticker-item">
              <span className="ticker-sym">{item.symbol}</span>
              <span className="ticker-price">${fmtPrice(item.price)}</span>
              <span className={`ticker-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '+' : ''}{(item.change * 100).toFixed(2)}%
              </span>
              <span className={`ticker-signal sig-${item.signal.toLowerCase()}`}>
                {item.signal}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
