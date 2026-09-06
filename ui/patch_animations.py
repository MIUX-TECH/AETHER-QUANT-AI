import os
import glob

def patch_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)

# 1. Patch DashboardStats to include kinetic-card and animations
patch_file('src/components/dashboard/DashboardStats.tsx', [
    ('className="card card-lime p-3"', 'className="card card-lime p-3 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.1s", opacity: 0 }}'),
    ('className="card p-3"', 'className="card p-3 kinetic-card animate-fade-in-up" style={{ borderLeft: \'3px solid #00F0FF\', background: \'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(13, 17, 23, 0.5))\', animationDelay: "0.2s", opacity: 0 }}'),
    # Fix the duplicated style from previous replace if any, wait, it has style={{borderLeft...}} already. Let's do regex instead for the cyan card.
])

import re

with open('src/components/dashboard/DashboardStats.tsx', 'r') as f:
    stats_content = f.read()

stats_content = re.sub(
    r'<div className="card p-3" style=\{\{ borderLeft: \'3px solid #00F0FF\', background: \'linear-gradient\(135deg, rgba\(0,240,255,0\.1\), rgba\(13, 17, 23, 0\.5\)\)\' \}\}>',
    r'<div className="card p-3 kinetic-card animate-fade-in-up" style={{ borderLeft: \'3px solid #00F0FF\', background: \'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(13, 17, 23, 0.5))\', animationDelay: "0.15s", animationFillMode: "forwards", opacity: 0 }}>',
    stats_content
)
stats_content = stats_content.replace(
    'className="card card-lime p-3 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.1s", opacity: 0 }}',
    'className="card card-lime p-3 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.05s", animationFillMode: "forwards", opacity: 0 }}'
)
# Ensure StatCards get animation delays if possible. Actually StatCard is imported. Let's patch StatCard instead.
with open('src/components/dashboard/DashboardStats.tsx', 'w') as f:
    f.write(stats_content)


# 2. Patch shared/index.tsx for StatCard
try:
    with open('src/components/shared/index.tsx', 'r') as f:
        shared_content = f.read()
    
    shared_content = shared_content.replace(
        'className="card p-3"',
        'className="card p-3 kinetic-card animate-fade-in-up" style={{ animationFillMode: "forwards", opacity: 0, animationDelay: (Math.random() * 0.2 + 0.1).toFixed(2) + "s" }}'
    )
    with open('src/components/shared/index.tsx', 'w') as f:
        f.write(shared_content)
except FileNotFoundError:
    pass


# 3. Patch AiCopilotFng
with open('src/components/dashboard/AiCopilotFng.tsx', 'r') as f:
    ai_content = f.read()
ai_content = ai_content.replace(
    'className="card p-4"',
    'className="card p-4 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.2s", animationFillMode: "forwards", opacity: 0 }}'
)
with open('src/components/dashboard/AiCopilotFng.tsx', 'w') as f:
    f.write(ai_content)


# 4. Patch EquityCurveHedge
with open('src/components/dashboard/EquityCurveHedge.tsx', 'r') as f:
    eq_content = f.read()
eq_content = eq_content.replace(
    'className="card p-4"',
    'className="card p-4 kinetic-card animate-fade-in-up" style={{ animationDelay: "0.25s", animationFillMode: "forwards", opacity: 0 }}'
)
with open('src/components/dashboard/EquityCurveHedge.tsx', 'w') as f:
    f.write(eq_content)


# 5. Patch ActivePositionsTable
with open('src/components/dashboard/ActivePositionsTable.tsx', 'r') as f:
    pos_content = f.read()
pos_content = pos_content.replace(
    'className="card"',
    'className="card animate-fade-in-up" style={{ animationDelay: "0.3s", animationFillMode: "forwards", opacity: 0 }}'
)
with open('src/components/dashboard/ActivePositionsTable.tsx', 'w') as f:
    f.write(pos_content)


# 6. Patch TopSignalsList
with open('src/components/dashboard/TopSignalsList.tsx', 'r') as f:
    sig_content = f.read()
sig_content = sig_content.replace(
    'className="card"',
    'className="card animate-fade-in-up" style={{ animationDelay: "0.35s", animationFillMode: "forwards", opacity: 0 }}'
)
with open('src/components/dashboard/TopSignalsList.tsx', 'w') as f:
    f.write(sig_content)

print("Applied staggered animations and kinetic-card to Dashboard components")
