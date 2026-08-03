import urllib.request, time

url = "http://192.168.10.101:11434/v1/models"
print(f"Testing {url} ...")
t0 = time.time()
try:
    req = urllib.request.Request(url, method="GET")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        data = resp.read().decode("utf-8")
        print(f"Success! Status: {resp.status}, Time: {time.time()-t0:.2f}s")
        print("Data snippet:", data[:100])
except Exception as e:
    print(f"Failed: {e}, Time: {time.time()-t0:.2f}s")
