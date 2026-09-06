import re

with open('src/components/dashboard/DashboardStats.tsx', 'r') as f:
    code = f.read()

# Replace solid card-lime inline background with transparent
code = code.replace(
    "background: 'linear-gradient(135deg, rgba(163, 230, 53, 0.04), var(--bg-card))'",
    "background: 'linear-gradient(135deg, rgba(163, 230, 53, 0.1), rgba(13, 17, 23, 0.5))'"
)
# Also fix the cyan card
code = code.replace(
    "background: 'linear-gradient(135deg, rgba(0,240,255,0.04), var(--bg-card))'",
    "background: 'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(13, 17, 23, 0.5))'"
)

with open('src/components/dashboard/DashboardStats.tsx', 'w') as f:
    f.write(code)

# Let's also check if globals.css has solid card-lime
with open('src/styles/globals.css', 'r') as f:
    css = f.read()

css = css.replace(
    "background: linear-gradient(135deg, rgba(163, 230, 53, 0.04), var(--bg-card));",
    "background: linear-gradient(135deg, rgba(163, 230, 53, 0.1), rgba(13, 17, 23, 0.4));"
)
css = css.replace(
    "background: linear-gradient(135deg, rgba(0, 240, 255, 0.04), var(--bg-card));",
    "background: linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(13, 17, 23, 0.4));"
)
with open('src/styles/globals.css', 'w') as f:
    f.write(css)

print("Patched components and globals for fully transparent gradient cards")
