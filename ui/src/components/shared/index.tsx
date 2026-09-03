// src/components/shared/index.tsx — Reusable UI primitives

import React from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react'

// ─── Stat Card ──────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  change?: number
  accent?: boolean
  warn?: boolean
  danger?: boolean
  icon?: React.ReactNode
  mono?: boolean
}

export function StatCard({ label, value, sub, change, accent, warn, danger, icon, mono }: StatCardProps) {
  const border = accent ? 'card card-lime' : warn ? 'card' : danger ? 'card' : 'card'
  const valueColor = accent ? 'lime' : warn ? 'warn' : danger ? 'bear' : ''
  return (
    <div className={`${border} p-5`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        {icon && <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{icon}</span>}
      </div>
      <div className={`${valueColor}`} style={{
        fontSize: 26,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: '-0.025em',
      }}>
        {value}
      </div>
      {(sub || change !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</span>}
          {change !== undefined && <ChangeTag value={change} />}
        </div>
      )}
    </div>
  )
}

// ─── Change Tag ──────────────────────────────────────────────
export function ChangeTag({ value }: { value: number }) {
  const isPos = value >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontFamily: 'var(--font-mono)',
      color: isPos ? 'var(--bull)' : 'var(--bear)',
    }}>
      {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isPos ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

// ─── Signal Badge ────────────────────────────────────────────
const SIGNAL_CONFIG: Record<string, { label: string; cls: string }> = {
  STRONG_BUY: { label: '🟢 BELI KUAT', cls: 'badge-bull' },
  BUY: { label: '🟩 BELI', cls: 'badge-bull' },
  HOLD: { label: '🟡 TAHAN', cls: 'badge-warn' },
  REDUCE: { label: '🟠 KURANGI', cls: 'badge-warn' },
  SELL: { label: '🔴 JUAL', cls: 'badge-bear' },
  SHORT: { label: '🔻 SHORT', cls: 'badge-bear' },
  AVOID: { label: '⛔ HINDARI', cls: 'badge-muted' },
  WAIT: { label: '⏳ TUNGGU', cls: 'badge-muted' },
}

export function SignalBadge({ signal }: { signal: string }) {
  const cfg = SIGNAL_CONFIG[signal] || { label: signal, cls: 'badge-muted' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Regime Pill ─────────────────────────────────────────────
const REGIME_LABELS: Record<string, string> = {
  trending_up: '▲ TREN NAIK',
  trending_down: '▼ TREN TURUN',
  ranging: '↔ BERKISAR',
  expansion: '◈ EKSPANSI',
  compression: '◉ KOMPRESI',
  panic: '⚡ PANIK',
  euphoria: '🔥 EUFORIA',
  unknown: '? TIDAK DIKETAHUI',
}

export function RegimePill({ regime }: { regime: string }) {
  const key = regime?.toLowerCase() || 'unknown'
  return (
    <span className={`badge regime-${key}`} style={{ fontSize: 10 }}>
      {REGIME_LABELS[key] || key.toUpperCase()}
    </span>
  )
}

// ─── Mode Badge ──────────────────────────────────────────────
export function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className={`badge mode-${mode?.toLowerCase()}`}>
      {mode?.toUpperCase() || 'PAPER'}
    </span>
  )
}

// ─── Confidence Bar ──────────────────────────────────────────
export function ConfidenceBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'var(--bull)' : pct >= 60 ? 'var(--accent-lime)' : pct >= 45 ? 'var(--warn)' : 'var(--bear)'
  const h = size === 'sm' ? 4 : 6
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: h, background: 'var(--bg-border)', borderRadius: h, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: h, transition: 'width 0.4s ease',
          boxShadow: `0 0 8px ${color}40`,
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Pnl Display ─────────────────────────────────────────────
export function PnlDisplay({ value, pct, size = 'md' }: { value: number; pct?: number; size?: 'sm' | 'md' | 'lg' }) {
  const isPos = value >= 0
  const fs = size === 'lg' ? 20 : size === 'md' ? 15 : 12
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: fs, fontFamily: 'var(--font-mono)', fontWeight: 500,
      color: isPos ? 'var(--bull)' : 'var(--bear)',
    }}>
      {isPos ? '+' : ''}${Math.abs(value).toFixed(2)}
      {pct !== undefined && (
        <span style={{ fontSize: fs - 2, opacity: 0.7 }}>
          ({isPos ? '+' : ''}{pct.toFixed(2)}%)
        </span>
      )}
    </span>
  )
}

// ─── Section Header ──────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Status Dot ──────────────────────────────────────────────
export function StatusDot({ status }: { status: 'ok' | 'warn' | 'error' | 'idle' }) {
  const colors = { ok: 'var(--bull)', warn: 'var(--warn)', error: 'var(--bear)', idle: 'var(--text-muted)' }
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7,
      background: colors[status], borderRadius: '50%',
      boxShadow: status === 'ok' ? `0 0 6px ${colors.ok}` : undefined,
    }} />
  )
}

// ─── Loading ─────────────────────────────────────────────────
export function LoadingSpinner({ size = 16 }: { size?: number }) {
  return (
    <Loader size={size} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-lime)' }} />
  )
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      {icon && <div style={{ marginBottom: 12, opacity: 0.4 }}>{icon}</div>}
      <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{message}</p>
    </div>
  )
}

// ─── Progress Ring ───────────────────────────────────────────
export function ProgressRing({ value, size = 48, strokeWidth = 4, label }: {
  value: number; size?: number; strokeWidth?: number; label?: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  const color = value >= 75 ? 'var(--bull)' : value >= 50 ? 'var(--accent-lime)' : value >= 30 ? 'var(--warn)' : 'var(--bear)'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-border)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      {label && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontFamily: 'var(--font-mono)', color,
        }}>
          {label}
        </div>
      )}
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="sep" style={{ margin: '12px 0' }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
    </div>
  )
}

// ─── Inline helpers ──────────────────────────────────────────
export function fmt(v: number, decimals = 2): string {
  if (v === undefined || v === null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`
  return `$${v.toFixed(decimals)}`
}

export function fmtPct(v: number): string {
  if (v === undefined || v === null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export function fmtTime(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export function fmtPrice(v: number): string {
  if (!v) return '—'
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  return v.toFixed(6)
}

export { TickerRibbon } from './TickerRibbon'

