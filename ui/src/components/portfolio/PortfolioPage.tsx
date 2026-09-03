// src/components/portfolio/PortfolioPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, SectionHeader, PnlDisplay, fmt, fmtPrice } from '../shared'
import {
  Briefcase, RefreshCw, PieChart, Shield, TrendingUp,
  Layers, CheckCircle2, Wallet, ArrowUpRight, ArrowDownRight,
  ArrowDownLeft, ArrowRightLeft, Coins, Clock, ExternalLink
} from 'lucide-react'
import { api } from '../../utils/api'
import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PortfolioPage() {
  const { portfolio, wallet, positions, risk, system, refresh, loading } = useStore()
  const [alloc, setAlloc] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'balances' | 'vault' | 'deposits' | 'withdrawals' | 'transfers' | 'allocations'>('balances')
  const [deposits, setDeposits] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    refresh()
    api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    loadSapiData()
    const interval = setInterval(() => {
      refresh()
      api.getPortfolio().then(r => setAlloc(r?.allocations)).catch(() => null)
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  const loadSapiData = async () => {
    setHistoryLoading(true)
    try {
      const [dep, wd, tr] = await Promise.all([
        api.getDeposits(15).catch(() => []),
        api.getWithdrawals(15).catch(() => []),
        api.getTransfers(15).catch(() => [])
      ])
      setDeposits(Array.isArray(dep) ? dep : [])
      setWithdrawals(Array.isArray(wd) ? wd : [])
      setTransfers(Array.isArray(tr) ? tr : [])
    } finally {
      setHistoryLoading(false)
    }
  }

  const assets = wallet?.assets || []
  const totalEquityUSD = Number(wallet?.total_equity_usd || portfolio?.total_equity || 1000)
  const unrealized = Number(portfolio?.unrealized_pnl || 0)
  const realizedToday = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100
  const peakEquity = Number(portfolio?.peak_equity || totalEquityUSD)

  const allSpot = positions?.spot || []
  const allFutures = positions?.futures || []

  // Deployed vs free cash
  const deployedSpot = allSpot.reduce((sum: number, p: any) => sum + Number(p.position_usdt || p.cost || 0), 0)
  const deployedFutures = allFutures.reduce((sum: number, p: any) => sum + Number(p.margin_used || p.margin || 0), 0)
  const totalDeployed = deployedSpot + deployedFutures

  const usdtAsset = assets.find(a => a.asset === 'USDT')
  const freeUSDT = usdtAsset ? usdtAsset.free : Math.max(0, totalEquityUSD - totalDeployed)

  // BTC Vault stats
  const btcVault = portfolio?.btc_vault || {}
  const btcStack = Number(btcVault.btc_stack || 0)
  const btcPrice = Number(assets.find(a => a.asset === 'BTC')?.price || 81500)
  const btcVaultValUSD = btcStack * btcPrice
  const btcInvestedUSD = Number(btcVault.total_invested_usdt || 0)
  const btcProfitUSD = btcVaultValUSD - btcInvestedUSD

  // Pie chart breakdown
  const colors = ['#A3E635', '#00F0FF', '#60A5FA', '#F59E0B', '#A855F7', '#EC4899', '#64748B']
  const pieData = assets.map((a, i) => ({
    name: a.asset,
    value: Number(a.usd_value || (a.total * a.price) || 0),
    color: colors[i % colors.length]
  })).filter(d => d.value > 0.5)

  return (
    <div className="page pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={18} style={{ color: 'var(--accent)' }} /> Portofolio & Rekonsiliasi Binance
          </h1>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            Agregasi Saldo Dompet Riil · BTC Treasury Vault · Riwayat Mutasi SAPI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => { refresh(); loadSapiData(); }} disabled={loading || historyLoading} style={{ padding: '4px 10px' }}>
            <RefreshCw size={12} className={loading || historyLoading ? 'animate-spin' : ''} />
            <span>Sinkronkan Data</span>
          </button>
        </div>
      </div>

      {/* Hero Valuation Banner & BTC Vault Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* Total Equity Card */}
        <div className="card card-lime p-3" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Total Valuasi Portofolio (USD)
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)', marginTop: 2 }}>
            ${totalEquityUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-3 mt-2" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: unrealized >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              Unrealized: {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
            </span>
            <span style={{ color: realizedToday >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              Hari Ini: {realizedToday >= 0 ? '+' : ''}{fmt(realizedToday)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-between items-center" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Kas USDT Bebas:</span>
            <span style={{ fontWeight: 700, color: 'var(--bull)' }}>${freeUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* BTC Treasury Vault Card */}
        <div className="card p-3" style={{ borderLeft: '3px solid #00F0FF', background: 'linear-gradient(135deg, rgba(0,240,255,0.05), transparent)' }}>
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 10, color: '#00F0FF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Coins size={12} /> BTC Treasury Vault
            </div>
            <span className="badge" style={{ background: 'rgba(0,240,255,0.15)', color: '#00F0FF', fontSize: 9 }}>70% PROFIT ACCUMULATOR</span>
          </div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: '#00F0FF', marginTop: 4 }}>
            {btcStack.toFixed(8)} BTC
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
            Valuasi: ${btcVaultValUSD.toFixed(2)} USDT (@${btcPrice.toLocaleString()})
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-between items-center" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Modal Profit Diinvestasi:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${btcInvestedUSD.toFixed(2)} USDT</span>
          </div>
        </div>

        {/* Risk & Safety Card */}
        <div className="card p-3">
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Risk Guard & Failsafe
          </div>
          <div className="flex items-center justify-between mt-2">
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Drawdown Portofolio:</span>
            <span className="mono font-bold" style={{ color: drawdown > 8 ? 'var(--bear)' : 'var(--bull)' }}>
              {drawdown.toFixed(2)}% <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(Max 15%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status Proteksi:</span>
            <span className={`badge ${risk?.capital_preservation ? 'badge-bear' : risk?.risk_off_active ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 9 }}>
              {risk?.capital_preservation ? 'CAPITAL PRESERVATION' : risk?.risk_off_active ? 'RISK-OFF 50%' : 'NORMAL TRADING'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-between items-center" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Mode Aktif:</span>
            <span className="badge badge-lime" style={{ fontSize: 9 }}>{(system?.mode || 'PAPER').toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 mb-3 border-b border-border pb-2 overflow-x-auto">
        <button
          className={`btn btn-sm ${activeTab === 'balances' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveTab('balances')}
          style={{ padding: '4px 10px', fontSize: 10 }}
        >
          <Wallet size={11} /> Saldo Aset ({assets.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'deposits' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveTab('deposits')}
          style={{ padding: '4px 10px', fontSize: 10 }}
        >
          <ArrowDownLeft size={11} /> Riwayat Deposit ({deposits.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'withdrawals' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveTab('withdrawals')}
          style={{ padding: '4px 10px', fontSize: 10 }}
        >
          <ArrowUpRight size={11} /> Riwayat Penarikan ({withdrawals.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'transfers' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveTab('transfers')}
          style={{ padding: '4px 10px', fontSize: 10 }}
        >
          <ArrowRightLeft size={11} /> Transfer Spot/Futures ({transfers.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'allocations' ? 'btn-lime' : 'btn-ghost'}`}
          onClick={() => setActiveTab('allocations')}
          style={{ padding: '4px 10px', fontSize: 10 }}
        >
          <PieChart size={11} /> Alokasi & Drift Rebalancing
        </button>
      </div>

      {/* TAB 1: Live Binance Balances */}
      {activeTab === 'balances' && (
        <div className="card p-3 mb-3">
          <SectionHeader
            title="Daftar Saldo Aset Binance"
            subtitle="Kuantitas saldo bebas, saldo terkunci, dan estimasi nilai USD yang tersinkronisasi dari Binance API"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Aset</th>
                  <th style={{ padding: '6px 4px' }}>Saldo Bebas</th>
                  <th style={{ padding: '6px 4px' }}>Terkunci (Order)</th>
                  <th style={{ padding: '6px 4px' }}>Total Kuantitas</th>
                  <th style={{ padding: '6px 4px' }}>Harga Pasar</th>
                  <th style={{ padding: '6px 4px' }}>Nilai Estimasi (USD)</th>
                  <th style={{ padding: '6px 4px' }}>Porsi (%)</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Tidak ada aset terdaftar.
                    </td>
                  </tr>
                ) : (
                  assets.map((a, i) => {
                    const weightPct = totalEquityUSD > 0 ? ((a.usd_value / totalEquityUSD) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 36 }}>
                        <td style={{ padding: '6px 4px', fontWeight: 700 }}>
                          <span style={{ color: a.asset === 'BTC' ? '#00F0FF' : a.asset === 'USDT' ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {a.asset}
                          </span>
                        </td>
                        <td style={{ padding: '6px 4px' }}>{a.free >= 1 ? a.free.toLocaleString('en-US', { maximumFractionDigits: 4 }) : a.free.toFixed(6)}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{a.locked > 0 ? a.locked.toFixed(4) : '0.00'}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600 }}>{a.total >= 1 ? a.total.toLocaleString('en-US', { maximumFractionDigits: 4 }) : a.total.toFixed(6)}</td>
                        <td style={{ padding: '6px 4px' }}>${fmtPrice(a.price)}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>
                          ${a.usd_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className="badge badge-muted" style={{ fontSize: 9 }}>{weightPct}%</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Deposit History */}
      {activeTab === 'deposits' && (
        <div className="card p-3 mb-3">
          <SectionHeader
            title="Riwayat Deposit Dana (SAPI)"
            subtitle="Catatan transaksi setoran dana masuk dari jaringan blockchain atau internal Binance"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu Masuk</th>
                  <th style={{ padding: '6px 4px' }}>Koin</th>
                  <th style={{ padding: '6px 4px' }}>Jumlah</th>
                  <th style={{ padding: '6px 4px' }}>Jaringan</th>
                  <th style={{ padding: '6px 4px' }}>TXID / Hash</th>
                  <th style={{ padding: '6px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Belum ada riwayat deposit terbaru.
                    </td>
                  </tr>
                ) : (
                  deposits.map((d, i) => {
                    const timeStr = d.insertTime ? new Date(d.insertTime).toLocaleString() : '—'
                    const statusLabel = d.status === 1 ? 'SUKSES' : d.status === 0 ? 'PENDING' : 'DIBATALKAN'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 36 }}>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{d.coin}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--bull)' }}>+{d.amount}</td>
                        <td style={{ padding: '6px 4px' }}>{d.network || '—'}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>
                          {d.txId ? `${d.txId.substring(0, 10)}...${d.txId.substring(d.txId.length - 6)}` : 'Internal'}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className={`badge ${d.status === 1 ? 'badge-bull' : 'badge-warn'}`} style={{ fontSize: 9 }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Withdrawal History */}
      {activeTab === 'withdrawals' && (
        <div className="card p-3 mb-3">
          <SectionHeader
            title="Riwayat Penarikan Dana (SAPI)"
            subtitle="Catatan transaksi penarikan dana keluar dari akun Binance"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu Penarikan</th>
                  <th style={{ padding: '6px 4px' }}>Koin</th>
                  <th style={{ padding: '6px 4px' }}>Jumlah</th>
                  <th style={{ padding: '6px 4px' }}>Biaya (Fee)</th>
                  <th style={{ padding: '6px 4px' }}>Alamat Tujuan</th>
                  <th style={{ padding: '6px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Belum ada riwayat penarikan dana.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w, i) => {
                    const timeStr = w.applyTime || '—'
                    const statusLabel = w.status === 6 ? 'SELESAI' : w.status === 4 ? 'DIPROSES' : 'GAGAL'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 36 }}>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{w.coin}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--bear)' }}>-{w.amount}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{w.transactionFee} {w.coin}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>
                          {w.address ? `${w.address.substring(0, 8)}...${w.address.substring(w.address.length - 6)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className={`badge ${w.status === 6 ? 'badge-bull' : 'badge-warn'}`} style={{ fontSize: 9 }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Internal Transfers History */}
      {activeTab === 'transfers' && (
        <div className="card p-3 mb-3">
          <SectionHeader
            title="Riwayat Transfer Internal Spot <-> Futures (SAPI)"
            subtitle="Mutasi perpindahan dana saldo margin antara dompet Spot dan USD(M) Futures"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu Transfer</th>
                  <th style={{ padding: '6px 4px' }}>Aset</th>
                  <th style={{ padding: '6px 4px' }}>Jumlah</th>
                  <th style={{ padding: '6px 4px' }}>Arah Perpindahan</th>
                  <th style={{ padding: '6px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Belum ada riwayat transfer internal Spot/Futures.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t, i) => {
                    const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'
                    const direction = t.type === '1' ? 'SPOT ➔ FUTURES' : 'FUTURES ➔ SPOT'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 36 }}>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{t.asset}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600 }}>${Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className={`badge ${t.type === '1' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 9 }}>
                            {direction}
                          </span>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className="badge badge-bull" style={{ fontSize: 9 }}>{t.status || 'CONFIRMED'}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Allocations & Drift Monitor */}
      {activeTab === 'allocations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Donut Chart Card */}
          <div className="card p-3">
            <SectionHeader title="Distribusi Aset Portofolio" subtitle="Bobot setiap koin terhadap total modal" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ width: 140, height: 140, position: 'relative', margin: '0 auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      formatter={(v: any) => [`$${Number(v).toFixed(2)}`]}
                    />
                  </RPieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, minWidth: 140 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({((d.value / Math.max(totalEquityUSD, 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Target Rules & Rebalance Drift */}
          <div className="card p-3">
            <SectionHeader title="Target Alokasi & Drift Monitor" subtitle="Plafon modal 3-Bucket Hedge Fund" />
            <div className="flex flex-col gap-3 mt-2">
              <div>
                <div className="flex justify-between items-center mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#00F0FF', fontWeight: 700 }}>BTC Treasury Vault (Target 70% Spot)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.9 * 0.7).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '70%', height: '100%', background: '#00F0FF' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--bull)' }}>Spot Altcoins (Target 30% Spot)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.9 * 0.3).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '30%', height: '100%', background: 'var(--bull)' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--warn)' }}>UM Futures Tactical Hedge (Target 10% Total)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.1).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: 'var(--warn)' }} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-deep)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bg-border)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Rebalancing otomatis aktif saat deviasi alokasi &gt; 5.0%.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
