import glob
import re

files = glob.glob('src/components/**/*.tsx', recursive=True)

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # replace tailwind class bg-deep with bg-black/20
    new_content = re.sub(r'\bbg-deep\b', 'bg-black/20', content)
    
    # replace inline styles
    new_content = new_content.replace(
        "background: 'var(--bg-deep)'", 
        "background: 'rgba(0,0,0,0.2)'"
    )
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
print("Patched bg-deep to transparent")
