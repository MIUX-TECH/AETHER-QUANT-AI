import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add Menu to lucide-react imports if not there
if 'Menu' not in content:
    content = re.sub(r'LayoutDashboard, Wallet, ScanSearch, Settings\s*\} from \'lucide-react\'', 
                     r'LayoutDashboard, Wallet, ScanSearch, Settings, Menu, X, Brain } from \'lucide-react\'', content)

# Import TABS
if 'TABS' not in content:
    content = re.sub(r"import Navigation from '\./components/shared/Navigation'", 
                     r"import Navigation, { TABS } from './components/shared/Navigation'", content)

# Add showMobileMenu state
if 'showMobileMenu' not in content:
    content = re.sub(r'const \[showModeModal, setShowModeModal\] = useState\(false\)',
                     r'const [showModeModal, setShowModeModal] = useState(false)\n  const [showMobileMenu, setShowMobileMenu] = useState(false)', content)

# Replace Mobile Bottom Navigation block
nav_block = r"""      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 border-t flex justify-around items-center h-14" style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-border)' }}>
        <NavLink to="/dashboard" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <LayoutDashboard size={18} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>Dashboard</span>
        </NavLink>
        <NavLink to="/portfolio" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Wallet size={18} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>Portfolio</span>
        </NavLink>
        <NavLink to="/scanner" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <ScanSearch size={18} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>Scanner</span>
        </NavLink>
        <NavLink to="/settings" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Settings size={18} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>Settings</span>
        </NavLink>
      </nav>"""

new_nav_block = r"""      {/* Kinetic Smart Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 border-t flex justify-around items-center h-14" style={{ background: 'rgba(13, 17, 23, 0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--bg-border)' }}>
        <NavLink to="/dashboard" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <LayoutDashboard size={20} className={location.pathname.includes('dashboard') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('dashboard') ? 800 : 500 }}>Dasbor</span>
        </NavLink>
        <NavLink to="/portfolio" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Wallet size={20} className={location.pathname.includes('portfolio') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('portfolio') ? 800 : 500 }}>Portofolio</span>
        </NavLink>
        <NavLink to="/scanner" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <ScanSearch size={20} className={location.pathname.includes('scanner') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('scanner') ? 800 : 500 }}>Pemindai</span>
        </NavLink>
        <NavLink to="/ai" onClick={() => setShowMobileMenu(false)} className={({isActive}) => `kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-lime-400' : 'text-gray-500'}`} style={({isActive}) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}>
          <Brain size={20} className={location.pathname.includes('ai') ? 'animate-pulse-glow rounded-full' : ''} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: location.pathname.includes('ai') ? 800 : 500 }}>Log AI</span>
        </NavLink>
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className={`kinetic-card flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${showMobileMenu ? 'text-cyan-400' : 'text-gray-500'}`} style={{ color: showMobileMenu ? 'var(--cyan)' : 'var(--text-muted)' }}>
          {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: showMobileMenu ? 800 : 500 }}>Menu</span>
        </button>
      </nav>

      {/* Cyberpunk Mobile Bottom Sheet Drawer */}
      <div 
        className="md:hidden fixed z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          inset: 0,
          top: showMobileMenu ? 0 : '100%',
          background: 'rgba(8, 10, 13, 0.4)',
          backdropFilter: 'blur(8px)',
          opacity: showMobileMenu ? 1 : 0,
          pointerEvents: showMobileMenu ? 'auto' : 'none',
        }}
        onClick={() => setShowMobileMenu(false)}
      >
        <div 
          className="absolute bottom-14 left-0 right-0 p-4 border-t border-border"
          style={{
            background: 'var(--bg-deep)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: '0 -10px 40px rgba(0,240,255,0.1)',
            transform: showMobileMenu ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Terminal Menu</h3>
            <button className="btn btn-ghost btn-xs kinetic-card" onClick={() => setShowMobileMenu(false)}><X size={16} /></button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-2">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon
              const active = location.pathname.includes(tab.id)
              return (
                <NavLink
                  key={tab.id}
                  to={`/${tab.id}`}
                  onClick={() => setShowMobileMenu(false)}
                  className="kinetic-card flex items-center gap-3 p-3 rounded-lg border border-border"
                  style={{
                    background: active ? 'var(--bg-card2)' : 'var(--bg-card)',
                    borderColor: active ? 'var(--accent)' : 'var(--bg-border)',
                    animationDelay: `${idx * 0.05}s`,
                    opacity: 0,
                    animation: showMobileMenu ? 'var(--animate-fade-in-up)' : 'none'
                  }}
                >
                  <Icon size={16} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {tab.label}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </div>
      </div>"""

content = content.replace(nav_block, new_nav_block)

with open('src/App.tsx', 'w') as f:
    f.write(content)
