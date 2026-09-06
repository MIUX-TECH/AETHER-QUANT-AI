export function generateDynamicChartPoints(currentVal: number, trades: any[], range: string) {
  if (currentVal <= 0) return [{ time: 'Sekarang', equity: 0 }]
  
  if (trades.length === 0) {
    return [
      { time: 'T-4', equity: currentVal },
      { time: 'T-3', equity: currentVal },
      { time: 'T-2', equity: currentVal },
      { time: 'T-1', equity: currentVal },
      { time: 'Sekarang', equity: currentVal },
    ]
  }

  // Calculate back cumulative PnL from trades
  const sorted = [...trades].sort((a, b) => (a.exit_time || 0) - (b.exit_time || 0))
  let running = currentVal - sorted.reduce((sum, t) => sum + Number(t.realized_pnl || 0), 0)
  
  const points = [{ time: 'Awal', equity: Number(running.toFixed(2)) }]
  sorted.forEach((t, i) => {
    running += Number(t.realized_pnl || 0)
    const timeStr = t.exit_time ? new Date(t.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i+1}`
    points.push({ time: timeStr, equity: Number(running.toFixed(2)) })
  })
  
  points.push({ time: 'Sekarang', equity: Number(currentVal.toFixed(2)) })
  return points
}
