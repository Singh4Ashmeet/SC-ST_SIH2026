"""
Yojana Setu - Master Application Runner Script

Starts both the FastAPI Backend and Next.js Frontend simultaneously in a single terminal.

Usage:
    python app.py
"""

import sys
import os
import time
import subprocess
import threading
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def stream_output(process: subprocess.Popen, prefix: str):
    """Continuously read output lines from a process and print with prefix."""
    try:
        assert process.stdout is not None
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            print(f"{prefix} {line.rstrip()}", flush=True)
    except (ValueError, OSError):
        pass


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 65)
    print("  >>> YOJANA SETU - STARTING COMPLETE PLATFORM")
    print("=" * 65)
    print("  -> Backend API:        http://localhost:8000")
    print("  -> API Interactive Docs: http://localhost:8000/docs")
    print("  -> Frontend Portal:    http://localhost:3000")
    print("=" * 65)
    print("  Press Ctrl+C to stop both backend and frontend servers.\n", flush=True)

    # Detect python executable and npm binary
    python_executable = sys.executable
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

    processes = []

    try:
        # Start Backend (FastAPI / Uvicorn)
        print("[LAUNCH] Starting FastAPI backend on http://localhost:8000 ...", flush=True)
        backend_proc = subprocess.Popen(
            [python_executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            cwd=str(BACKEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        processes.append(backend_proc)

        t_backend = threading.Thread(
            target=stream_output, args=(backend_proc, "[BACKEND]"), daemon=True
        )
        t_backend.start()

        # Start Frontend (Next.js)
        print("[LAUNCH] Starting Next.js frontend on http://localhost:3000 ...\n", flush=True)
        frontend_proc = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=True if os.name == "nt" else False,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        processes.append(frontend_proc)

        t_frontend = threading.Thread(
            target=stream_output, args=(frontend_proc, "[FRONTEND]"), daemon=True
        )
        t_frontend.start()

        # Keep master process alive and monitor child processes
        while True:
            time.sleep(1)
            for proc in processes:
                if proc.poll() is not None:
                    # One of the processes exited
                    print(f"\n[WARNING] Process {proc.pid} exited with code {proc.returncode}.")

    except KeyboardInterrupt:
        print("\n\n[SHUTDOWN] Stopping Yojana Setu platform...", flush=True)
    finally:
        for proc in processes:
            if proc.poll() is None:
                try:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                    else:
                        proc.terminate()
                except Exception:
                    pass
        print("[SHUTDOWN] All servers stopped cleanly.", flush=True)


if __name__ == "__main__":
    main()
