#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3004}"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/blog-growth-agent-${PORT}.pid"
TMUX_SESSION="blog-growth-agent-${PORT}"

STOPPED=0

stop_tmux_session() {
  local session="$1"
  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$session" 2>/dev/null; then
    tmux kill-session -t "$session"
    STOPPED=1
    echo "Stopped tmux session $session."
  fi
}

stop_pid() {
  local pid="$1"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    for _ in 1 2 3 4 5; do
      if ! kill -0 "$pid" 2>/dev/null; then
        STOPPED=1
        echo "Stopped pid $pid."
        return 0
      fi
      sleep 1
    done
    echo "Pid $pid did not exit after SIGTERM. Inspect manually before forcing stop."
    return 1
  fi
}

if [[ -f "$PID_FILE" ]]; then
  TRACKED="$(cat "$PID_FILE" || true)"
  if [[ "$TRACKED" == tmux:* ]]; then
    stop_tmux_session "${TRACKED#tmux:}"
  else
    stop_pid "$TRACKED"
  fi
  rm -f "$PID_FILE"
else
  stop_tmux_session "$TMUX_SESSION"
fi

if [[ "$STOPPED" -eq 0 ]]; then
  echo "No tracked Blog Growth Agent process was running for port $PORT."
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Warning: port $PORT is still in use by an untracked process."
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
  exit 1
fi

echo "Blog Growth Agent is stopped for port $PORT."
