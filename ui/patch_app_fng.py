with open('src/App.tsx', 'r') as f:
    app_content = f.read()

# Let's find where to add Fear & Greed in App.tsx
old_str = r"""              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                {(!system || loading) ? 'SYNCING' : 'ONLINE'}
              </span>
            </div>"""

new_str = r"""              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                {(!system || loading) ? 'SYNCING' : 'ONLINE'}
              </span>
            </div>
            
            {/* Global Fear & Greed Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 ml-4 px-2 py-0.5 rounded border border-border" style={{ background: 'rgba(255,255,255,0.03)' }}>
               <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>F&G:</span>
               <span style={{ fontSize: 10, fontWeight: 700, color: (system?.fear_greed?.value >= 75) ? 'var(--bull)' : (system?.fear_greed?.value <= 25) ? 'var(--bear)' : 'var(--warn)' }}>
                 {system?.fear_greed?.value || 50} ({system?.fear_greed?.class || 'Neutral'})
               </span>
            </div>"""

app_content = app_content.replace(old_str, new_str)

with open('src/App.tsx', 'w') as f:
    f.write(app_content)
