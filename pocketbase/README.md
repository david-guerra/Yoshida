# Yoshida PocketBase demo backend

`setup_pb.py` creates or upgrades the schema and seeds one synthetic cleaner login. `pb_hooks/` implements caller lookup, configured-cleaner suggestions, atomic tentative requests, private receipt recovery and owner-only Confirm/Decline. Use PocketBase **0.39.4** and follow [setup](../docs/setup.md#fresh-synthetic-backend).

```sh
node --test pocketbase/tests/*.test.mjs
python3 -m unittest discover -s pocketbase/tests -p 'test_booking_http.py' -v
python3 -m py_compile pocketbase/setup_pb.py
```

The HTTP suite uses a new temporary database, synthetic users and its own loopback port, including restart and schema-upgrade probes. Set `CLEANVOICE_CLEANER_ID` on the running backend to select the active synthetic cleaner. See [backend contract](../docs/backend-contract.md) for payloads, receipt authorization, mutation restrictions and remaining local-only boundaries. Do not commit the binary, database, generated migrations or environment values.
