#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_ROOT"

BACKEND_DIR="$SCRIPT_ROOT/backend"
FRONTEND_DIR="$SCRIPT_ROOT/frontend"
LOG_DIR="$SCRIPT_ROOT/.run_local_logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT="${FLASK_PORT:-8080}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"

echo "[run_local] starting backend/app.py -> $LOG_DIR/backend.log"
echo "[run_local] backend listening at $BACKEND_URL"
# prefer a user-provided venv if available, else fall back to system python3
USER_VENV="/media/caoba/vault/pypenvs/frigg/bin/activate"
if [ -f "$USER_VENV" ]; then
	(cd "$BACKEND_DIR" && . "$USER_VENV" && python3 app.py >"$LOG_DIR/backend.log" 2>&1) &
else
	(cd "$BACKEND_DIR" && python3 app.py >"$LOG_DIR/backend.log" 2>&1) &
fi
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

echo "[run_local] starting frontend dev server -> $LOG_DIR/frontend.log"
echo "[run_local] frontend default address http://localhost:5173 (see $LOG_DIR/frontend.log for the actual port Vite picks)"
(cd "$FRONTEND_DIR" && npm run dev >"$LOG_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

cleanup() {
	echo "[run_local] cleaning up..."
	kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
