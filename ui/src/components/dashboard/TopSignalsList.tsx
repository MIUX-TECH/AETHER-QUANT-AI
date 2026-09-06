import React, { useState } from 'react'
import { SectionHeader, fmtPrice, SignalBadge } from '../shared'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

function SignalCard({ sig }: { sig: any }) {
  const [expanded, setExpanded] = useState(false)

  // Radar chart data mapping
  const chartData = sig.component_scores ? Object.entries(sig.component_scores).map(([key, value]) => ({
    subject: key.charAt(0).toUpperCase() + key.slice(1),
    A: value,
    fullMark: 100
  })) : []

  return (
    <div
      className={`p-2 rounded border border-border flex flex-col justify-between transition-all duration-300 ${expanded ? 'bg-gray-900/50 backdrop-blur-md border-gray-800' : ''}`}
      style={{ minHeight: 80 }}
    >
      <div 
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="mono font-bold" style={{ fontSize: 12 }}>{sig.symbol}</span>
            <span className="badge badge-muted" style={{ fontSize: 7.5 }}>{sig.regime.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            <SignalBadge signal={sig.signal} />
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>

        <div className="flex items-center justify-between mono mb-1" style={{ fontSize: 9.5 }}>
          <span style={{ color: 'var(--text-muted)' }}>${fmtPrice(sig.price)}</span>
          <span style={{ color: sig.change >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
            {sig.change >= 0 ? '+' : ''}{sig.change.toFixed(2)}%
          </span>
        </div>

        <div className="pt-1 border-t border-border flex items-center justify-between" style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Skor 8 Pilar:</span>
          <span className="font-bold" style={{ color: sig.confidence >= 0.68 ? 'var(--bull)' : 'var(--text-secondary)' }}>
            {(sig.confidence * 100).toFixed(0)}% {sig.confidence >= 0.68 ? '✓ AI APPROVED' : ''}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-3">
            <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1 tracking-wider">AI Reasoning</h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              {sig.reasoning || 'Tidak ada penjelasan AI tersedia.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <h4 className="text-[10px] uppercase text-green-500/80 font-bold mb-1 tracking-wider">Bullish Factors</h4>
              <ul className="text-[10px] text-gray-400 list-disc pl-3 space-y-0.5">
                {sig.bullish_factors && sig.bullish_factors.length > 0 
                  ? sig.bullish_factors.map((f: string, i: number) => <li key={i}>{f}</li>)
                  : <li>N/A</li>}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] uppercase text-red-500/80 font-bold mb-1 tracking-wider">Bearish Factors</h4>
              <ul className="text-[10px] text-gray-400 list-disc pl-3 space-y-0.5">
                {sig.bearish_factors && sig.bearish_factors.length > 0 
                  ? sig.bearish_factors.map((f: string, i: number) => <li key={i}>{f}</li>)
                  : <li>N/A</li>}
              </ul>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-40 w-full mt-2 bg-black/20 backdrop-blur-md rounded-md border border-border flex flex-col items-center justify-center p-2">
              <h4 className="text-[9px] uppercase text-gray-500 font-bold mb-1">8-Pillars Analysis</h4>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                  <PolarGrid stroke="var(--bg-border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                  <Radar name="Score" dataKey="A" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TopSignalsList({ signals, navigate }: any) {
  if (!signals || !Array.isArray(signals)) return null;
  
  return (
    <div className="card p-3 bg-gray-900/20 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.35s", animationFillMode: "forwards", opacity: 0 }}>
      <div className="flex items-center justify-between mb-2">
        <SectionHeader
          title="Radar Sinyal 8 Pilar Teratas"
          subtitle="Hasil pemindaian kuantitatif terkonfirmasi Qwen AI"
        />
        <button className="btn btn-ghost btn-xs" onClick={() => navigate('/scanner')} style={{ fontSize: 10 }}>
          Buka Pemindai <ArrowUpRight size={10} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
        {signals.slice(0, 6).map((sig: any, i: number) => (
          <SignalCard key={i} sig={sig} />
        ))}
      </div>
    </div>
  )
}
