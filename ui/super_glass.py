import re

with open('src/styles/globals.css', 'r') as f:
    css = f.read()

# Make the background truly cyberpunk and luminous so glassmorphism works
old_bg = r"""  background-image: radial-gradient\(circle at top right, rgba\(0, 240, 255, 0\.05\) 0%, transparent 40%\), radial-gradient\(circle at bottom left, rgba\(163, 230, 53, 0\.05\) 0%, transparent 40%\);"""
new_bg = r"""  background-image: 
    radial-gradient(circle at 15% 10%, rgba(0, 240, 255, 0.15) 0%, transparent 40%), 
    radial-gradient(circle at 85% 90%, rgba(163, 230, 53, 0.15) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(13, 17, 23, 0.5) 0%, transparent 100%);
  background-attachment: fixed;"""

if old_bg in css:
    css = css.replace(old_bg, new_bg)
else:
    # Fallback if regex fails
    css = re.sub(r'background-image: radial-gradient[^;]+;', new_bg, css)

# Make the cards much more "glassy"
old_card = r"""\.card \{
  background: rgba\(13, 17, 23, 0\.6\);
  backdrop-filter: blur\(12px\);
  -webkit-backdrop-filter: blur\(12px\);
  border: 1px solid rgba\(255, 255, 255, 0\.08\);
  border-radius: var\(--radius\);
  box-shadow: var\(--shadow-card\), 0 4px 30px rgba\(0, 0, 0, 0\.1\);
  transition: all 0\.3s cubic-bezier\(0\.16, 1, 0\.3, 1\);
\}"""

new_card = r""".card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.0) 100%), rgba(13, 17, 23, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255,255,255,0.02);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background 0.25s ease;
}"""

if re.search(r'\.card\s*\{[^}]*backdrop-filter:\s*blur\(12px\);[^}]*\}', css):
    css = re.sub(r'\.card\s*\{[^}]*backdrop-filter:\s*blur\(12px\);[^}]*\}', new_card, css)

# Make animation much more distinct
old_anim = r"""@keyframes fade-in-up \{
  0% \{
    opacity: 0;
    transform: translateY\(12px\) scale\(0\.98\);
  \}
  100% \{
    opacity: 1;
    transform: translateY\(0\) scale\(1\);
  \}
\}"""

new_anim = r"""@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}"""

if "transform: translateY(12px) scale(0.98);" in css:
    css = re.sub(r'@keyframes fade-in-up\s*\{[^}]*0%[^}]*100%[^}]*\}', new_anim, css)

with open('src/styles/globals.css', 'w') as f:
    f.write(css)

print("Supercharged Glassmorphism and Animations in CSS")
