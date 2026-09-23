"""Check the launcher's process boundary against an uncooperative descendant."""

import os
from pathlib import Path
import signal
import socket
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from local_demo import Stack


class ProcessCleanup(unittest.TestCase):
    def test_shutdown_releases_port_even_when_only_the_parent_obeys_sigterm(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            marker = directory / "port"
            child_code = (
                "import signal,socket,time; from pathlib import Path; "
                "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                "listener=socket.socket(); listener.bind(('127.0.0.1',0)); listener.listen(); "
                f"Path({str(marker)!r}).write_text(str(listener.getsockname()[1])); "
                "time.sleep(60)"
            )
            parent_code = (
                "import subprocess,sys,time; "
                f"subprocess.Popen([sys.executable,'-c',{child_code!r}]); time.sleep(60)"
            )
            stack = Stack(directory)
            parent = stack.start(
                "parent", [sys.executable, "-c", parent_code], os.environ.copy()
            )
            try:
                for _ in range(100):
                    if marker.exists():
                        break
                    time.sleep(0.02)
                self.assertTrue(marker.exists())
                port = int(marker.read_text())
                stack.stop(parent)
                for _ in range(100):
                    with socket.socket() as probe:
                        if probe.connect_ex(("127.0.0.1", port)) != 0:
                            return
                    time.sleep(0.02)
                self.fail("Owned descendant still holds its port after shutdown")
            finally:
                try:
                    os.killpg(parent.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                parent.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
