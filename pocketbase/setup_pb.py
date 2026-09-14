#!/usr/bin/env python3
"""Create or upgrade the synthetic booking schema without deleting existing data."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")
ADMIN_EMAIL = os.environ["PB_ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["PB_ADMIN_PASSWORD"]

DEMO_EMAIL = "cleaner@example.test"
DEMO_PASSWORD = os.environ["CLEANVOICE_DEMO_PASSWORD"]
DEMO_NAME = "Example Cleaner"

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


def rules(name):
    # Mutation authority lives in the transactional booking routes. Related intake
    # records cannot be edited directly to change an already reviewed request.
    owner = {
        "cleaners": 'user = @request.auth.id',
        "cleaner_preferences": 'cleaner.user = @request.auth.id',
        "bookings": 'cleaner.user = @request.auth.id',
        "booking_notes": 'booking.cleaner.user = @request.auth.id',
        "clients": 'bookings_via_client.cleaner.user ?= @request.auth.id',
        "addresses": 'bookings_via_address.cleaner.user ?= @request.auth.id',
        "client_preferences": 'client.bookings_via_client.cleaner.user ?= @request.auth.id',
    }.get(name)
    read = f'{AUTHED} && ({owner})' if owner else None
    result = {"listRule": read, "viewRule": read, "createRule": None,
              "updateRule": None, "deleteRule": None}
    if name == "cleaners":
        result["updateRule"] = read + ' && @request.body.user:changed = false'
    if name == "cleaner_preferences":
        result["createRule"] = read
        result["updateRule"] = read + ' && @request.body.cleaner:changed = false'
    return result


def get_collection_id(token, name):
    status, data = req("GET", f"/api/collections/{name}", token)
    return data.get("id") if status == 200 else None


def create_collection(token, name, fields, indexes=None):
    status, existing = req("GET", f"/api/collections/{name}", token)
    payload = {"name": name, "type": "base", "fields": fields, **{key: None for key in rules(name)}}
    if status == 200:
        # Keep field IDs, unknown extension fields, records and existing indexes.
        by_name = {field["name"]: field for field in existing["fields"]}
        for field in fields:
            by_name[field["name"]] = {**by_name.get(field["name"], {}), **field}
        payload["fields"] = list(by_name.values())
        payload["indexes"] = list(dict.fromkeys(existing.get("indexes", []) + (indexes or [])))
        status, data = req("PATCH", f"/api/collections/{name}", token, payload)
    elif status == 404:
        payload["indexes"] = indexes or []
        status, data = req("POST", "/api/collections", token, payload)
    else:
        raise RuntimeError(f"Cannot inspect collection {name}: HTTP {status}")
    if status not in (200, 201):
        raise RuntimeError(f"Cannot apply schema for {name}: HTTP {status}: {json.dumps(data)}")
    print(f"  = {name} schema current ({data['id']})")
    return data["id"]


def main():
    status, data = req("POST", "/api/collections/_superusers/auth-with-password",
                       body={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if status != 200:
        print("superuser auth failed:", status)
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
        text("status"), text("service_type"), text("timezone"),
        {"name": "budget_known", "type": "bool"},
        {"name": "price_known", "type": "bool"},
        {"name": "budget_below_minimum", "type": "bool"},
        json_field("request_snapshot"),
        {"name": "estimated_hours", "type": "number"},
        text("customer_summary", max=4000), text("cleaner_briefing", max=4000),
        {"name": "calendar_sent", "type": "bool"}, text("source"),
        {"name": "price", "type": "number"}, {"name": "budget", "type": "number"},
        *autodates(),
    ])
    create_collection(token, "booking_submissions", [
        text("submission_id", required=True), text("payload_hash", required=True),
        text("recovery_hash", hidden=True), relation("booking", bookings, required=True),
        relation("cleaner", cleaners, required=True), json_field("receipt"),
        *autodates(),
    ], ['CREATE UNIQUE INDEX idx_submission_identity ON booking_submissions (submission_id)'])
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

    # Apply relation-dependent rules only after every collection exists. A failed
    # first pass leaves affected collections locked, never broadly writable.
    for name in ["cleaners", "clients", "addresses", "bookings", "booking_submissions",
                 "booking_notes", "client_preferences", "cleaner_preferences"]:
        status, result = req("PATCH", f"/api/collections/{name}", token, rules(name))
        if status != 200:
            raise RuntimeError(f"Cannot apply access rules for {name}: {result}")

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
            "phone": "+12025550101", "preferred_language": "en",
            "service_areas": ["Berlin"], "skills": [], "active": True,
        })
        if status not in (200, 201):
            print("  ! demo cleaner failed:", status, json.dumps(data, indent=2))
            sys.exit(1)
        print(f"  + demo cleaner ({data['id']})")

    print("\nDONE. Synthetic login:", DEMO_EMAIL, "(password supplied via environment)")


if __name__ == "__main__":
    main()
