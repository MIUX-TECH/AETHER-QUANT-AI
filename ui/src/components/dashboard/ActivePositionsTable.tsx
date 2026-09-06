import React from 'react'
import { SectionHeader, fmtPrice, PnlDisplay } from '../shared'
import { ArrowUpRight } from 'lucide-react'

export function ActivePositionsTable({ allPositions, navigate }: any) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader
          title={`Posisi Bot Terbuka (${allPositions.length})`}
          subtitle="Monitoring real-time harga entry, target take profit, dan trailing stop"
        />
        <button className="btn btn-ghost btn-xs" onClick={() => navigate('/positions')} style={{ fontSize: 10 }}>
          Kelola Posisi <ArrowUpRight size={10} />
        </button>
      </div>

      {allPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
          Belum ada posisi terbuka saat ini. Bot memindai peluang setiap 60 detik.
        </div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Simbol</th>
                <th style={{ padding: '6px 4px' }}>Tipe</th>
                <th style={{ padding: '6px 4px' }}>Nilai (USDT)</th>
                <th style={{ padding: '6px 4px' }}>Harga Masuk</th>
                <th style={{ padding: '6px 4px' }}>Harga Terkini</th>
                <th style={{ padding: '6px 4px' }}>SL / Trailing</th>
                <th style={{ padding: '6px 4px' }}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {allPositions.slice(0, 4).map((pos: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', height: 34 }}>
                  <td style={{ padding: '6px 4px', fontWeight: 700 }}>{pos.symbol}</td>
                  <td style={{ padding: '6px 4px' }}>
                    <span className={`badge ${pos.trade_type === 'futures' ? 'badge-warn' : 'badge-bull'}`} style={{ fontSize: 8.5 }}>
                      {pos.trade_type?.toUpperCase() || 'SPOT'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 4px' }}>${Number(pos.position_usdt || pos.current_value || 0).toFixed(2)}</td>
                  <td style={{ padding: '6px 4px' }}>${fmtPrice(pos.entry_price)}</td>
                  <td style={{ padding: '6px 4px', fontWeight: 600 }}>${fmtPrice(pos.current_price || pos.entry_price)}</td>
                  <td style={{ padding: '6px 4px', color: 'var(--warn)' }}>${fmtPrice(pos.trailing_stop_price || pos.sl_price)}</td>
                  <td style={{ padding: '6px 4px' }}>
                    <PnlDisplay value={Number(pos.unrealized_pnl || 0)} pct={Number(pos.unrealized_pnl_pct || 0)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
