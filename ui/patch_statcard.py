with open('src/components/shared/index.tsx', 'r') as f:
    shared_content = f.read()

shared_content = shared_content.replace(
    "const cardBorder = accent ? 'card card-lime' : warn ? 'card' : danger ? 'card' : 'card'",
    "const cardBorder = (accent ? 'card card-lime' : 'card') + ' kinetic-card animate-fade-in-up'"
)
shared_content = shared_content.replace(
    '<div className={`${cardBorder}`} style={{ display: \'flex\', flexDirection: \'column\', justifyContent: \'space-between\' }}>',
    '<div className={`${cardBorder}`} style={{ display: \'flex\', flexDirection: \'column\', justifyContent: \'space-between\', animationDelay: (Math.random() * 0.2 + 0.1).toFixed(2) + "s", animationFillMode: "forwards", opacity: 0 }}>'
)

with open('src/components/shared/index.tsx', 'w') as f:
    f.write(shared_content)
