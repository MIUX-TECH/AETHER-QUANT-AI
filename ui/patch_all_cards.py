import os
import glob
import re
import random

components_dir = 'src/components'
files = glob.glob(f'{components_dir}/**/*.tsx', recursive=True)
patched_count = 0

def add_animation_with_style(match):
    class_name = match.group(1)
    style_attr = match.group(2)
    if 'animate-fade-in-up' in class_name:
        return match.group(0)
    new_class = class_name
    if 'kinetic-card' not in new_class:
        new_class += ' kinetic-card'
    new_class += ' animate-fade-in-up'
    delay = round(random.uniform(0.1, 0.4), 2)
    
    inner_style = style_attr[8:-2].strip()
    if inner_style:
        new_style = f'style={{{{ {inner_style}, animationDelay: "{delay}s", animationFillMode: "forwards", opacity: 0 }}}}'
    else:
        new_style = f'style={{{{ animationDelay: "{delay}s", animationFillMode: "forwards", opacity: 0 }}}}'
    return f'className="{new_class}" {new_style}'

def add_animation_no_style(match):
    class_name = match.group(1)
    if 'animate-fade-in-up' in class_name:
        return match.group(0)
    new_class = class_name
    if 'kinetic-card' not in new_class:
        new_class += ' kinetic-card'
    new_class += ' animate-fade-in-up'
    delay = round(random.uniform(0.1, 0.4), 2)
    return f'className="{new_class}" style={{{{ animationDelay: "{delay}s", animationFillMode: "forwards", opacity: 0 }}}}'

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
        
    new_content = re.sub(
        r'className="([^"]*card[^"]*)"\s+(style=\{\{[^}]+\}\})',
        add_animation_with_style,
        content
    )
    new_content = re.sub(
        r'className="([^"]*card[^"]*)"(?!\s+style=)',
        add_animation_no_style,
        new_content
    )
    new_content = new_content.replace(
        "background: 'linear-gradient(135deg, rgba(0,240,255,0.04), var(--bg-card))'",
        "background: 'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(13, 17, 23, 0.5))'"
    )
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        patched_count += 1

print(f"Patched {patched_count} files to include animations globally.")
