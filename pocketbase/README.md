# CleanVoice PocketBase demo backend

`setup_pb.py` reconstructs a fresh schema and seeds one synthetic cleaner login; `pb_hooks/` implements caller lookup, preferences, first-cleaner matching, tentative booking writes, and localized briefing text. Follow [setup](../docs/setup.md#fresh-synthetic-backend) with PocketBase **0.39.4**.

```sh
node --test pocketbase/tests/*.test.mjs
python3 -m py_compile pocketbase/setup_pb.py
```

These are helper/source tests, not a running database test. Fresh schema setup and booking routes were also checked manually against a disposable 0.39.4 instance. The default rules permit all authenticated users to access all base collections; custom routes are unauthenticated. Run only on loopback with synthetic data. Do not commit the binary, database, generated migrations, or environment values.
