"""Owner-scoped list/detail/related/event checks against a disposable real server."""
import json
import queue
import os
import subprocess
import threading
import urllib.parse
import urllib.request
import unittest

import test_booking_http as fixture


# Reuse only the synthetic server fixture; run the existing mutation suite separately.
class BookingReadsHTTP(unittest.TestCase):
    setUpClass = classmethod(fixture.BookingHTTP.setUpClass.__func__)
    cleanup = classmethod(fixture.BookingHTTP.cleanup.__func__)
    setup_schema = classmethod(fixture.BookingHTTP.setup_schema.__func__)
    request = classmethod(fixture.BookingHTTP.request.__func__)
    login = classmethod(fixture.BookingHTTP.login.__func__)
    create = classmethod(fixture.BookingHTTP.create.__func__)
    payload = fixture.BookingHTTP.payload
    save = fixture.BookingHTTP.save

    def test_complete_pages_details_related_records_and_owner_events(self):
        p = self.payload()
        p["booking_notes"] = [{"note": f"Original {i}", "note_translated": f"Note {i}"} for i in range(31)]
        p["client_preferences"] = [{"note": f"Preference {i}"} for i in range(31)]
        status, receipt = self.save(p)
        self.assertEqual(status, 200, receipt)
        booking_id = receipt["booking_id"]
        status, detail = self.request("GET", f"/api/collections/bookings/records/{booking_id}?expand=client,address", token=self.owner)
        self.assertEqual(status, 200, detail)
        for i in range(31):
            self.create("bookings", {"cleaner":"syntheticclean1", "client":detail["client"],
                                    "address":detail["address"], "status":"requested",
                                    "start_time":"2099-01-15 09:00:00Z", "end_time":"2099-01-15 11:00:00Z"})
        params = urllib.parse.urlencode({"perPage":30, "sort":"-created,-id", "page":1})
        status, first = self.request("GET", "/api/collections/bookings/records?" + params, token=self.owner)
        self.assertEqual(status,200)
        self.assertEqual(first["totalItems"],32)
        self.assertEqual(len(first["items"]),30)
        _, second = self.request("GET", "/api/collections/bookings/records?perPage=30&page=2&sort=-created,-id", token=self.owner)
        self.assertEqual(len(second["items"]),2)
        self.assertFalse({b["id"] for b in first["items"]} & {b["id"] for b in second["items"]})
        self.assertEqual(self.request("GET", f"/api/collections/bookings/records/{second['items'][0]['id']}", token=self.owner)[0],200)
        ids = {"bookings":booking_id, "clients":detail["client"], "addresses":detail["address"]}
        for collection in ["booking_notes", "client_preferences"]:
            _, first_related = self.request("GET", f"/api/collections/{collection}/records?perPage=30", token=self.owner)
            _, second_related = self.request("GET", f"/api/collections/{collection}/records?perPage=30&page=2", token=self.owner)
            self.assertEqual(first_related["totalItems"],31)
            self.assertEqual(len(second_related["items"]),1)
            ids[collection] = second_related["items"][0]["id"]
        for collection, record_id in ids.items():
            with self.subTest(collection=collection):
                self.assertEqual(self.request("GET", f"/api/collections/{collection}/records/{record_id}", token=self.other)[0],404)
                status, records = self.request("GET", f"/api/collections/{collection}/records", token=self.other)
                self.assertEqual(status,200)
                self.assertEqual(records["items"],[])
        # Exercise the actual shared dashboard reader against real HTTP, not a query facsimile.
        script = """
          import assert from 'node:assert/strict';
          import {createBookingReader} from './dashboard/src/lib/orders.ts';
          const reader=createBookingReader({baseUrl:process.env.READ_BASE,token:process.env.READ_TOKEN,cleanerId:'syntheticclean1'});
          assert.equal((await reader.list({kind:'home'})).total,32);
          assert.equal((await reader.list({kind:'orders',page:2})).orders.length,2);
          assert.equal((await reader.list({kind:'calendar',from:'2099-01-15T10:00:00Z',to:'2099-01-15T10:30:00Z'})).total,32);
          const detail=await reader.detail(process.env.READ_ID);
          assert.equal(detail.notes.length,31);
          assert.equal(detail.preferences.length,31);
          assert.deepEqual(detail.failedSections,[]);
        """
        result = subprocess.run(["node","--input-type=module","-e",script],
            cwd=fixture.ROOT.parent, env={**os.environ,"READ_BASE":self.base,"READ_TOKEN":self.owner,"READ_ID":booking_id},
            capture_output=True, text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        # Forging the owning cleaner filter does not widen the second user's access.
        _, forged = self.request("GET", "/api/collections/bookings/records?filter=" +
                                 urllib.parse.quote('cleaner="syntheticclean1"'), token=self.other)
        self.assertEqual(forged["items"],[])
        self.assertEqual(self.request("POST","/api/collections/users/auth-refresh",token="expired")[0],401)

        # Real named SSE: both accounts subscribe; only the owning account receives private changes.
        streams = []
        try:
            for token in [self.owner,self.other]:
                response = urllib.request.urlopen(self.base+"/api/realtime", timeout=5)
                events = queue.Queue()
                def consume(response=response, events=events):
                    event = {}
                    try:
                        for raw in response:
                            line = raw.decode().strip()
                            if not line:
                                if event: events.put(event)
                                event = {}
                            elif ":" in line:
                                key,value=line.split(":",1); event[key]=value.strip()
                    except (OSError, ValueError):
                        pass
                thread = threading.Thread(target=consume, daemon=True)
                thread.start()
                connected = events.get(timeout=5)
                status,_ = self.request("POST","/api/realtime", {
                    "clientId":connected["id"],
                    "subscriptions":[f"{collection}/*" for collection in ids],
                }, token=token)
                self.assertEqual(status,204)
                streams.append((response,events))
            for collection, record_id in ids.items():
                field = "status" if collection == "bookings" else "name" if collection == "clients" else "access_notes" if collection == "addresses" else "note"
                value = "confirmed" if collection == "bookings" else "Owner-only update"
                self.assertEqual(self.request("PATCH", f"/api/collections/{collection}/records/{record_id}", {field:value}, self.admin)[0],200)
                event = streams[0][1].get(timeout=5)
                self.assertEqual(event["event"],f"{collection}/*")
                self.assertEqual(json.loads(event["data"])["record"]["id"],record_id)
            with self.assertRaises(queue.Empty):
                streams[1][1].get(timeout=.3)
        finally:
            for response,_ in streams:
                response.close()


if __name__ == "__main__":
    unittest.main()
