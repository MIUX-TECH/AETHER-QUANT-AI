import os
import re

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()
    new_content = content.replace(old, new)
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Patched {filepath}")

# 1. App.tsx
app_path = 'src/App.tsx'
replace_in_file(app_path, "background: 'var(--bg-deep)'", "background: 'rgba(13, 17, 23, 0.4)'")
replace_in_file(app_path, "background: active ? 'var(--bg-card2)' : 'var(--bg-card)'", "background: active ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)'")
replace_in_file(app_path, "style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-border)'", "style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)'")

# 2. AiCopilotFng.tsx
replace_in_file('src/components/dashboard/AiCopilotFng.tsx', "var(--bg-card)", "rgba(13,17,23,0.5)")

# 3. EquityCurveHedge.tsx
replace_in_file('src/components/dashboard/EquityCurveHedge.tsx', "background: 'var(--bg-card2)'", "background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(8px)'")
replace_in_file('src/components/dashboard/EquityCurveHedge.tsx', "className=\"h-64 w-full mt-4 bg-black/20 rounded-md border border-border p-2\"", "className=\"h-64 w-full mt-4 bg-black/20 backdrop-blur-md rounded-md border border-border p-2\"")

# 4. TopSignalsList.tsx
top_signals = 'src/components/dashboard/TopSignalsList.tsx'
replace_in_file(top_signals, 'stroke="#333"', 'stroke="var(--bg-border)"')
replace_in_file(top_signals, "fill: '#888'", "fill: 'var(--text-muted)'")
replace_in_file(top_signals, 'stroke="#00f0ff" fill="#00f0ff"', 'stroke="var(--cyan)" fill="var(--cyan)"')
replace_in_file(top_signals, 'bg-black/20 rounded-md border border-gray-800/50', 'bg-black/20 backdrop-blur-md rounded-md border border-border')

# 5. PositionsPage.tsx
pos = 'src/components/positions/PositionsPage.tsx'
replace_in_file(pos, 'className="card p-3"', 'className="card p-3 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.2s" }}')
replace_in_file(pos, "var(--bg-card)", "rgba(13,17,23,0.5)")

# 6. AIDecisionsPage.tsx
ai = 'src/components/ai/AIDecisionsPage.tsx'
replace_in_file(ai, 'className="card"', 'className="card kinetic-card animate-fade-in-up" style={{ animationDelay: "0.15s" }}')

# 7. SettingsPage.tsx
sett = 'src/components/settings/SettingsPage.tsx'
replace_in_file(sett, 'className={`card ${isAuthVerified ? \'card-lime\' : \'\'} p-2.5`}', 'className={`card ${isAuthVerified ? \'card-lime\' : \'\'} p-2.5 kinetic-card animate-fade-in-up`} style={{ animationDelay: "0.1s" }}')

# 8. ScannerPage.tsx (Add reasoning to Modal)
with open('src/components/scanner/ScannerPage.tsx', 'r') as f:
    scan = f.read()

# Let's inject reasoning into the Deep Dive Modal
scan_reasoning_old = r"""          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <h4 className="text-[10px] uppercase text-green-500/80 font-bold mb-1 tracking-wider">Bullish Factors</h4>"""

scan_reasoning_new = r"""          <div className="mb-3">
            <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1 tracking-wider">AI Reasoning</h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              {item.reasoning || 'Tidak ada penjelasan AI tersedia.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <h4 className="text-[10px] uppercase text-green-500/80 font-bold mb-1 tracking-wider">Bullish Factors</h4>"""
if scan_reasoning_old in scan:
    scan = scan.replace(scan_reasoning_old, scan_reasoning_new)
    with open('src/components/scanner/ScannerPage.tsx', 'w') as f:
        f.write(scan)
    print("Patched ScannerPage.tsx reasoning")

