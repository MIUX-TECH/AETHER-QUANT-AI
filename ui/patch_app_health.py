with open('src/App.tsx', 'r') as f:
    app_content = f.read()

# Replace hardcoded dot with dynamic health dot
app_content = app_content.replace(
    "<span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bull)', boxShadow: '0 0 8px var(--bull)' }} />",
    "<span style={{ width: 7, height: 7, borderRadius: '50%', background: (!system || loading) ? 'var(--warn)' : 'var(--bull)', boxShadow: (!system || loading) ? '0 0 8px var(--warn)' : '0 0 8px var(--bull)' }} />"
)

# Also let's show the actual health text next to it
app_content = app_content.replace(
    "AETHER\n              </span>",
    "AETHER\n              </span>\n              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>\n                {(!system || loading) ? 'SYNCING' : 'ONLINE'}\n              </span>"
)

with open('src/App.tsx', 'w') as f:
    f.write(app_content)
