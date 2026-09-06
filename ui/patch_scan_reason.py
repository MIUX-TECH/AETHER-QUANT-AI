import os
with open('src/components/scanner/ScannerPage.tsx', 'r') as f:
    scan = f.read()

old_hook = r"""              <div className="p-2 rounded bg-black/20 border border-border">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bull)', marginBottom: 3 }}>Faktor Bullish:</div>"""

new_hook = r"""              <div className="col-span-2 p-2 rounded bg-black/20 border border-border mb-1">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>AI Reasoning:</div>
                <div style={{ fontSize: 10, color: 'var(--text-primary)' }}>{selectedSymbol.reasoning || 'N/A'}</div>
              </div>
              <div className="p-2 rounded bg-black/20 border border-border">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bull)', marginBottom: 3 }}>Faktor Bullish:</div>"""

scan = scan.replace(old_hook, new_hook)

with open('src/components/scanner/ScannerPage.tsx', 'w') as f:
    f.write(scan)
print("Patched ScannerPage reasoning")
