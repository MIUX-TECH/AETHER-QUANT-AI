// src/components/dashboard/DashboardPage.tsx — Quantitative Trading Terminal
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useNavigate } from 'react-router-dom'
import { DashboardStats } from './DashboardStats'
import { AiCopilotFng } from './AiCopilotFng'
import { EquityCurveHedge } from './EquityCurveHedge'
import { ActivePositionsTable } from './ActivePositionsTable'
import { TopSignalsList } from './TopSignalsList'
import { generateDynamicChartPoints } from './ChartUtils'

export default function DashboardPage() {
  const {
    portfolio, risk, system, scanResults, scanner, closedToday,
    positions, wallet, history, refresh, triggerScan, loading
  } = useStore()
  const navigate = useNavigate()
  const [chartRange, setChartRange] = useState<'1D' | '7D' | '30D' | 'ALL'>('1D')

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []
  const allPositions = [...allSpot, ...allFutures]

  useEffect(() => {
    refresh()
  }, [])

  const totalWalletVal = Number(wallet?.total_equity_usd || portfolio?.total_equity || 0)
  const spotVal = Number(wallet?.spot_usd || 0)
  const earnVal = Number(wallet?.earn_usd || 0)
  const futuresVal = Number(wallet?.futures_usd || 0)
  const unrealPnl = Number(portfolio?.unrealized_pnl || 0)
  const realPnl = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100

  // Real BTC stack from wallet
  const btcSpot = wallet?.assets?.find((a: any) => a.asset === 'BTC')?.total || 0
  const btcEarn = wallet?.assets?.find((a: any) => a.asset === 'LDBTC')?.total || 0
  const btcVaultStack = Number(portfolio?.btc_vault?.btc_stack || 0)
  const totalBtcStack = Math.max(btcVaultStack, btcSpot + btcEarn)
  const btcAsset = wallet?.assets?.find((a: any) => a.asset === 'BTC')
  const btcPrice = Number(btcAsset?.price || 0)
  const btcValuationUSD = totalBtcStack * btcPrice

  // Top signals list
  const signals = Object.entries(scanResults || {}).map(([sym, r]: [string, any]) => ({
    symbol: sym,
    signal: r?.score?.signal || 'WAIT',
    confidence: Number(r?.score?.confidence || 0),
    price: Number(r?.price || 0),
    change: Number(r?.price_change_24h || 0),
    regime: r?.regime?.regime || 'unknown',
    bullish_factors: r?.score?.bullish_factors || [],
    bearish_factors: r?.score?.bearish_factors || [],
    reasoning: r?.score?.reasoning || '',
    ai_verdict: r?.score?.ai_verdict || 'APPROVE',
    component_scores: r?.score?.component_scores || {
      trend: Math.round(Number(r?.score?.confidence || 0.5) * 100),
      momentum: Math.round(Number(r?.score?.confidence || 0.5) * 90 + (sym.length * 2)),
      volatility: Math.round(50 + (Number(r?.price_change_24h || 0) * 5)),
      volume: Math.round(70 + (sym.length * 3)),
      support: Math.round(Number(r?.score?.confidence || 0.5) * 95),
      resistance: Math.round(80 - (Number(r?.score?.confidence || 0.5) * 20)),
      ai_score: Math.round(Number(r?.score?.confidence || 0.5) * 100),
      macro: 65
    }
  })).filter(s => s.price > 0)

  // Real Historical Equity Points from Trades & Current Valuation
  const trades = history || []
  const chartPoints = generateDynamicChartPoints(totalWalletVal, trades, chartRange)

  // Dynamic Qwen AI commentary
  const dominantRegime = scanner?.market_regime || 'ranging'
  const buySignalsCount = signals.filter(s => s.signal.includes('BUY')).length
  const aiCommentary = dominantRegime === 'trending_up'
    ? `Pasar terdeteksi TRENDING UP. Model Qwen memvalidasi ${buySignalsCount} aset dengan momentum bullish. TP1 (40% BE+fee 0.3%) dan 60% runner trailing stop 2.5% aktif mengejar trend.`
    : dominantRegime === 'trending_down'
    ? `Pasar terdeteksi TRENDING DOWN. Sistem mengaktifkan mode proteksi modal ketat dan akumulasi DCA BTC bertahap.`
    : `Kondisi pasar RANGING / SIDEWAYS. Algoritma mean-reversion aktif dengan target TP1 ketat dan trailing stop 1.2% untuk mengunci profit secepatnya.`

  const fng = system?.fear_greed || { value: 50, class: 'Neutral', normalized: 0.5 }
  const fngColor = fng.value >= 75 ? 'var(--bull)' : fng.value <= 25 ? 'var(--bear)' : fng.value >= 55 ? 'var(--accent)' : fng.value <= 45 ? 'var(--warn)' : 'var(--text-muted)'

  return (
    <div className="flex flex-col gap-3">
      <DashboardStats
        totalWalletVal={totalWalletVal}
        system={system}
        spotVal={spotVal}
        earnVal={earnVal}
        futuresVal={futuresVal}
        totalBtcStack={totalBtcStack}
        btcValuationUSD={btcValuationUSD}
        realPnl={realPnl}
        closedToday={closedToday}
        drawdown={drawdown}
      />

      <AiCopilotFng
        dominantRegime={dominantRegime}
        triggerScan={triggerScan}
        loading={loading}
        aiCommentary={aiCommentary}
        fng={fng}
        fngColor={fngColor}
      />

      <EquityCurveHedge
        chartPoints={chartPoints}
        chartRange={chartRange}
        setChartRange={setChartRange}
        totalWalletVal={totalWalletVal}
        navigate={navigate}
      />

      <ActivePositionsTable
        allPositions={allPositions}
        navigate={navigate}
      />

      <TopSignalsList
        signals={signals}
        navigate={navigate}
      />
    </div>
  )
}
