import os
import json
from dotenv import load_dotenv
load_dotenv()

from engine.redis_client import RedisManager

def scan():
    redis_mgr = RedisManager()
    if not redis_mgr.is_connected:
        print("REDIS_NOT_CONNECTED")
        return
        
    client = redis_mgr.client
    keys = client.keys('*')
    print(f"Total keys found: {len(keys)}")
    
    result = {}
    for key in keys:
        k_type = client.type(key)
        
        if k_type == 'hash':
            data = redis_mgr.hget_all(key)
            result[key] = {'type': 'hash', 'data': data}
        elif k_type == 'list':
            data = redis_mgr.lrange_json(key, 0, 10) # just first 10
            result[key] = {'type': 'list', 'data': data}
        elif k_type == 'string':
            data = client.get(key)
            result[key] = {'type': 'string', 'data': data}
        else:
            result[key] = {'type': k_type, 'data': '...'}
            
    print("--- REDIS DUMP ---")
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    scan()
