import React from 'react'
import { Brain, Zap, Activity } from 'lucide-react'

export function AiCopilotFng({
  dominantRegime, triggerScan, loading, aiCommentary, fng, fngColor
}: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Qwen 27B AI Live Copilot Card */}
      <div
        className="card p-3"
        style={{
          background: 'linear-gradient(135deg, rgba(163,230,53,0.03), rgba(0,240,255,0.02), var(--bg-card))',
          border: '1px solid var(--accent-glow)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}
      >
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)' }}>
              <Brain size={13} style={{ color: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em' }}>Qwen 27B AI Copilot</span>
            <span className="badge badge-lime" style={{ fontSize: 8 }}>GATEKEEPER AKTIF</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-muted" style={{ fontSize: 8.5 }}>
              REZIM: {dominantRegime.toUpperCase()}
            </span>
            <button className="btn btn-lime btn-xs" onClick={triggerScan} disabled={loading} style={{ padding: '3px 8px', fontSize: 9.5 }}>
              <Zap size={10} /> Scan
            </button>
          </div>
        </div>
        <p style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {aiCommentary}
        </p>
      </div>

      {/* Fear & Greed Index Card */}
      <div className="card p-3 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={13} style={{ color: fngColor }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Fear & Greed Index</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', color: fngColor, lineHeight: 1.1 }}>
            {fng.value} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: fngColor, fontWeight: 700, marginTop: 2, textTransform: 'uppercase' }}>
            {fng.class}
          </div>
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, maxWidth: 200 }}>
            {fng.value >= 85 ? 'Macro TP (Jual Vault) aktif' : fng.value <= 20 ? 'Buyback Matrix (DCA Beli) aktif' : 'Alokasi portofolio berjalan normal.'}
          </p>
        </div>
        
        <div style={{ width: 80, height: 80, position: 'relative' }}>
          {/* Simple CSS Gauge */}
          <svg viewBox="0 0 100 50" style={{ overflow: 'visible' }}>
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--bg-border)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={fngColor} strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (fng.normalized * 125.6)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: fngColor }}>
            {fng.value}
          </div>
        </div>
      </div>
    </div>
  )
}
