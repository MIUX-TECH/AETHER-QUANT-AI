// src/components/ai/NewsPage.tsx

import React, { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { SectionHeader, EmptyState, fmtTime } from '../shared'
import { Newspaper, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT']

export default function NewsPage() {
  const { news, refreshNews } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [articles, setArticles] = useState<any[]>([])

  useEffect(() => { refreshNews() }, [])

  useEffect(() => {
    if (selected) {
      import('../../utils/api').then(({ api }) => {
        api.getNews(selected).then((r: any) => setArticles(r?.articles || []))
      })
    } else {
      setArticles([])
    }
  }, [selected])

  const summary = selected ? null : news
  const sentiment = summary?.overall_sentiment || 0.5
  const sentimentLabel = sentiment > 0.65 ? 'BULLISH' : sentiment < 0.35 ? 'BEARISH' : 'NEUTRAL'
  const sentimentColor = sentiment > 0.65 ? 'var(--bull)' : sentiment < 0.35 ? 'var(--bear)' : 'var(--warn)'

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Berita & Sentimen</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Market sentiment analysis · auxiliary signal layer
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { refreshNews(selected || undefined) }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Market sentiment overview */}
      {!selected && summary && (
        <div className="card p-4 mb-4" style={{ borderColor: sentimentColor + '30' }}>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Market Sentiment" />
            <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: sentimentColor }}>
              {sentimentLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ flex: 1, height: 8, background: 'var(--bg-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${sentiment * 100}%`, height: '100%',
                background: `linear-gradient(90deg, var(--bear), var(--warn) 50%, var(--bull))`,
                borderRadius: 4, transition: 'width 0.5s ease'
              }} />
            </div>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: sentimentColor, minWidth: 40 }}>
              {(sentiment * 100).toFixed(0)}%
            </span>
          </div>
          <div className="grid-3 gap-2">
            {[
              { label: 'Bullish Articles', value: summary.bullish_count || 0, color: 'var(--bull)' },
              { label: 'Neutral', value: summary.neutral_count || 0, color: 'var(--text-muted)' },
              { label: 'Bearish Articles', value: summary.bearish_count || 0, color: 'var(--bear)' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: 10, background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            ⚠️ Sentiment is auxiliary signal only — never sole entry trigger
          </div>
        </div>
      )}

      {/* Symbol filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button className="btn btn-ghost btn-sm"
          style={!selected ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
          onClick={() => setSelected(null)}>Market</button>
        {SYMBOLS.map(s => (
          <button key={s} className="btn btn-ghost btn-sm"
            style={selected === s ? { borderColor: 'var(--accent-lime-dim)', color: 'var(--accent-lime)' } : {}}
            onClick={() => setSelected(s)}>{s.replace('USDT', '')}</button>
        ))}
      </div>

      {/* Articles */}
      {(selected ? articles : []).length === 0 && selected && (
        <EmptyState icon={<Newspaper size={32} />} message="No news available. Configure CRYPTOPANIC_API_KEY or NEWSAPI_KEY in .env for live news." />
      )}

      {!selected && (
        <div className="card p-4">
          <SectionHeader title="Configure News Sources" />
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
            To enable live news sentiment:<br />
            1. Add <code style={{ color: 'var(--accent-lime)' }}>CRYPTOPANIC_API_KEY</code> to your .env file (free tier available at cryptopanic.com)<br />
            2. Or add <code style={{ color: 'var(--accent-lime)' }}>NEWSAPI_KEY</code> from newsapi.org<br />
            3. Restart the backend server<br /><br />
            <span style={{ color: 'var(--text-muted)' }}>
              The system operates fully without news data. Sentiment is weighted at 7% of the total score
              and never serves as the sole entry trigger.
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {articles.map((article: any, i: number) => (
          <a key={i} href={article.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div className="card p-3" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <div className="flex items-start gap-2">
                <Newspaper size={14} style={{ color: 'var(--accent-lime)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {article.source}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {fmtTime(article.published_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
