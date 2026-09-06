import sys
with open('/root/binance-ai-trader/api/main.py', 'r') as f:
    lines = f.readlines()

out = []
in_init = False
for line in lines:
    if line.startswith('def init_orchestrator():'):
        out.append(line)
        out.append('    import threading\n')
        out.append('    def do_init():\n')
        out.append('        global orchestrator\n')
        in_init = True
        continue
        
    if in_init:
        if line.startswith('    # Setup scheduler'):
            out.append('    threading.Thread(target=do_init, daemon=True).start()\n')
            out.append(line)
            in_init = False
        else:
            if line.startswith('    '):
                out.append('    ' + line)
            else:
                out.append(line)
    else:
        out.append(line)

with open('/root/binance-ai-trader/api/main.py', 'w') as f:
    f.writelines(out)
