#!/usr/bin/env python3
"""Assert persisted synthetic acceptance results; print IDs, never capabilities."""

import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import urllib.error
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from local_demo import login, request


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def records(base, collection, filter_value, token):
    items, page = [], 1
    while True:
        result = request(
            base,
            "GET",
            f"/api/collections/{collection}/records?"
            + urlencode({"filter": filter_value, "page": page, "perPage": 100}),
            token=token,
        )
        items.extend(result["items"])
        if page >= result["totalPages"]:
            require(len(items) == result["totalItems"], f"Incomplete {collection} read")
            return items
        page += 1


def reviewed_start(value):
    start = datetime.fromisoformat(value)
    berlin = ZoneInfo("Europe/Berlin")
    if start.tzinfo is None:
        first, second = (
            start.replace(tzinfo=berlin, fold=0),
            start.replace(tzinfo=berlin, fold=1),
        )
        require(
            first.utcoffset() == second.utcoffset(),
            "Reviewed date is ambiguous or nonexistent",
        )
        start = first
    require(
        start.astimezone(berlin).replace(tzinfo=None) == start.replace(tzinfo=None),
        "Reviewed offset does not match Berlin",
    )
    return start.astimezone(timezone.utc)


def verify(run, booking_id, expected_status, expected_count, budget, source):
    manifest = json.loads((run / "ready.json").read_text())
    credentials = json.loads((run / "login.json").read_text())
    base = manifest["pocketbase"]
    admin = login(
        base, "_superusers", "admin@example.test", credentials["admin@example.test"]
    )
    owner = login(
        base, "users", "cleaner@example.test", credentials["cleaner@example.test"]
    )
    other = login(
        base, "users", "other@example.test", credentials["other@example.test"]
    )
    booking = request(
        base, "GET", f"/api/collections/bookings/records/{booking_id}", token=owner
    )
    require(booking["status"] == expected_status, "Unexpected persisted decision")
    require(booking["cleaner"] == manifest["cleaner_id"], "Wrong owning cleaner")
    require(
        booking["source"] == source,
        "Unexpected intake source; manual creation cannot establish voice acceptance",
    )
    require(not booking["price_known"], "Confirmation invented an agreed price")
    require(
        booking["budget_known"] == (budget == "low"), "Unexpected known/unknown budget"
    )
    require(
        booking["budget_below_minimum"] == (budget == "low"),
        "Unexpected budget warning",
    )
    all_bookings = request(
        base, "GET", "/api/collections/bookings/records?perPage=1", token=admin
    )
    require(
        all_bookings["totalItems"] == expected_count,
        "Unexpected total bookings (possible duplicate)",
    )
    submissions = request(
        base,
        "GET",
        "/api/collections/booking_submissions/records?"
        + urlencode({"filter": f'booking="{booking_id}"', "perPage": 2}),
        token=admin,
    )
    require(
        submissions["totalItems"] == 1,
        "Expected exactly one submission for this booking",
    )
    submission = submissions["items"][0]
    receipt = request(
        base,
        "GET",
        f"/api/cleanvoice/submissions/{submission['submission_id']}",
        token=owner,
    )
    require(
        receipt["booking_id"] == booking_id
        and receipt["booking_status"] == "requested"
        and receipt["tentative"] is True,
        "Original tentative receipt changed after decision",
    )
    snapshot = booking["request_snapshot"]
    require(snapshot["reviewed"] is True, "Missing reviewed intake")
    require(
        snapshot["caller_phone"] == manifest["caller_phone"],
        "Unexpected synthetic caller",
    )
    require(snapshot["client"]["name"], "Missing caller name")
    require(
        all(
            snapshot["address"].get(field)
            for field in ("street", "postal_code", "city", "country")
        ),
        "Incomplete full address",
    )
    require(
        snapshot["booking"]["timezone"] == "Europe/Berlin"
        and snapshot["booking"]["estimated_hours"] > 0,
        "Incomplete schedule",
    )
    reviewed = snapshot["booking"]
    start = reviewed_start(reviewed["start_time"])
    require(
        datetime.fromisoformat(booking["start_time"]) == start
        and datetime.fromisoformat(booking["end_time"])
        == start + timedelta(hours=reviewed["estimated_hours"]),
        "Persisted appointment differs from reviewed Berlin time/duration",
    )
    require(
        booking["service_type"] == reviewed["service_type"]
        and booking["estimated_hours"] == reviewed["estimated_hours"]
        and booking["timezone"] == reviewed["timezone"],
        "Persisted service/schedule differs from review",
    )
    require(
        booking["budget"] == (reviewed.get("budget") or 0),
        "Persisted budget differs from review",
    )
    require(
        snapshot["submission_id"] == submission["submission_id"],
        "Snapshot and receipt identities differ",
    )
    client = request(
        base,
        "GET",
        f"/api/collections/clients/records/{booking['client']}",
        token=owner,
    )
    # The same phone's later calls can legitimately update its shared client profile.
    # Historical name and optional client details are authoritative in the snapshot.
    require(client["phone"] == snapshot["caller_phone"], "Wrong linked client")
    address = request(
        base,
        "GET",
        f"/api/collections/addresses/records/{booking['address']}",
        token=owner,
    )
    require(
        address["client"] == booking["client"]
        and all(
            address.get(field, "") == snapshot["address"].get(field, "")
            for field in ("street", "postal_code", "city", "country", "access_notes")
        ),
        "Persisted address differs from review",
    )
    notes = records(base, "booking_notes", f'booking="{booking_id}"', owner)
    note_fields = ("note", "note_translated", "type", "importance", "read_to_cleaner")
    expected_notes = [
        {"type": "note", "importance": "normal", "read_to_cleaner": True, **note}
        for note in snapshot.get("booking_notes", [])
    ]
    require(
        Counter(tuple(note.get(field) for field in note_fields) for note in notes)
        == Counter(
            tuple(note.get(field) for field in note_fields) for note in expected_notes
        )
        and len(notes) > 0,
        "Persisted notes differ from review",
    )
    # Preferences accumulate across repeat calls for the same client. Compare the
    # complete expected multiset for this fresh acceptance database, not just a page.
    client_bookings = records(base, "bookings", f'client="{booking["client"]}"', owner)
    preferences = records(
        base, "client_preferences", f'client="{booking["client"]}"', owner
    )
    preference_fields = (
        "note",
        "note_translated",
        "type",
        "importance",
        "is_persistent",
    )
    expected_preferences = [
        {
            "type": "preference",
            "importance": "normal",
            "is_persistent": True,
            **preference,
        }
        for item in client_bookings
        for preference in item["request_snapshot"].get("client_preferences", [])
    ]
    require(
        Counter(
            tuple(pref.get(field) for field in preference_fields)
            for pref in preferences
        )
        == Counter(
            tuple(pref.get(field) for field in preference_fields)
            for pref in expected_preferences
        ),
        "Persisted preferences differ from reviewed requests",
    )
    require(
        all(
            note.get("note") and note.get("note_translated")
            for note in snapshot["booking_notes"]
        ),
        "Missing original or translated note",
    )
    for path in (
        f"/api/collections/bookings/records/{booking_id}",
        f"/api/cleanvoice/submissions/{submission['submission_id']}",
    ):
        try:
            request(base, "GET", path, token=other)
        except urllib.error.HTTPError as error:
            require(error.code in (403, 404), "Unexpected other-owner read failure")
        else:
            raise RuntimeError("Unrelated cleaner could read this request")
    try:
        request(
            base,
            "POST",
            f"/api/cleanvoice/bookings/{booking_id}/decision",
            {"decision": "declined" if expected_status != "declined" else "confirmed"},
            other,
        )
    except urllib.error.HTTPError as error:
        require(error.code in (403, 404), "Unexpected other-owner decision failure")
    else:
        raise RuntimeError("Unrelated cleaner could decide this request")
    call_id = None
    if source == "voice-call":
        with sqlite3.connect(
            f"file:{run / 'calls.sqlite'}?mode=ro", uri=True
        ) as database:
            calls = [
                json.loads(row[0])
                for row in database.execute("SELECT record FROM calls")
            ]
        matches = [
            call
            for call in calls
            if call["submissionId"] == submission["submission_id"]
        ]
        require(
            len(matches) == 1, "Expected one durable browser call for the submission"
        )
        call = matches[0]
        require(
            call["state"] == "saved" and call["receipt"] == receipt,
            "Caller ledger differs from durable receipt",
        )
        call_id = call["callId"]
    return {
        "booking_id": booking_id,
        "submission_id": submission["submission_id"],
        "call_id": call_id,
        "status": booking["status"],
        "source": source,
        "total_bookings": expected_count,
        "budget": budget,
        "price": "unknown",
        "owner_isolation": "passed",
        "persisted_assertions": "passed",
        "live_speech_and_browser_review": "must be recorded separately",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--booking", required=True)
    parser.add_argument(
        "--status", choices=("requested", "confirmed", "declined"), required=True
    )
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--budget", choices=("unknown", "low"), required=True)
    parser.add_argument(
        "--source", choices=("voice-call", "dashboard"), default="voice-call"
    )
    args = parser.parse_args()
    try:
        result = verify(
            args.run_dir,
            args.booking,
            args.status,
            args.count,
            args.budget,
            args.source,
        )
    except (OSError, RuntimeError, KeyError, ValueError, sqlite3.Error) as error:
        parser.exit(
            1,
            f"Verification failed ({type(error).__name__}); inspect the synthetic run locally.\n",
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
