with open('src/components/dashboard/DashboardStats.tsx', 'r') as f:
    stats_content = f.read()

stats_content = stats_content.replace(
    'className="mono font-bold" style={{ fontSize: 20, color: \'var(--accent)\', marginTop: 3 }}',
    'className="mono font-bold animate-pulse-glow" style={{ fontSize: 20, color: \'var(--accent)\', marginTop: 3 }}'
)
stats_content = stats_content.replace(
    'className="mono font-bold" style={{ fontSize: 17, color: \'#00F0FF\', marginTop: 3 }}',
    'className="mono font-bold data-shimmer" style={{ fontSize: 17, marginTop: 3 }}'
)

with open('src/components/dashboard/DashboardStats.tsx', 'w') as f:
    f.write(stats_content)
print("Patched DashboardStats for text shimmer/pulse")
