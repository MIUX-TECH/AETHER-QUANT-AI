import re

with open('src/styles/globals.css', 'r') as f:
    css = f.read()

# Make the body use the mesh background
css = re.sub(
    r'body {\n  height: 100%;\n  background: var\(--bg-void\);',
    r'body {\n  height: 100%;\n  background: var(--bg-void);\n  background-image: radial-gradient(circle at top right, rgba(0, 240, 255, 0.05) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(163, 230, 53, 0.05) 0%, transparent 40%);',
    css
)

# Update card to be glassmorphism
old_card = r"""\.card {
  background: var\(--bg-card\);
  border: 1px solid var\(--bg-border\);
  border-radius: var\(--radius\);
  box-shadow: var\(--shadow-card\);
  transition: border-color 0.15s ease;
}"""

new_card = r""".card {
  background: rgba(13, 17, 23, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card), 0 4px 30px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.card:hover {
  background: rgba(13, 17, 23, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-card), 0 8px 30px rgba(0, 0, 0, 0.4);
}"""

css = re.sub(old_card, new_card, css)

# Update unified-header to be glassmorphic
old_header = r"""\.unified-header {
  height: 48px;
  background: var\(--bg-deep\);
  border-bottom: 1px solid var\(--bg-border\);"""

new_header = r""".unified-header {
  height: 48px;
  background: rgba(13, 17, 23, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);"""

css = re.sub(old_header, new_header, css)

with open('src/styles/globals.css', 'w') as f:
    f.write(css)

print("Patched globals.css for Glassmorphism")
