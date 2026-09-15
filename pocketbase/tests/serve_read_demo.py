"""Disposable read/recovery demo. JSON commands on stdin; never opens existing data."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import urllib.error
import urllib.request

from test_booking_http import BookingHTTP

BookingHTTP.setUpClass()
fixture = BookingHTTP()
fault = {"path": "", "status": 503}
payload = fixture.payload()
payload["booking_notes"] = [{"note": f"Original note {i}", "note_translated": f"Review note {i}"} for i in range(31)]
payload["client_preferences"] = [{"note": f"Preference {i}"} for i in range(31)]
_, receipt = fixture.save(payload)
for i in range(31):
    p = fixture.payload()
    p["caller_phone"] = f"+1202555{i+1000:04}"
    p["client"]["name"] = f"Synthetic request {i:02}"
    fixture.save(p)


class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type,ngrok-skip-browser-warning")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.end_headers()

    def forward(self):
        if fault["path"] and fault["path"] in self.path:
            body = b'{"message":"Controlled synthetic fault"}'
            self.send_response(fault["status"])
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        headers = {key:value for key,value in self.headers.items() if key.lower() not in ["host","content-length","connection"]}
        request = urllib.request.Request(BookingHTTP.base+self.path, data=body if body else None, headers=headers, method=self.command)
        try:
            response = urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        try:
            self.send_response(response.status)
            for key,value in response.headers.items():
                if key.lower() not in ["transfer-encoding","connection"]:
                    self.send_header(key,value)
            self.end_headers()
            if response.headers.get("Content-Type", "").startswith("text/event-stream"):
                while chunk := response.read1(4096):
                    self.wfile.write(chunk)
                    self.wfile.flush()
            else:
                self.wfile.write(response.read())
        except (OSError, ValueError):
            pass
        finally:
            response.close()

    do_GET = forward
    do_POST = forward
    do_PATCH = forward


proxy = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
threading.Thread(target=proxy.serve_forever, daemon=True).start()
print(json.dumps({"pocketbase":BookingHTTP.base, "proxy":f"http://127.0.0.1:{proxy.server_port}",
                  "booking_id":receipt["booking_id"], "commands":"fault {path,status}; create {name}; inspect {id}; quit"}), flush=True)
try:
    for line in iter(input, ""):
        command = json.loads(line)
        if command.get("quit"):
            break
        if "fault" in command:
            fault.update(command["fault"])
            print(json.dumps({"fault":fault}), flush=True)
        if "create" in command:
            p = fixture.payload()
            p["client"]["name"] = command["create"]["name"]
            print(json.dumps(fixture.save(p)), flush=True)
        if "inspect" in command:
            status, result = fixture.request("GET", f"/api/collections/bookings/records/{command['inspect']}", token=fixture.owner)
            print(json.dumps({"http":status, "id":result.get("id"), "status":result.get("status")}), flush=True)
except EOFError:
    pass
finally:
    proxy.shutdown()
    proxy.server_close()
    BookingHTTP.doClassCleanups()
