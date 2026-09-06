import requests
url = "https://aether-quant-api-sg.onrender.com/api/status"
headers = {"Authorization": "Bearer ppaepkbzkpdnxwygzhwjwqyqgifftcjj"}
r = requests.get(url, headers=headers)
print("Status:", r.status_code)
