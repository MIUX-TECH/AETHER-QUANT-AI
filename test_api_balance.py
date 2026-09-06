import os
import sys
sys.path.append("/root/binance-ai-trader")

try:
    from api.dns_patch import apply_patch
    apply_patch()
except Exception as e:
    print(f"DNS patch failed: {e}")

from engine.execution.binance_executor import BinanceExecutor

def test_api():
    executor = BinanceExecutor()
    print("Testing Spot Balances:")
    try:
        spot = executor.get_account_balances()
        print(f"Spot raw response keys: {spot.keys()}")
    except Exception as e:
        print(f"Spot Error: {e}")
        
    print("\nTesting Futures Account:")
    try:
        futures = executor.get_futures_account()
        print(f"Futures totalMarginBalance: {futures.get('totalMarginBalance')}")
        if not futures:
            print("Futures account returned empty dict. Is futures enabled on API key?")
            print(f"Full response: {futures}")
    except Exception as e:
        print(f"Futures Error: {e}")

if __name__ == "__main__":
    test_api()