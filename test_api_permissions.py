import os, sys
sys.path.append("/root/binance-ai-trader")
from api.dns_patch import apply_patch
apply_patch()
from engine.execution.binance_executor import BinanceExecutor
executor = BinanceExecutor()
print("Spot Account status:")
st, data = executor._send_signed("GET", f"{executor.base_url}/api/v3/account")
print(st, {k: data[k] for k in data if k != 'balances'} if isinstance(data, dict) else data)
print("\nFutures Account status:")
st, data = executor._send_signed("GET", f"{executor.futures_url}/fapi/v2/account")
print(st, data)
