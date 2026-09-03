// src/components/portfolio/PortfolioPage.tsx
import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { StatCard, SectionHeader, PnlDisplay, fmt, fmtPrice } from '../shared'
import {
  Briefcase, RefreshCw, PieChart, Shield, TrendingUp,
  Layers, CheckCircle2, Wallet, ArrowUpRight, ArrowDownRight,
  ArrowDownLeft, ArrowRightLeft, Coins, Clock, ExternalLink,
  Percent, Sparkles
} from 'lucide-react'
import { api } from '../../utils/api'
import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PortfolioPage() {
  const { portfolio, wallet, positions, risk, system, refresh, loading } = useStore()
  const [activeTab, setActiveTab] = useState<'spot' | 'earn' | 'futures' | 'deposits' | 'withdrawals' | 'transfers' | 'allocations'>('spot')
  const [deposits, setDeposits] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Interactive transfer state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferAmount, setTransferAmount] = useState('2.0')
  const [transferDirection, setTransferDirection] = useState<'spot_to_futures' | 'futures_to_spot'>('spot_to_futures')
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null)

  useEffect(() => {
    refresh()
    loadSapiData()
  }, [])

  const loadSapiData = async () => {
    setHistoryLoading(true)
    try {
      const [dep, wd, tr] = await Promise.all([
        api.getDeposits(20).catch(() => []),
        api.getWithdrawals(20).catch(() => []),
        api.getTransfers(20).catch(() => [])
      ])
      setDeposits(Array.isArray(dep) ? dep : [])
      setWithdrawals(Array.isArray(wd) ? wd : [])
      setTransfers(Array.isArray(tr) ? tr : [])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleExecuteTransfer = async () => {
    const amt = parseFloat(transferAmount)
    if (isNaN(amt) || amt < 1.0) {
      alert('Jumlah transfer minimum adalah 1.0 USDT')
      return
    }
    setIsTransferring(true)
    try {
      const res = await api.executeTransfer(amt, transferDirection)
      if (res.status === 'SUCCESS' || res.tranId) {
        setTransferFeedback(`✅ Berhasil mentransfer ${amt} USDT (${transferDirection === 'spot_to_futures' ? 'Spot ➔ Futures' : 'Futures ➔ Spot'}) | TranID: ${res.tranId}`)
        setShowTransferModal(false)
        setTimeout(() => { refresh(); loadSapiData(); setTransferFeedback(null); }, 4000)
      } else {
        alert(`Gagal transfer: ${res.error || JSON.stringify(res)}`)
      }
    } catch (e: any) {
      alert(`Gagal transfer: ${e.message}`)
    } finally {
      setIsTransferring(false)
    }
  }

  const allAssets = wallet?.assets || []
  const spotAssets = allAssets.filter((a: any) => a.category !== 'earn')
  const earnAssets = allAssets.filter((a: any) => a.category === 'earn')

  const totalEquityUSD = Number(wallet?.total_equity_usd || portfolio?.total_equity || 0)
  const spotUSD = Number(wallet?.spot_usd || 0)
  const earnUSD = Number(wallet?.earn_usd || 0)
  const futuresUSD = Number(wallet?.futures_usd || 0)
  const unrealized = Number(portfolio?.unrealized_pnl || 0)
  const realizedToday = Number(portfolio?.realized_pnl_today || 0)
  const drawdown = Number(portfolio?.drawdown_pct || 0) * 100

  // BTC Vault stats
  const btcSpot = spotAssets.find((a: any) => a.asset === 'BTC')?.total || 0
  const btcEarn = earnAssets.find((a: any) => a.asset === 'LDBTC')?.total || 0
  const btcStack = Number(portfolio?.btc_vault?.btc_stack || 0)
  const totalBtc = Math.max(btcStack, btcSpot + btcEarn)
  const btcPrice = Number(allAssets.find((a: any) => a.asset === 'BTC')?.price || 81500)
  const btcVaultValUSD = totalBtc * btcPrice
  const btcInvestedUSD = Number(portfolio?.btc_vault?.total_invested_usdt || 0)

  // Pie chart breakdown
  const colors = ['#A3E635', '#00F0FF', '#60A5FA', '#F59E0B', '#A855F7', '#EC4899', '#64748B']
  const pieData = allAssets.map((a: any, i: number) => ({
    name: a.underlying || a.asset,
    value: Number(a.usd_value || (a.total * a.price) || 0),
    color: colors[i % colors.length]
  })).filter((d: any) => d.value > 0.01)

  return (
    <div className="flex flex-col gap-3">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={16} style={{ color: 'var(--accent)' }} /> Portofolio & Rekonsiliasi Binance
          </h2>
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Dompet Spot · Simple Earn (Fleksibel) · USD(M) Futures · BTC Treasury Vault
          </p>
        </div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => { refresh(); loadSapiData(); }}
          disabled={loading || historyLoading}
          style={{ padding: '3px 8px' }}
        >
          <RefreshCw size={11} className={loading || historyLoading ? 'animate-spin' : ''} />
          <span>Sinkron</span>
        </button>
      </div>

      {/* 3 Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Total Equity Card */}
        <div className="card card-lime p-3">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Total Valuasi Portofolio (USD)
            </span>
            <span className="badge badge-lime" style={{ fontSize: 7.5 }}>{(system?.mode || 'live').toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
            ${totalEquityUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-3 mt-1.5 mono" style={{ fontSize: 9.5 }}>
            <span style={{ color: unrealized >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              Unrealized: {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
            </span>
            <span style={{ color: realizedToday >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              Hari Ini: {realizedToday >= 0 ? '+' : ''}{fmt(realizedToday)}
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-border flex justify-between items-center mono" style={{ fontSize: 9.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>Spot: ${spotUSD.toFixed(2)}</span>
            <span style={{ color: '#00F0FF' }}>Earn: ${earnUSD.toFixed(2)}</span>
            <span style={{ color: 'var(--warn)' }}>Futures: ${futuresUSD.toFixed(2)}</span>
          </div>
        </div>

        {/* BTC Treasury Vault Card */}
        <div className="card p-3" style={{ borderLeft: '3px solid #00F0FF', background: 'linear-gradient(135deg, rgba(0,240,255,0.04), var(--bg-card))' }}>
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 9.5, color: '#00F0FF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Coins size={11} /> BTC Treasury Vault
            </div>
            <span className="badge badge-cyan" style={{ fontSize: 7.5 }}>70% ACCUMULATOR</span>
          </div>
          <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, color: '#00F0FF', marginTop: 3 }}>
            {totalBtc.toFixed(8)} BTC
          </div>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
            Valuasi: ${btcVaultValUSD.toFixed(2)} USDT (@${btcPrice.toLocaleString()})
          </div>
          <div className="mt-2 pt-1.5 border-t border-border flex justify-between items-center mono" style={{ fontSize: 9.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>Spot: {btcSpot.toFixed(6)} BTC</span>
            <span style={{ color: '#00F0FF' }}>Earn: {btcEarn.toFixed(6)} BTC</span>
          </div>
        </div>

        {/* Risk & Safety Card */}
        <div className="card p-3">
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Risk Guard & Failsafe
          </div>
          <div className="flex items-center justify-between mt-2 mono" style={{ fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Drawdown:</span>
            <span className="font-bold" style={{ color: drawdown > 8 ? 'var(--bear)' : 'var(--bull)' }}>
              {drawdown.toFixed(2)}% <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>(Max 15%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 mono" style={{ fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Status Risiko:</span>
            <span className={`badge ${risk?.capital_preservation ? 'badge-bear' : risk?.risk_off ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 8 }}>
              {risk?.capital_preservation ? 'CAPITAL PRESERVATION' : risk?.risk_off ? 'RISK-OFF 50%' : 'NORMAL'}
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-border flex justify-between items-center mono" style={{ fontSize: 9.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>Mode Operasi:</span>
            <span className="badge badge-lime" style={{ fontSize: 8 }}>{(system?.mode || 'live').toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
        {[
          { id: 'spot', label: `Dompet Spot (${spotAssets.length})`, icon: Wallet },
          { id: 'earn', label: `Simple Earn / LD (${earnAssets.length})`, icon: Sparkles },
          { id: 'futures', label: `Futures USD(M)`, icon: TrendingUp },
          { id: 'deposits', label: `Deposit SAPI (${deposits.length})`, icon: ArrowDownLeft },
          { id: 'withdrawals', label: `Penarikan SAPI (${withdrawals.length})`, icon: ArrowUpRight },
          { id: 'transfers', label: `Transfer Internal (${transfers.length})`, icon: ArrowRightLeft },
          { id: 'allocations', label: `Alokasi 3-Bucket`, icon: PieChart },
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              className={`btn btn-xs ${active ? 'btn-lime' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{ padding: '3px 8px', fontSize: 9.5, whiteSpace: 'nowrap' }}
            >
              <Icon size={10} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Live Binance Spot Balances */}
      {activeTab === 'spot' && (
        <div className="card p-3">
          <SectionHeader
            title="Saldo Dompet Spot Binance"
            subtitle="Kuantitas saldo bebas, saldo dalam order, dan estimasi nilai USD real-time"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Aset</th>
                  <th style={{ padding: '6px 4px' }}>Saldo Bebas</th>
                  <th style={{ padding: '6px 4px' }}>Terkunci</th>
                  <th style={{ padding: '6px 4px' }}>Total</th>
                  <th style={{ padding: '6px 4px' }}>Harga Pasar</th>
                  <th style={{ padding: '6px 4px' }}>Nilai Estimasi (USD)</th>
                  <th style={{ padding: '6px 4px' }}>Bobot (%)</th>
                </tr>
              </thead>
              <tbody>
                {spotAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Tidak ada aset Spot terdaftar.
                    </td>
                  </tr>
                ) : (
                  spotAssets.map((a: any, i: number) => {
                    const weightPct = totalEquityUSD > 0 ? ((a.usd_value / totalEquityUSD) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
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
                          <span className="badge badge-muted" style={{ fontSize: 8 }}>{weightPct}%</span>
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

      {/* TAB 2: Simple Earn / Flexible LD Assets */}
      {activeTab === 'earn' && (
        <div className="card p-3">
          <SectionHeader
            title="Saldo Tabungan Fleksibel / Simple Earn (LD Assets)"
            subtitle="Koin yang sedang didepositkan dalam produk Binance Simple Earn dengan imbal hasil harian"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Aset Earn</th>
                  <th style={{ padding: '6px 4px' }}>Koin Dasar</th>
                  <th style={{ padding: '6px 4px' }}>Jumlah Koin</th>
                  <th style={{ padding: '6px 4px' }}>Harga Pasar</th>
                  <th style={{ padding: '6px 4px' }}>Nilai Estimasi (USD)</th>
                  <th style={{ padding: '6px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {earnAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                      Tidak ada aset di Simple Earn.
                    </td>
                  </tr>
                ) : (
                  earnAssets.map((a: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                      <td style={{ padding: '6px 4px', fontWeight: 700, color: '#00F0FF' }}>{a.asset}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 600 }}>{a.underlying}</td>
                      <td style={{ padding: '6px 4px' }}>{a.total >= 1 ? a.total.toLocaleString('en-US', { maximumFractionDigits: 4 }) : a.total.toFixed(8)}</td>
                      <td style={{ padding: '6px 4px' }}>${fmtPrice(a.price)}</td>
                      <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>${a.usd_value.toFixed(4)}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="badge badge-cyan" style={{ fontSize: 8 }}>FLEKSIBEL EARN</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Futures USD(M) Account */}
      {activeTab === 'futures' && (
        <div className="card p-3">
          <SectionHeader
            title="Akun Margin USD(M) Futures"
            subtitle="Saldo margin, margin bebas, dan posisi hedging aktif"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL MARGIN BALANCE</div>
              <div className="mono font-bold" style={{ fontSize: 16, color: 'var(--accent)', marginTop: 2 }}>${futuresUSD.toFixed(2)} USDT</div>
            </div>
            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>AVAILABLE BALANCE</div>
              <div className="mono font-bold" style={{ fontSize: 16, color: 'var(--bull)', marginTop: 2 }}>
                ${Number(wallet?.futures_account?.availableBalance || futuresUSD).toFixed(2)} USDT
              </div>
            </div>
            <div className="p-2.5 rounded bg-deep border border-border">
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>UNREALIZED PROFIT</div>
              <div className="mono font-bold" style={{ fontSize: 16, marginTop: 2 }}>
                ${Number(wallet?.futures_account?.totalUnrealizedProfit || 0).toFixed(2)} USDT
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Deposit History */}
      {activeTab === 'deposits' && (
        <div className="card p-3">
          <SectionHeader
            title="Riwayat Deposit Dana (SAPI)"
            subtitle="Catatan transaksi setoran dana masuk langsung dari Binance SAPI"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu</th>
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
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{d.coin}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--bull)' }}>+{d.amount}</td>
                        <td style={{ padding: '6px 4px' }}>{d.network || '—'}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>
                          {d.txId ? `${d.txId.substring(0, 8)}...${d.txId.substring(d.txId.length - 6)}` : 'Internal'}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className={`badge ${d.status === 1 ? 'badge-bull' : 'badge-warn'}`} style={{ fontSize: 8 }}>
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

      {/* TAB 5: Withdrawal History */}
      {activeTab === 'withdrawals' && (
        <div className="card p-3">
          <SectionHeader
            title="Riwayat Penarikan Dana (SAPI)"
            subtitle="Catatan transaksi penarikan dana keluar dari akun Binance"
          />
          <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Waktu</th>
                  <th style={{ padding: '6px 4px' }}>Koin</th>
                  <th style={{ padding: '6px 4px' }}>Jumlah</th>
                  <th style={{ padding: '6px 4px' }}>Fee</th>
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
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{w.coin}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--bear)' }}>-{w.amount}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{w.transactionFee} {w.coin}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>
                          {w.address ? `${w.address.substring(0, 6)}...${w.address.substring(w.address.length - 6)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <span className={`badge ${w.status === 6 ? 'badge-bull' : 'badge-warn'}`} style={{ fontSize: 8 }}>
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

      {/* TAB 6: Internal Transfers */}
      {activeTab === 'transfers' && (
        <div className="flex flex-col gap-2.5">
          {/* Top Action Banner */}
          <div className="card card-lime p-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                Transfer Saldo Instan (Binance SAPI)
              </div>
              <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Pindahkan USDT antara Dompet Spot dan Dompet Margin USD(M) Futures (Bebas Biaya / Zero Fee)
              </p>
            </div>
            <button
              className="btn btn-lime btn-xs"
              onClick={() => setShowTransferModal(true)}
              style={{ padding: '4px 10px', fontSize: 10.5 }}
            >
              <ArrowRightLeft size={11} />
              <span>Transfer Dana Spot ⇄ Futures</span>
            </button>
          </div>

          {transferFeedback && (
            <div className="p-2 rounded bg-deep border border-bull flex items-center gap-2">
              <CheckCircle2 size={13} style={{ color: 'var(--bull)' }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--bull)' }}>{transferFeedback}</span>
            </div>
          )}

          <div className="card p-3">
            <SectionHeader
              title="Riwayat Mutasi Transfer Internal Spot <-> Futures (SAPI)"
              subtitle="Catatan log transaksi perpindahan saldo resmi dari Binance SAPI"
            />
            <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>Waktu</th>
                    <th style={{ padding: '6px 4px' }}>Aset</th>
                    <th style={{ padding: '6px 4px' }}>Jumlah</th>
                    <th style={{ padding: '6px 4px' }}>Arah</th>
                    <th style={{ padding: '6px 4px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                        Belum ada riwayat transfer internal Spot/Futures dalam 90 hari terakhir.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t, i) => {
                      const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'
                      const direction = t.type === '1' ? 'SPOT ➔ FUTURES' : 'FUTURES ➔ SPOT'
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                          <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{timeStr}</td>
                          <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--accent)' }}>{t.asset}</td>
                          <td style={{ padding: '6px 4px', fontWeight: 600 }}>${Number(t.amount || 0).toFixed(2)}</td>
                          <td style={{ padding: '6px 4px' }}>
                            <span className={`badge ${t.type === '1' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 8 }}>
                              {direction}
                            </span>
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <span className="badge badge-bull" style={{ fontSize: 8 }}>{t.status || 'CONFIRMED'}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE SAPI TRANSFER MODAL */}
      {showTransferModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => setShowTransferModal(false)}
        >
          <div className="card p-4" style={{ maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 13.5, fontWeight: 800 }}>Transfer Saldo Internal Binance</h3>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowTransferModal(false)}>✕</button>
            </div>

            {/* Direction Selector */}
            <div className="flex flex-col gap-1.5 mb-3">
              <label style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Arah Transfer:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  className={`btn btn-xs ${transferDirection === 'spot_to_futures' ? 'btn-lime' : 'btn-ghost'}`}
                  onClick={() => setTransferDirection('spot_to_futures')}
                  style={{ padding: '6px 8px', fontSize: 10 }}
                >
                  Spot ➔ Futures
                </button>
                <button
                  className={`btn btn-xs ${transferDirection === 'futures_to_spot' ? 'btn-lime' : 'btn-ghost'}`}
                  onClick={() => setTransferDirection('futures_to_spot')}
                  style={{ padding: '6px 8px', fontSize: 10 }}
                >
                  Futures ➔ Spot
                </button>
              </div>
            </div>

            {/* Amount Input & Quick Chips */}
            <div className="flex flex-col gap-1.5 mb-3">
              <div className="flex items-center justify-between" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>Jumlah (USDT):</span>
                <span>Spot Bebas: ${spotAssets.find((a: any) => a.asset === 'USDT')?.free.toFixed(2) || '0.00'}</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="1.0"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                className="w-full p-2 rounded mono"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
              />

              <div className="flex items-center gap-1.5 mt-1">
                {['2.0', '5.0', '10.0'].map(v => (
                  <button
                    key={v}
                    className="btn btn-ghost btn-xs flex-1"
                    onClick={() => setTransferAmount(v)}
                    style={{ fontSize: 9.5, padding: '2px' }}
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTransferModal(false)}>Batal</button>
              <button className="btn btn-lime btn-sm" onClick={handleExecuteTransfer} disabled={isTransferring}>
                {isTransferring ? 'Memproses Transfer...' : 'Konfirmasi Transfer SAPI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Allocations & Drift */}
      {activeTab === 'allocations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Donut Chart Card */}
          <div className="card p-3">
            <SectionHeader title="Distribusi Aset Portofolio" subtitle="Bobot setiap koin terhadap total modal" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <div style={{ width: 125, height: 125, position: 'relative', margin: '0 auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={58}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--bg-border)', borderRadius: 6, fontSize: 9.5, fontFamily: 'var(--font-mono)' }}
                      formatter={(v: any) => [`$${Number(v).toFixed(2)}`]}
                    />
                  </RPieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, minWidth: 120 }}>
                {pieData.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ${d.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({((d.value / Math.max(totalEquityUSD, 0.01)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Target Rules & Rebalance Drift */}
          <div className="card p-3">
            <SectionHeader title="Target Alokasi & Drift Monitor" subtitle="Plafon modal 3-Bucket Hedge Fund" />
            <div className="flex flex-col gap-2.5 mt-2">
              <div>
                <div className="flex justify-between items-center mb-1 mono" style={{ fontSize: 9.5 }}>
                  <span style={{ color: '#00F0FF', fontWeight: 700 }}>BTC Vault (Target 70% Spot)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.7).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '70%', height: '100%', background: '#00F0FF' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 mono" style={{ fontSize: 9.5 }}>
                  <span style={{ color: 'var(--bull)' }}>Spot Altcoins (Target 30% Spot)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.3).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '30%', height: '100%', background: 'var(--bull)' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 mono" style={{ fontSize: 9.5 }}>
                  <span style={{ color: 'var(--warn)' }}>Futures Hedge (Target 10% Plafon)</span>
                  <span style={{ fontWeight: 600 }}>${(totalEquityUSD * 0.1).toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: 'var(--warn)' }} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-deep)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--bg-border)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                <CheckCircle2 size={12} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Rebalance otomatis aktif saat deviasi alokasi &gt; 5.0%.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
