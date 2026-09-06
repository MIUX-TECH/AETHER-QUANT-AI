import glob
import re

files = glob.glob('src/components/**/*.tsx', recursive=True)
files.append('src/App.tsx')

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We might have injected className="..." twice:
    # Example: className="card kinetic-card animate-fade-in-up" style={{ animationDelay: "0.15s" }} kinetic-card animate-fade-in-up" style={{ animationDelay: "0.19s", animationFillMode: "forwards", opacity: 0 }}
    # Or multiple classNames. Let's just fix it by looking for duplicated attributes on the same line
    
    # Actually, a simpler way is to just grep the exact error lines and fix them.
    pass
