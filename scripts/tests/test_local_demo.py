"""Exercise the launcher through its CLI and real disposable PocketBase HTTP API."""

import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


class LocalDemo(unittest.TestCase):
    def test_isolated_frontends_allow_sign_in_again_with_a_stale_cookie(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary) / "run"
            listeners = [socket.socket() for _ in range(3)]
            try:
                for listener in listeners:
                    listener.bind(("127.0.0.1", 0))
                ports = [listener.getsockname()[1] for listener in listeners]
            finally:
                for listener in listeners:
                    listener.close()
            process = subprocess.Popen(
                [
                    sys.executable,
                    str(ROOT / "scripts/local_demo.py"),
                    "--without-worker",
                    "--pocketbase-port",
                    str(ports[0]),
                    "--caller-port",
                    str(ports[1]),
                    "--dashboard-port",
                    str(ports[2]),
                    "--run-dir",
                    str(run),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            try:
                for _ in range(900):
                    if (run / "ready.json").exists() or process.poll() is not None:
                        break
                    time.sleep(0.1)
                self.assertTrue(
                    (run / "ready.json").exists(), "Stack did not become ready"
                )
                ready = json.loads((run / "ready.json").read_text())
                request = urllib.request.Request(
                    ready["dashboard"] + "/login",
                    headers={
                        "Cookie": "cleanvoice_cleaner_token=expired; cleanvoice_cleaner_id=oldcleaner"
                    },
                )
                with urllib.request.urlopen(request) as response:
                    self.assertEqual(response.url, ready["dashboard"] + "/login")
                    self.assertIn('name="password"', response.read().decode())
                self.assertFalse(ready["worker_started"])
                self.assertFalse(list((run / "dashboard").glob(".env*")))
            finally:
                process.terminate()
                output, _ = process.communicate(timeout=30)
            self.assertEqual(process.returncode, 0, output)
            for port in ports:
                with socket.socket() as connection:
                    self.assertNotEqual(connection.connect_ex(("127.0.0.1", port)), 0)

    def test_fresh_backend_has_two_owners_and_preserves_data_after_shutdown(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary) / "run"
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]
            process = subprocess.Popen(
                [
                    sys.executable,
                    str(ROOT / "scripts/local_demo.py"),
                    "--backend-only",
                    "--pocketbase-port",
                    str(port),
                    "--run-dir",
                    str(run),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            try:
                for _ in range(200):
                    if (run / "ready.json").exists() or process.poll() is not None:
                        break
                    time.sleep(0.05)
                self.assertTrue(
                    (run / "ready.json").exists(), "Launcher did not become ready"
                )
                ready = json.loads((run / "ready.json").read_text())
                credentials = json.loads((run / "login.json").read_text())
                tokens = {}
                for email in ("cleaner@example.test", "other@example.test"):
                    request = urllib.request.Request(
                        ready["pocketbase"]
                        + "/api/collections/users/auth-with-password",
                        data=json.dumps(
                            {"identity": email, "password": credentials[email]}
                        ).encode(),
                        headers={"Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(request) as response:
                        token = json.load(response)["token"]
                    tokens[email] = token
                    request = urllib.request.Request(
                        ready["pocketbase"] + "/api/collections/bookings/records",
                        headers={"Authorization": token},
                    )
                    with urllib.request.urlopen(request) as response:
                        self.assertEqual(json.load(response)["totalItems"], 0)
                self.assertEqual(ready["caller_phone"], "+12025550102")
                self.assertEqual((run.stat().st_mode & 0o777), 0o700)
                payload = {
                    "submission_id": "acceptance-inspector-test",
                    "reviewed": True,
                    "caller_phone": "+12025550102",
                    "client": {"name": "Synthetic Caller"},
                    "address": {
                        "street": "Testweg 1",
                        "postal_code": "10115",
                        "city": "Berlin",
                        "country": "DE",
                    },
                    "booking": {
                        "start_time": "2099-01-15T10:00:00",
                        "timezone": "Europe/Berlin",
                        "estimated_hours": 2,
                        "service_type": "regular_cleaning",
                    },
                    "booking_notes": [
                        {"note": "Testnotiz", "note_translated": "Test note"}
                    ],
                }
                request = urllib.request.Request(
                    ready["pocketbase"] + "/api/cleanvoice/create-booking",
                    data=json.dumps(payload).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": tokens["cleaner@example.test"],
                    },
                )
                with urllib.request.urlopen(request) as response:
                    receipt = json.load(response)
                command = [
                    sys.executable,
                    str(ROOT / "scripts/verify_demo_booking.py"),
                    "--run-dir",
                    str(run),
                    "--booking",
                    receipt["booking_id"],
                    "--status",
                    "requested",
                    "--budget",
                    "unknown",
                    "--source",
                    "dashboard",
                    "--count",
                ]
                verified = subprocess.run(
                    [*command, "1"], capture_output=True, text=True
                )
                self.assertEqual(verified.returncode, 0, verified.stderr)
                self.assertEqual(
                    json.loads(verified.stdout)["owner_isolation"], "passed"
                )
                duplicate = subprocess.run(
                    [*command, "2"], capture_output=True, text=True
                )
                self.assertNotEqual(duplicate.returncode, 0)
                request = urllib.request.Request(
                    ready["pocketbase"]
                    + "/api/collections/_superusers/auth-with-password",
                    data=json.dumps(
                        {
                            "identity": "admin@example.test",
                            "password": credentials["admin@example.test"],
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(request) as response:
                    admin = json.load(response)["token"]
                request = urllib.request.Request(
                    ready["pocketbase"]
                    + "/api/collections/bookings/records/"
                    + receipt["booking_id"],
                    method="PATCH",
                    data=b'{"service_type":"deep_cleaning"}',
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": admin,
                    },
                )
                with urllib.request.urlopen(request):
                    pass
                corrupted = subprocess.run(
                    [*command, "1"], capture_output=True, text=True
                )
                self.assertNotEqual(
                    corrupted.returncode,
                    0,
                    "Mismatched persisted service passed verification",
                )
            finally:
                process.terminate()
                output, _ = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 0, output)
            self.assertTrue((run / "data/data.db").exists())
            with socket.socket() as connection:
                self.assertNotEqual(connection.connect_ex(("127.0.0.1", port)), 0)
            retry = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/local_demo.py"),
                    "--backend-only",
                    "--run-dir",
                    str(run),
                ],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(retry.returncode, 0)
            self.assertIn("already exists", retry.stderr)
            for password in credentials.values():
                self.assertNotIn(password, output)


if __name__ == "__main__":
    unittest.main()
