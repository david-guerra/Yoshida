#!/usr/bin/env python3
"""Launch a private, disposable Yoshida acceptance stack; preserve its evidence."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
ADMIN_KEYS = (
    "PB_ADMIN_EMAIL",
    "PB_ADMIN_PASSWORD",
    "POCKETBASE_ADMIN_EMAIL",
    "POCKETBASE_ADMIN_PASSWORD",
)


def request(base, method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(
        base + path,
        method=method,
        headers=headers,
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)


def login(base, collection, email, password):
    return request(
        base,
        "POST",
        f"/api/collections/{collection}/auth-with-password",
        {"identity": email, "password": password},
    )["token"]


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


class Stack:
    def __init__(self, directory):
        self.directory = directory
        self.children = []

    def start(self, name, command, env, cwd=ROOT):
        with (self.directory / f"{name}.log").open("a") as log:
            child = subprocess.Popen(
                command,
                cwd=cwd,
                env=env,
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
        self.children.append((name, child))
        return child

    def check(self):
        for name, child in self.children:
            if child.poll() is not None:
                raise RuntimeError(
                    f"{name} exited ({child.returncode}); inspect private {name}.log"
                )

    def wait_http(self, url, timeout=90):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.check()
            try:
                with urllib.request.urlopen(url, timeout=2) as response:
                    if response.status == 200:
                        return
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.2)
        raise RuntimeError(f"Readiness deadline exceeded: {url}")

    def stop(self, child):
        # Only signal process groups created by this launcher, including Next/worker children.
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            child.poll()  # Reap the leader while checking its descendants separately.
            try:
                os.killpg(child.pid, 0)
            except ProcessLookupError:
                break
            time.sleep(0.05)
        else:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        child.wait(timeout=3)
        self.children = [
            (name, process) for name, process in self.children if process is not child
        ]

    def close(self):
        for _, child in list(reversed(self.children)):
            self.stop(child)


def component_env(component, overrides):
    # Mirror local development dotenv precedence without rewriting/copying secret files.
    values = {}
    for name in (".env", ".env.development", ".env.local", ".env.development.local"):
        values.update(
            {
                key: value
                for key, value in dotenv_values(ROOT / component / name).items()
                if value is not None
            }
        )
    return {**values, **os.environ, **overrides, **dict.fromkeys(ADMIN_KEYS, "")}


def snapshot(component, directory):
    target = directory / component
    shutil.copytree(
        ROOT / component,
        target,
        ignore=shutil.ignore_patterns(
            "node_modules",
            ".next",
            ".venv",
            ".env*",
            ".call-data",
            "__pycache__",
            ".pytest_cache",
            ".ruff_cache",
            "*.log",
            "*.wav",
            "*.mp3",
        ),
    )
    if component != "client-call-agent":
        (target / "node_modules").symlink_to(
            ROOT / component / "node_modules", target_is_directory=True
        )
    return target


def prepare_backend(stack, args):
    base = f"http://127.0.0.1:{args.pocketbase_port}"
    credentials = {
        email: secrets.token_urlsafe(24)
        for email in (
            "admin@example.test",
            "cleaner@example.test",
            "other@example.test",
        )
    }
    write_json(stack.directory / "login.json", credentials)
    env = {
        **os.environ,
        "POCKETBASE_URL": base,
        "PB_ADMIN_EMAIL": "admin@example.test",
        "PB_ADMIN_PASSWORD": credentials["admin@example.test"],
        "CLEANVOICE_DEMO_PASSWORD": credentials["cleaner@example.test"],
        "CLEANVOICE_CLEANER_ID": "",
    }
    command = [
        str(ROOT / "pocketbase/pocketbase"),
        f"--dir={stack.directory / 'data'}",
        f"--migrationsDir={stack.directory / 'migrations'}",
        f"--hooksDir={ROOT / 'pocketbase/pb_hooks'}",
    ]
    with (stack.directory / "setup.log").open("w") as log:
        subprocess.run(
            [
                *command,
                "superuser",
                "create",
                env["PB_ADMIN_EMAIL"],
                env["PB_ADMIN_PASSWORD"],
            ],
            env=env,
            stdout=log,
            stderr=log,
            check=True,
            timeout=30,
        )
        server = stack.start(
            "pocketbase",
            [*command, "serve", f"--http=127.0.0.1:{args.pocketbase_port}"],
            env,
        )
        stack.wait_http(base + "/api/health")
        subprocess.run(
            [sys.executable, str(ROOT / "pocketbase/setup_pb.py")],
            env=env,
            stdout=log,
            stderr=log,
            check=True,
            timeout=60,
        )
    admin = login(
        base, "_superusers", "admin@example.test", credentials["admin@example.test"]
    )
    cleaner = request(base, "GET", "/api/collections/cleaners/records", token=admin)[
        "items"
    ][0]
    user = request(
        base,
        "POST",
        "/api/collections/users/records",
        {
            "email": "other@example.test",
            "password": credentials["other@example.test"],
            "passwordConfirm": credentials["other@example.test"],
        },
        admin,
    )
    other = request(
        base,
        "POST",
        "/api/collections/cleaners/records",
        {
            "user": user["id"],
            "name": "Other Synthetic Cleaner",
            "preferred_language": "en",
            "active": True,
        },
        admin,
    )
    request(
        base,
        "POST",
        "/api/collections/cleaner_preferences/records",
        {"cleaner": cleaner["id"], "minimum_budget": 50},
        admin,
    )
    stack.stop(server)
    env["CLEANVOICE_CLEANER_ID"] = cleaner["id"]
    stack.start(
        "pocketbase",
        [*command, "serve", f"--http=127.0.0.1:{args.pocketbase_port}"],
        env,
    )
    stack.wait_http(base + "/api/health")
    return base, cleaner["id"], other["id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-dir",
        type=Path,
        help="New directory only; retained after shutdown (default: private temp directory)",
    )
    parser.add_argument("--pocketbase-port", type=int, default=8090)
    parser.add_argument("--caller-port", type=int, default=3000)
    parser.add_argument("--dashboard-port", type=int, default=3001)
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Only schema and two synthetic owners; no bookings or providers",
    )
    parser.add_argument(
        "--without-worker",
        action="store_true",
        help="Start local UI/backend without connecting to speech providers",
    )
    args = parser.parse_args()
    ports = [args.pocketbase_port] + (
        [] if args.backend_only else [args.caller_port, args.dashboard_port]
    )
    if len(set(ports)) != len(ports) or any(port < 1 or port > 65535 for port in ports):
        parser.error("Use distinct ports between 1 and 65535")
    if args.run_dir and args.run_dir.exists():
        parser.error(
            "Run directory already exists; choose a new directory to preserve original data"
        )
    for port in ports:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                parser.error(
                    f"Loopback port {port} unavailable; choose a different port. No existing process was stopped."
                )
    os.umask(0o077)
    directory = (
        args.run_dir.resolve()
        if args.run_dir
        else Path(tempfile.mkdtemp(prefix="yoshida-acceptance-"))
    )
    if args.run_dir:
        directory.mkdir(mode=0o700, parents=True)
    stack = Stack(directory)

    def stop_requested(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop_requested)
    signal.signal(signal.SIGINT, stop_requested)
    print(f"Private run directory: {directory}", flush=True)
    try:
        base, cleaner, other = prepare_backend(stack, args)
        overrides = {
            "POCKETBASE_URL": base,
            "NEXT_PUBLIC_POCKETBASE_URL": base,
            "CLEANVOICE_POCKETBASE_URL": base,
            "SIMULATED_CALLER_PHONE": "+12025550102",
            "CALL_SERVER_URL": f"http://127.0.0.1:{args.caller_port}",
            "CALL_DATABASE_PATH": str(directory / "calls.sqlite"),
        }
        if not args.backend_only:
            for component, port, path in (
                ("web-caller", args.caller_port, "/"),
                ("dashboard", args.dashboard_port, "/login"),
            ):
                cwd = snapshot(component, directory)
                stack.start(
                    component,
                    [
                        "npm",
                        "run",
                        "dev",
                        "--",
                        "--webpack",
                        "--hostname",
                        "127.0.0.1",
                        "--port",
                        str(port),
                    ],
                    component_env(component, overrides),
                    cwd,
                )
                stack.wait_http(f"http://127.0.0.1:{port}{path}")
            if not args.without_worker:
                cwd = snapshot("client-call-agent", directory)
                env = component_env("client-call-agent", overrides)
                python = str(ROOT / "client-call-agent/.venv/bin/python")
                with (directory / "download-files.log").open("w") as log:
                    subprocess.run(
                        [python, "src/agent.py", "download-files"],
                        env=env,
                        cwd=cwd,
                        stdout=log,
                        stderr=log,
                        check=True,
                        timeout=120,
                    )
                stack.start("worker", [python, "src/agent.py", "dev"], env, cwd)
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        manifest = {
            "candidate_commit": commit,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "pocketbase": base,
            "cleaner_id": cleaner,
            "other_cleaner_id": other,
            "caller_phone": "+12025550102",
            "minimum_budget": 50,
            "caller": None if args.backend_only else overrides["CALL_SERVER_URL"],
            "dashboard": None
            if args.backend_only
            else f"http://127.0.0.1:{args.dashboard_port}",
            "worker_started": not (args.backend_only or args.without_worker),
            "live_acceptance": "pending",
        }
        write_json(directory / "ready.json", manifest)
        print(json.dumps(manifest), flush=True)
        print(
            "Login passwords are in private login.json. Ctrl-C stops this stack; evidence is retained.",
            flush=True,
        )
        while True:
            stack.check()
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        # CalledProcessError can contain superuser credentials in argv; never print it.
        print(
            f"Stack failed ({type(error).__name__}); inspect private logs in {directory}",
            file=sys.stderr,
        )
        return 1
    finally:
        stack.close()


if __name__ == "__main__":
    sys.exit(main())
