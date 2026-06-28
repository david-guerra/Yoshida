#!/usr/bin/env python3
"""Reconstruct the CleanVoice PocketBase schema (no booking/client content).

Creates the 7 base collections the dashboard reads/writes, wires relations,
opens API rules to authenticated users, and seeds exactly one login
(users record + linked cleaners profile) so the dashboard is usable.
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8090"
ADMIN_EMAIL = os.environ["PB_ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["PB_ADMIN_PASSWORD"]

DEMO_EMAIL = "cleaner@cleanvoice.local"
DEMO_PASSWORD = os.environ.get("PB_DEMO_PASSWORD", "cleanvoice123")
DEMO_NAME = "Maria Kowalski"

AUTHED = '@request.auth.id != ""'


def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def text(name, **kw):
    return {"name": name, "type": "text", **kw}


def relation(name, collection_id, **kw):
    return {"name": name, "type": "relation", "collectionId": collection_id,
            "maxSelect": 1, "cascadeDelete": False, "required": False, **kw}


def autodates():
    return [
        {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
        {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True},
    ]


def json_field(name):
    return {"name": name, "type": "json", "maxSize": 2000000}


def rules():
    return {"listRule": AUTHED, "viewRule": AUTHED, "createRule": AUTHED,
            "updateRule": AUTHED, "deleteRule": AUTHED}


def get_collection_id(token, name):
    status, data = req("GET", f"/api/collections/{name}", token)
    return data.get("id") if status == 200 else None


def create_collection(token, name, fields):
    existing = get_collection_id(token, name)
    if existing:
        print(f"  = {name} already exists ({existing})")
        return existing
    payload = {"name": name, "type": "base", "fields": fields, **rules()}
    status, data = req("POST", "/api/collections", token, payload)
    if status not in (200, 201):
        print(f"  ! FAILED to create {name}: {status}")
        print(json.dumps(data, indent=2))
        sys.exit(1)
    print(f"  + {name} ({data['id']})")
    return data["id"]


def main():
    status, data = req("POST", "/api/collections/_superusers/auth-with-password",
                       body={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if status != 200:
        print("superuser auth failed:", status, data)
        sys.exit(1)
    token = data["token"]
    print("authenticated as superuser")

    users_id = get_collection_id(token, "users")
    print("users collection:", users_id)

    print("creating collections...")
    cleaners = create_collection(token, "cleaners", [
        relation("user", users_id),
        text("name"), {"name": "email", "type": "email"}, text("phone"),
        text("preferred_language"),
        json_field("service_areas"), json_field("skills"),
        {"name": "active", "type": "bool"},
        *autodates(),
    ])
    clients = create_collection(token, "clients", [
        text("name", required=True), text("phone"),
        {"name": "email", "type": "email"},
        text("preferred_language"), text("status"), text("notes", max=2000),
        *autodates(),
    ])
    addresses = create_collection(token, "addresses", [
        relation("client", clients),
        text("label"), {"name": "is_default", "type": "bool"},
        text("street"), text("postal_code"), text("city"), text("country"),
        text("access_notes", max=2000),
        *autodates(),
    ])
    bookings = create_collection(token, "bookings", [
        relation("client", clients), relation("address", addresses),
        relation("cleaner", cleaners),
        {"name": "start_time", "type": "date"}, {"name": "end_time", "type": "date"},
        text("status"), text("service_type"),
        {"name": "estimated_hours", "type": "number"},
        text("customer_summary", max=4000), text("cleaner_briefing", max=4000),
        {"name": "calendar_sent", "type": "bool"}, text("source"),
        {"name": "price", "type": "number"}, {"name": "budget", "type": "number"},
        *autodates(),
    ])
    create_collection(token, "booking_notes", [
        relation("booking", bookings),
        text("type"), text("note", max=2000), text("note_translated", max=2000), text("importance"),
        {"name": "read_to_cleaner", "type": "bool"},
        *autodates(),
    ])
    create_collection(token, "client_preferences", [
        relation("client", clients),
        text("type"), text("note", max=2000), text("note_translated", max=2000), text("importance"),
        {"name": "is_persistent", "type": "bool"},
        *autodates(),
    ])
    create_collection(token, "cleaner_preferences", [
        relation("cleaner", cleaners),
        json_field("working_days"),
        text("available_start_time"), text("available_end_time"),
        json_field("service_locations"), json_field("preferred_services"),
        {"name": "minimum_budget", "type": "number"},
        text("business_rules", max=4000), json_field("exceptions"),
        *autodates(),
    ])

    print("seeding demo login (1 user + 1 cleaner)...")
    status, data = req("GET", f'/api/collections/users/records?filter=(email="{DEMO_EMAIL}")', token)
    if data.get("items"):
        user_id = data["items"][0]["id"]
        print(f"  = demo user exists ({user_id})")
    else:
        status, data = req("POST", "/api/collections/users/records", token, {
            "email": DEMO_EMAIL, "password": DEMO_PASSWORD,
            "passwordConfirm": DEMO_PASSWORD, "name": DEMO_NAME,
            "emailVisibility": True, "verified": True,
        })
        if status not in (200, 201):
            print("  ! demo user failed:", status, json.dumps(data, indent=2))
            sys.exit(1)
        user_id = data["id"]
        print(f"  + demo user ({user_id})")

    status, data = req("GET", f'/api/collections/cleaners/records?filter=(user="{user_id}")', token)
    if data.get("items"):
        print(f"  = demo cleaner exists ({data['items'][0]['id']})")
    else:
        status, data = req("POST", "/api/collections/cleaners/records", token, {
            "user": user_id, "name": DEMO_NAME, "email": DEMO_EMAIL,
            "phone": "+49 170 0000000", "preferred_language": "en",
            "service_areas": ["Berlin"], "skills": [], "active": True,
        })
        if status not in (200, 201):
            print("  ! demo cleaner failed:", status, json.dumps(data, indent=2))
            sys.exit(1)
        print(f"  + demo cleaner ({data['id']})")

    print("\nDONE. Login:", DEMO_EMAIL, "/", DEMO_PASSWORD)


if __name__ == "__main__":
    main()
