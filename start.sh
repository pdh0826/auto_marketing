#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3004}"
HOST="${HOST:-127.0.0.1}"
DATABASE_URL="${DATABASE_URL:-postgresql://pdh0826@localhost/blog_growth_agent_dev?host=/tmp&schema=public&connection_limit=3&pool_timeout=10}"
BLOGGER_PUBLIC_ASSET_BASE_URL="${BLOGGER_PUBLIC_ASSET_BASE_URL:-}"
BLOGGER_IMAGE_EMBED_MODE="${BLOGGER_IMAGE_EMBED_MODE:-compressed_jpeg_data_url}"
BLOG_PUBLIC_BASE_URL="${BLOG_PUBLIC_BASE_URL:-}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-}"
BLOGGER_OAUTH_REDIRECT_ORIGIN="${BLOGGER_OAUTH_REDIRECT_ORIGIN:-http://localhost:${PORT}}"
BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD="${BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD:-}"
BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED="${BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED:-}"
BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION="${BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION:-}"
BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS="${BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS:-}"
BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL="${BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL:-}"
PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED="${PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED:-true}"
SCHEDULER_CONFIG_FILE="$ROOT_DIR/local-data/daily-brief-scheduler/config.json"
PUBLIC_ASSET_BASE_URL_FILE="$ROOT_DIR/local-data/daily-brief-scheduler/public-asset-base-url.txt"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$RUN_DIR/blog-growth-agent-${PORT}.pid"
LOG_FILE="$LOG_DIR/blog-growth-agent-${PORT}.log"
TMUX_SESSION="blog-growth-agent-${PORT}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" || true)"
  if [[ "$EXISTING_PID" == tmux:* ]]; then
    EXISTING_SESSION="${EXISTING_PID#tmux:}"
    if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$EXISTING_SESSION" 2>/dev/null; then
      echo "Blog Growth Agent is already running on port $PORT (tmux session $EXISTING_SESSION)."
      echo "URL: http://localhost:$PORT"
      echo "Log: $LOG_FILE"
      curl -fsS "http://$HOST:$PORT/api/automation/tistory" >/dev/null 2>&1 || true
      curl -fsS "http://$HOST:$PORT/api/automation/publication-schedule" >/dev/null 2>&1 || true
      exit 0
    fi
  elif [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Blog Growth Agent is already running on port $PORT (pid $EXISTING_PID)."
    echo "URL: http://localhost:$PORT"
    echo "Log: $LOG_FILE"
    curl -fsS "http://$HOST:$PORT/api/automation/tistory" >/dev/null 2>&1 || true
    curl -fsS "http://$HOST:$PORT/api/automation/publication-schedule" >/dev/null 2>&1 || true
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Not starting another server."
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
  exit 1
fi

cd "$ROOT_DIR"

if [[ -z "$BLOGGER_PUBLIC_ASSET_BASE_URL" && -f "$PUBLIC_ASSET_BASE_URL_FILE" ]]; then
  STORED_PUBLIC_ASSET_BASE_URL="$(head -n 1 "$PUBLIC_ASSET_BASE_URL_FILE" | tr -d '\r\n' || true)"
  if [[ "$STORED_PUBLIC_ASSET_BASE_URL" =~ ^https?:// ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *"localhost"* ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *"127.0.0.1"* ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *".local"* ]]; then
    BLOGGER_PUBLIC_ASSET_BASE_URL="${STORED_PUBLIC_ASSET_BASE_URL%/}"
    echo "Blogger public asset base URL loaded from local scheduler config."
  fi
fi

if [[ -f "$SCHEDULER_CONFIG_FILE" ]] &&
  grep -q '"enabled"[[:space:]]*:[[:space:]]*true' "$SCHEDULER_CONFIG_FILE" &&
  grep -q '"mode"[[:space:]]*:[[:space:]]*"publish_live_guarded"' "$SCHEDULER_CONFIG_FILE"; then
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED="${BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED:-true}"
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION="${BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION:-I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER}"
  BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED="${BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED:-true}"
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD="${BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD:-api}"
  BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED="${BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED:-false}"
  echo "Daily Brief live auto-publish guard flags enabled from local scheduler config."
fi

echo "Starting Blog Growth Agent on http://$HOST:$PORT ..."
echo "Log: $LOG_FILE"
: > "$LOG_FILE"

SERVER_PID=""
START_MODE="nohup"

if [[ "${USE_TMUX:-0}" == "1" ]] && command -v tmux >/dev/null 2>&1; then
  if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo "tmux session $TMUX_SESSION already exists. Not starting another server."
    exit 1
  fi

  ROOT_Q="$(printf "%q" "$ROOT_DIR")"
  HOST_Q="$(printf "%q" "$HOST")"
  PORT_Q="$(printf "%q" "$PORT")"
  DATABASE_URL_Q="$(printf "%q" "$DATABASE_URL")"
  BLOGGER_PUBLIC_ASSET_BASE_URL_Q="$(printf "%q" "$BLOGGER_PUBLIC_ASSET_BASE_URL")"
  BLOGGER_IMAGE_EMBED_MODE_Q="$(printf "%q" "$BLOGGER_IMAGE_EMBED_MODE")"
  BLOG_PUBLIC_BASE_URL_Q="$(printf "%q" "$BLOG_PUBLIC_BASE_URL")"
  NEXT_PUBLIC_APP_URL_Q="$(printf "%q" "$NEXT_PUBLIC_APP_URL")"
  BLOGGER_OAUTH_REDIRECT_ORIGIN_Q="$(printf "%q" "$BLOGGER_OAUTH_REDIRECT_ORIGIN")"
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED_Q="$(printf "%q" "${BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED:-}")"
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION_Q="$(printf "%q" "${BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION:-}")"
  BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED_Q="$(printf "%q" "${BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED:-}")"
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD_Q="$(printf "%q" "$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD")"
  BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED_Q="$(printf "%q" "$BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED")"
  BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION_Q="$(printf "%q" "$BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION")"
  BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS_Q="$(printf "%q" "$BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS")"
  BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL_Q="$(printf "%q" "$BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL")"
  PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED_Q="$(printf "%q" "$PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED")"
  LOG_FILE_Q="$(printf "%q" "$LOG_FILE")"
  TMUX_COMMAND="cd $ROOT_Q && exec env NODE_ENV=development HOST=$HOST_Q PORT=$PORT_Q DATABASE_URL=$DATABASE_URL_Q BLOGGER_PUBLIC_ASSET_BASE_URL=$BLOGGER_PUBLIC_ASSET_BASE_URL_Q BLOGGER_IMAGE_EMBED_MODE=$BLOGGER_IMAGE_EMBED_MODE_Q BLOG_PUBLIC_BASE_URL=$BLOG_PUBLIC_BASE_URL_Q NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL_Q BLOGGER_OAUTH_REDIRECT_ORIGIN=$BLOGGER_OAUTH_REDIRECT_ORIGIN_Q BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED=$BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED_Q BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION=$BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION_Q BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=$BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED_Q BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD=$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD_Q BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED=$BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED_Q BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION=$BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION_Q BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS=$BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS_Q BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL=$BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL_Q PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED=$PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED_Q npm run dev -- -H $HOST_Q -p $PORT_Q >>$LOG_FILE_Q 2>&1"

  nohup tmux new-session -d -s "$TMUX_SESSION" "$TMUX_COMMAND" >/dev/null 2>&1
  echo "tmux:$TMUX_SESSION" > "$PID_FILE"
  START_MODE="tmux"
  echo "Started tmux session $TMUX_SESSION."
else
  nohup bash -lc '
    cd "$1"
    exec env \
      NODE_ENV=development \
      HOST="$2" \
      PORT="$3" \
      DATABASE_URL="$4" \
      BLOGGER_PUBLIC_ASSET_BASE_URL="$5" \
      BLOGGER_IMAGE_EMBED_MODE="$6" \
      BLOG_PUBLIC_BASE_URL="$7" \
      NEXT_PUBLIC_APP_URL="$8" \
      BLOGGER_OAUTH_REDIRECT_ORIGIN="$9" \
      BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED="${10}" \
      BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION="${11}" \
      BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED="${12}" \
      BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD="${13}" \
      BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED="${14}" \
      BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION="${15}" \
      BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS="${16}" \
      BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL="${17}" \
      PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED="${18}" \
      npm run dev -- -H "$2" -p "$3"
  ' bash "$ROOT_DIR" "$HOST" "$PORT" "$DATABASE_URL" "$BLOGGER_PUBLIC_ASSET_BASE_URL" "$BLOGGER_IMAGE_EMBED_MODE" "$BLOG_PUBLIC_BASE_URL" "$NEXT_PUBLIC_APP_URL" "$BLOGGER_OAUTH_REDIRECT_ORIGIN" "${BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED:-}" "${BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION:-}" "${BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED:-}" "$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD" "$BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED" "$BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION" "$BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS" "$BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL" "$PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED" >"$LOG_FILE" 2>&1 < /dev/null &

  SERVER_PID="$!"
  echo "$SERVER_PID" > "$PID_FILE"
  echo "Started pid $SERVER_PID."
fi

echo "URL: http://$HOST:$PORT"
echo "To inspect logs: tail -f \"$LOG_FILE\""

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if command -v curl >/dev/null 2>&1 && curl -fsS "http://$HOST:$PORT/" >/dev/null 2>&1; then
    curl -fsS "http://$HOST:$PORT/api/automation/tistory" >/dev/null 2>&1 || true
    curl -fsS "http://$HOST:$PORT/api/automation/publication-schedule" >/dev/null 2>&1 || true
    if [[ "$START_MODE" == "nohup" ]] && command -v lsof >/dev/null 2>&1; then
      LISTENER_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
      if [[ -n "$LISTENER_PID" ]]; then
        echo "$LISTENER_PID" > "$PID_FILE"
        SERVER_PID="$LISTENER_PID"
        echo "Tracking listener pid $LISTENER_PID."
      fi
    fi
    echo "Health check passed: http://$HOST:$PORT/"
    exit 0
  fi
  if [[ "$START_MODE" == "tmux" ]]; then
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      echo "tmux session exited before health check passed."
      echo "Recent log:"
      tail -40 "$LOG_FILE" || true
      rm -f "$PID_FILE"
      exit 1
    fi
  elif ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server process exited before health check passed."
    echo "Recent log:"
    tail -40 "$LOG_FILE" || true
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "Server process is running, but health check did not pass yet."
echo "Check logs: tail -f \"$LOG_FILE\""
