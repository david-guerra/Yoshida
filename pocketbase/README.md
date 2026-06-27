# pocketbase/

Holds the [PocketBase](https://pocketbase.io) binary and its data (`pb_data/`).
PocketBase is a single-file backend (SQLite + REST API + admin dashboard) used as the
datastore for this project.

Both the binary and `pb_data/` are git-ignored — each machine downloads its own binary,
and the data is local.

## Download & run (macOS)

Run these commands **from inside this `pocketbase/` folder**.

### Apple Silicon (M1/M2/M3 — this machine)

```bash
PB_VERSION=0.39.4
curl -L -o pocketbase.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_darwin_arm64.zip"
unzip pocketbase.zip && rm pocketbase.zip
./pocketbase serve
```

### Intel Mac

```bash
PB_VERSION=0.39.4
curl -L -o pocketbase.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_darwin_amd64.zip"
unzip pocketbase.zip && rm pocketbase.zip
./pocketbase serve
```

> First run is unzip-blocked by macOS Gatekeeper? Run `xattr -d com.apple.quarantine ./pocketbase`
> and try again. Check <https://github.com/pocketbase/pocketbase/releases> for newer versions.

## URLs

After `./pocketbase serve` starts, it listens on **http://127.0.0.1:8090**:

- **Admin dashboard:** http://127.0.0.1:8090/_/
  (on first run it prints a link to create the initial superuser account)
- **REST API base:** http://127.0.0.1:8090/api/

Set `POCKETBASE_URL=http://127.0.0.1:8090` in your env (see root [`.env.example`](../.env.example)).
