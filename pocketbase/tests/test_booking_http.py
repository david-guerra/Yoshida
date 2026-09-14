"""Real HTTP contract tests; starts only disposable PocketBase 0.39.4 data."""
import copy
import concurrent.futures
import json
from http.client import RemoteDisconnected
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


class BookingHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="yoshida-booking-")
        cls.data = Path(cls.tmp.name) / "data"
        cls.migrations = Path(cls.tmp.name) / "migrations"
        cls.migrations.mkdir()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        cls.env = {**os.environ, "PB_ADMIN_EMAIL": "admin@example.test",
                   "PB_ADMIN_PASSWORD": "synthetic-admin-password",
                   "CLEANVOICE_DEMO_PASSWORD": "synthetic-cleaner-password",
                   "POCKETBASE_URL": cls.base, "CLEANVOICE_CLEANER_ID": "syntheticclean1"}
        args = [str(ROOT / "pocketbase"), f"--dir={cls.data}",
                f"--migrationsDir={cls.migrations}", f"--hooksDir={ROOT / 'pb_hooks'}"]
        subprocess.run([*args, "superuser", "upsert", cls.env["PB_ADMIN_EMAIL"],
                        cls.env["PB_ADMIN_PASSWORD"]], check=True, capture_output=True, env=cls.env)
        cls.args = args
        cls.port = port
        cls.log = open(Path(cls.tmp.name) / "server.log", "w+")
        cls.server = subprocess.Popen([*args, "serve", f"--http=127.0.0.1:{port}"],
                                      env=cls.env, stdout=cls.log, stderr=cls.log)
        cls.addClassCleanup(cls.cleanup)
        for _ in range(100):
            try:
                if cls.request("GET", "/api/health")[0] == 200:
                    break
            except OSError:
                pass
            time.sleep(.05)
        cls.setup_schema()
        cls.admin = cls.login("_superusers", cls.env["PB_ADMIN_EMAIL"], cls.env["PB_ADMIN_PASSWORD"])
        cls.owner = cls.login("users", "cleaner@example.test", cls.env["CLEANVOICE_DEMO_PASSWORD"])
        _, cleaners = cls.request("GET", "/api/collections/cleaners/records", token=cls.admin)
        cls.cleaner = cleaners["items"][0]
        # Older setup generates an id; keep the configured id stable in the fixture.
        if cls.cleaner["id"] != "syntheticclean1":
            old = cls.cleaner
            cls.request("DELETE", f"/api/collections/cleaners/records/{old['id']}", token=cls.admin)
            cls.cleaner = cls.create("cleaners", {**old, "id": "syntheticclean1"})
        user = cls.create("users", {"email": "other@example.test", "password": "synthetic-other-password",
                                    "passwordConfirm": "synthetic-other-password"})
        cls.other_cleaner = cls.create("cleaners", {"user": user["id"], "name": "Other", "active": True})
        cls.other = cls.login("users", "other@example.test", "synthetic-other-password")

    @classmethod
    def cleanup(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)
        cls.log.close()
        cls.tmp.cleanup()

    @classmethod
    def setup_schema(cls):
        result = subprocess.run(["python3", str(ROOT / "setup_pb.py")], env=cls.env,
                                capture_output=True, text=True)
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)

    @classmethod
    def request(cls, method, path, body=None, token=None, recovery=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        if recovery:
            headers["X-Submission-Token"] = recovery
        req = urllib.request.Request(cls.base + path, method=method, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.status, json.loads(response.read() or "{}")
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or "{}")

    @classmethod
    def login(cls, collection, email, password):
        status, data = cls.request("POST", f"/api/collections/{collection}/auth-with-password",
                                   {"identity": email, "password": password})
        assert status == 200, data
        return data["token"]

    @classmethod
    def create(cls, collection, body):
        status, data = cls.request("POST", f"/api/collections/{collection}/records", body, cls.admin)
        assert status == 200, data
        return data

    def payload(self):
        return {"submission_id": str(uuid.uuid4()), "reviewed": True,
                "caller_phone": "+12025550102", "client": {"name": "Synthetic Caller"},
                "address": {"street": "Testweg 1", "postal_code": "10115", "city": "Berlin", "country": "DE"},
                "booking": {"start_time": "2099-01-15T10:00:00", "timezone": "Europe/Berlin",
                            "estimated_hours": 2, "service_type": "regular_cleaning"},
                "booking_notes": [{"note": "Testnotiz", "note_translated": "Test note"}],
                "client_preferences": [{"note": "Testwunsch", "note_translated": "Test preference"}]}

    def save(self, payload, token=None, recovery=None):
        return self.request("POST", "/api/cleanvoice/create-booking", payload, token or self.owner, recovery)

    def record(self, collection, record_id):
        status, data = self.request("GET", f"/api/collections/{collection}/records/{record_id}", token=self.admin)
        self.assertEqual(status, 200, data)
        return data

    def counts(self):
        return {name: self.request("GET", f"/api/collections/{name}/records?perPage=1", token=self.admin)[1]["totalItems"]
                for name in ["clients", "addresses", "bookings", "booking_notes", "client_preferences"]}

    def test_invalid_manual_session_does_not_fall_back_to_voice_submission(self):
        before = self.counts()
        status, result = self.request("POST", "/api/cleanvoice/create-booking",
                                      self.payload(), token="expired-session")
        self.assertEqual(status, 401)
        self.assertEqual(result["message"], "Your cleaner session has expired. Sign in again.")
        self.assertEqual(self.counts(), before)
        status, result = self.request("GET", "/api/cleanvoice/submissions/expired-session-test", token="expired-session")
        self.assertEqual(status, 401)
        self.assertIn("Sign in again", result["message"])

    def test_same_submission_and_concurrent_retries_return_one_complete_booking(self):
        payload = self.payload()
        before = self.counts()
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: self.save(payload), range(6)))
        for status, data in results:
            self.assertEqual(status, 200, data)
        self.assertEqual(len({data["booking_id"] for _, data in results}), 1)
        booking = self.record("bookings", results[0][1]["booking_id"])
        self.assertEqual(booking["status"], "requested")
        self.assertEqual(booking["start_time"], "2099-01-15 09:00:00.000Z")
        self.assertEqual(booking["end_time"], "2099-01-15 11:00:00.000Z")
        for name in ["addresses", "bookings", "booking_notes", "client_preferences"]:
            self.assertEqual(self.counts()[name], before[name] + 1)
        self.assertIn("Test note", booking["cleaner_briefing"])
        self.assertIn("Test note", booking["customer_summary"])
        self.assertNotIn("Testnotiz", booking["cleaner_briefing"])
        _, notes = self.request("GET", f"/api/collections/booking_notes/records?filter=booking='{booking['id']}'", token=self.admin)
        self.assertEqual(notes["items"][0]["note"], "Testnotiz")
        self.assertEqual(notes["items"][0]["note_translated"], "Test note")
        self.assertEqual(booking["request_snapshot"]["client"]["name"], "Synthetic Caller")
        self.assertFalse(booking["budget_known"])
        self.assertFalse(booking["price_known"])
        changed = copy.deepcopy(payload)
        changed["address"]["street"] = "Different 2"
        self.assertEqual(self.save(changed)[0], 409)

    def test_invalid_related_write_rolls_back_existing_client_changes(self):
        p = self.payload()
        status, receipt = self.save(p)
        self.assertEqual(status, 200, receipt)
        client_id = self.record("bookings", receipt["booking_id"])["client"]
        before_client = self.record("clients", client_id)
        before = self.counts()
        p["submission_id"] = str(uuid.uuid4())
        p["client"]["name"] = "Must roll back"
        p["client_preferences"][0]["note"] = "x" * 2001
        self.assertEqual(self.save(p)[0], 400)
        self.assertEqual(self.counts(), before)
        self.assertEqual(self.record("clients", client_id), before_client)

    def test_required_intake_and_berlin_dates_reject_without_writes(self):
        cases = [("client", "name", ""), ("address", "postal_code", ""),
                 ("address", "country", ""), ("booking", "service_type", ""),
                 ("booking", "estimated_hours", 0), ("booking", "estimated_hours", "2"),
                 ("booking", "start_time", "2099-02-30T10:00:00"),
                 ("booking", "start_time", "2000-01-01T10:00:00"),
                 ("booking", "start_time", "2099-03-29T02:30:00"),
                 ("booking", "start_time", "2099-10-25T02:30:00")]
        for section, key, value in cases:
            with self.subTest(value=value):
                p = self.payload()
                p[section][key] = value
                before = self.counts()
                self.assertEqual(self.save(p)[0], 400)
                self.assertEqual(self.counts(), before)
        p = self.payload()
        p["reviewed"] = False
        self.assertEqual(self.save(p)[0], 400)

    def test_explicit_overlap_offset_and_low_budget_remain_tentative(self):
        p = self.payload()
        p["booking"].update(start_time="2099-10-25T02:30:00+01:00", budget=0, status="confirmed", price=99)
        self.create("cleaner_preferences", {"cleaner": self.cleaner["id"], "minimum_budget": 50})
        status, data = self.save(p)
        self.assertEqual(status, 200, data)
        b = self.record("bookings", data["booking_id"])
        self.assertEqual(b["start_time"], "2099-10-25 01:30:00.000Z")
        self.assertEqual(b["status"], "requested")
        self.assertTrue(b["budget_known"])
        self.assertTrue(b["budget_below_minimum"])
        self.assertFalse(b["price_known"])

    def test_suggestion_warns_for_zero_budget_but_not_unknown_budget(self):
        preference = self.create("cleaner_preferences", {"cleaner": self.other_cleaner["id"], "minimum_budget": 50})
        self.restart(CLEANVOICE_CLEANER_ID=self.other_cleaner["id"])
        try:
            for payload, warns in [({}, False), ({"estimated_budget": None}, False),
                                   ({"estimated_budget": 0}, True), ({"estimated_budget": 50}, False)]:
                with self.subTest(payload=payload):
                    status, result = self.request("POST", "/api/cleanvoice/suggest-cleaner", payload)
                    self.assertEqual(status, 200, result)
                    self.assertTrue(result["available"])
                    self.assertEqual(bool(result["warnings"]), warns)
        finally:
            self.restart()
            self.request("DELETE", f"/api/collections/cleaner_preferences/records/{preference['id']}", token=self.admin)

    def test_only_owner_can_make_one_final_decision(self):
        status, receipt = self.save(self.payload())
        self.assertEqual(status, 200, receipt)
        path = f"/api/cleanvoice/bookings/{receipt['booking_id']}/decision"
        self.assertEqual(self.request("POST", path, {"decision": "confirmed"})[0], 401)
        self.assertEqual(self.request("POST", path, {"decision": "confirmed", "cleaner": self.cleaner["id"]}, self.other)[0], 404)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda decision: self.request("POST", path, {"decision": decision}, self.owner), ["confirmed", "declined"]))
        self.assertEqual(sorted(status for status, _ in results), [200, 409], results)
        winner = self.record("bookings", receipt["booking_id"])["status"]
        self.assertEqual(self.request("POST", path, {"decision": winner}, self.owner)[0], 200)
        b = self.record("bookings", receipt["booking_id"])
        self.assertFalse(b["price_known"])
        for body in [{"status": "requested"}, {"cleaner": self.other_cleaner["id"]}, {"service_type": "changed"}]:
            self.assertNotEqual(self.request("PATCH", f"/api/collections/bookings/records/{b['id']}", body, self.owner)[0], 200)
        self.assertNotEqual(self.request("DELETE", f"/api/collections/bookings/records/{b['id']}", token=self.owner)[0], 204)
        for name, rid in [("clients", b["client"]), ("addresses", b["address"]), ("cleaners", b["cleaner"])]:
            self.assertNotEqual(self.request("PATCH", f"/api/collections/{name}/records/{rid}", {"user": "", "name": "changed", "street": "changed"}, self.other)[0], 200)
        self.assertNotEqual(self.request("POST", "/api/collections/bookings/records", {"status": "confirmed"}, self.owner)[0], 200)

    def test_receipt_recovery_is_scoped_and_does_not_track_decision(self):
        p = self.payload()
        recovery = uuid.uuid4().hex + uuid.uuid4().hex
        status, receipt = self.request("POST", "/api/cleanvoice/create-booking", p, recovery=recovery)
        self.assertEqual(status, 200, receipt)
        path = f"/api/cleanvoice/submissions/{p['submission_id']}"
        self.assertEqual(self.request("GET", path)[0], 404)
        self.assertEqual(self.request("GET", path, recovery="wrong")[0], 404)
        self.assertEqual(self.request("GET", path, token=self.other)[0], 404)
        self.assertEqual(self.request("GET", path, recovery=recovery), (200, receipt))
        self.request("POST", f"/api/cleanvoice/bookings/{receipt['booking_id']}/decision", {"decision": "confirmed"}, self.owner)
        self.assertEqual(self.request("GET", path, recovery=recovery), (200, receipt))
        self.assertEqual(self.request("POST", "/api/cleanvoice/create-booking", p, recovery="a" * 64)[0], 404)

    def test_missing_and_inactive_configured_cleaner_never_falls_back(self):
        path = f"/api/collections/cleaners/records/{self.cleaner['id']}"
        self.request("PATCH", path, {"active": False}, self.admin)
        try:
            before = self.counts()
            self.assertEqual(self.save(self.payload())[0], 400)
            self.assertEqual(self.counts(), before)
        finally:
            self.request("PATCH", path, {"active": True}, self.admin)

    def restart(self, **env_changes):
        self.server.terminate()
        self.server.wait(timeout=10)
        type(self).server = subprocess.Popen([*self.args, "serve", f"--http=127.0.0.1:{self.port}"],
                                            env={**self.env, **env_changes}, stdout=self.log, stderr=self.log)
        for _ in range(100):
            try:
                if self.request("GET", "/api/health")[0] == 200:
                    return
            except OSError:
                pass
            time.sleep(.05)
        self.fail("Disposable server did not restart")

    def test_receipt_survives_server_restart_and_identity_is_unique_in_database(self):
        p = self.payload()
        _, receipt = self.save(p)  # Discard the response as if the connection was lost.
        self.restart()
        self.assertEqual(self.save(p), (200, receipt))
        self.assertEqual(self.request("GET", f"/api/cleanvoice/submissions/{p['submission_id']}", token=self.owner), (200, receipt))
        status, submissions = self.request("GET", f"/api/collections/booking_submissions/records?filter=submission_id='{p['submission_id']}'", token=self.admin)
        duplicate = {**submissions["items"][0]}
        del duplicate["id"]
        self.assertEqual(self.request("POST", "/api/collections/booking_submissions/records", duplicate, self.admin)[0], 400)
        self.restart(CLEANVOICE_CLEANER_ID="missingcleaner1")
        try:
            before = self.counts()
            self.assertEqual(self.save(self.payload())[0], 400)
            self.assertEqual(self.counts(), before)
            # Existing receipts remain recoverable even if assignment config changes.
            self.assertEqual(self.save(p), (200, receipt))
        finally:
            self.restart()

    def test_lost_http_response_after_commit_recovers_one_original_receipt(self):
        payload = self.payload()
        before = self.counts()
        upstream_results = []
        fixture = self

        class DropResponse(BaseHTTPRequestHandler):
            def do_POST(self):
                received = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                upstream_results.append(fixture.save(received))
                # The backend has committed, but no status/body reaches the caller.
                self.connection.shutdown(socket.SHUT_RDWR)
                self.connection.close()

            def log_message(self, *args):
                pass

        with HTTPServer(("127.0.0.1", 0), DropResponse) as proxy:
            worker = threading.Thread(target=proxy.handle_request, daemon=True)
            worker.start()
            try:
                request = urllib.request.Request(
                    f"http://127.0.0.1:{proxy.server_port}/api/cleanvoice/create-booking",
                    data=json.dumps(payload).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with self.assertRaises(RemoteDisconnected):
                    urllib.request.urlopen(request, timeout=15)
            finally:
                worker.join(timeout=20)
        self.assertFalse(worker.is_alive())
        status, receipt = upstream_results[0]
        self.assertEqual(status, 200, receipt)
        self.assertEqual(self.request("GET", f"/api/cleanvoice/submissions/{payload['submission_id']}", token=self.owner), (200, receipt))
        self.assertEqual(self.save(payload), (200, receipt))
        after = self.counts()
        for collection in ["addresses", "bookings", "booking_notes", "client_preferences"]:
            self.assertEqual(after[collection], before[collection] + 1)
        self.assertEqual(self.record("bookings", receipt["booking_id"])["status"], "requested")

    def test_setup_upgrades_old_schema_without_losing_records_and_is_repeatable(self):
        # Recreate the pre-contract schema from 73c9a1e in this disposable DB:
        # seven base collections, broad rules, no submission collection or flags.
        self.assertEqual(self.request("DELETE", "/api/collections/booking_submissions", token=self.admin)[0], 204)
        old_rules = {key: '@request.auth.id != ""' for key in
                     ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]}
        for name in ["cleaners", "clients", "addresses", "bookings", "booking_notes", "client_preferences", "cleaner_preferences"]:
            self.assertEqual(self.request("PATCH", f"/api/collections/{name}", old_rules, self.admin)[0], 200)
        status, collection = self.request("GET", "/api/collections/bookings", token=self.admin)
        new_fields = {"timezone", "budget_known", "price_known", "budget_below_minimum", "request_snapshot"}
        collection["fields"] = [f for f in collection["fields"] if f["name"] not in new_fields]
        collection["updateRule"] = '@request.auth.id != ""'
        self.assertEqual(self.request("PATCH", "/api/collections/bookings", collection, self.admin)[0], 200)
        legacy = self.create("bookings", {"status": "requested", "service_type": "Legacy synthetic request",
                                          "cleaner": self.cleaner["id"], "price": 0, "budget": 0})
        note = self.create("booking_notes", {"booking": legacy["id"], "note": "Alte Testnotiz", "note_translated": "Legacy test note"})
        before = self.counts()
        self.setup_schema()
        self.setup_schema()
        self.assertEqual(self.counts(), before)
        self.assertEqual(self.record("booking_notes", note["id"]), note)
        self.assertEqual(self.request("GET", f"/api/collections/booking_notes/records/{note['id']}", token=self.other)[0], 404)
        upgraded = self.record("bookings", legacy["id"])
        for key in ["id", "status", "service_type", "cleaner", "created"]:
            self.assertEqual(upgraded[key], legacy[key])
        self.assertFalse(upgraded["budget_known"])
        self.assertFalse(upgraded["price_known"])
        self.assertNotEqual(self.request("PATCH", f"/api/collections/bookings/records/{legacy['id']}", {"status": "confirmed"}, self.owner)[0], 200)
        p = self.payload()
        status, receipt = self.save(p)
        self.assertEqual(status, 200, receipt)
        self.assertEqual(self.save(p), (200, receipt))


if __name__ == "__main__":
    unittest.main()
