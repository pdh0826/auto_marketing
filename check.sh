#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3004}"
HOST="${HOST:-127.0.0.1}"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$RUN_DIR/blog-growth-agent-${PORT}.pid"
LOG_FILE="$LOG_DIR/blog-growth-agent-${PORT}.log"
TMUX_SESSION="blog-growth-agent-${PORT}"
WEB_URL="http://${HOST}:${PORT}/"
AUTOMATION_URL="http://${HOST}:${PORT}/automation/daily-brief"
BLOGGER_PUBLIC_ASSET_BASE_URL="${BLOGGER_PUBLIC_ASSET_BASE_URL:-}"
BLOGGER_IMAGE_EMBED_MODE="${BLOGGER_IMAGE_EMBED_MODE:-compressed_jpeg_data_url}"
BLOGGER_OAUTH_REDIRECT_ORIGIN="${BLOGGER_OAUTH_REDIRECT_ORIGIN:-http://localhost:${PORT}}"
BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD="${BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD:-}"
BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED="${BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED:-}"
PUBLIC_ASSET_BASE_URL_FILE="$ROOT_DIR/local-data/daily-brief-scheduler/public-asset-base-url.txt"
SCHEDULER_CONFIG_FILE="$ROOT_DIR/local-data/daily-brief-scheduler/config.json"

if [[ -z "$BLOGGER_PUBLIC_ASSET_BASE_URL" && -f "$PUBLIC_ASSET_BASE_URL_FILE" ]]; then
  STORED_PUBLIC_ASSET_BASE_URL="$(head -n 1 "$PUBLIC_ASSET_BASE_URL_FILE" | tr -d '\r\n' || true)"
  if [[ "$STORED_PUBLIC_ASSET_BASE_URL" =~ ^https?:// ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *"localhost"* ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *"127.0.0.1"* ]] &&
    [[ "$STORED_PUBLIC_ASSET_BASE_URL" != *".local"* ]]; then
    BLOGGER_PUBLIC_ASSET_BASE_URL="${STORED_PUBLIC_ASSET_BASE_URL%/}"
  fi
fi

if [[ -z "$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD" && -f "$SCHEDULER_CONFIG_FILE" ]] &&
  grep -q '"enabled"[[:space:]]*:[[:space:]]*true' "$SCHEDULER_CONFIG_FILE" &&
  grep -q '"mode"[[:space:]]*:[[:space:]]*"publish_live_guarded"' "$SCHEDULER_CONFIG_FILE"; then
  BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD="api"
fi

if [[ -z "$BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED" && "$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD" == "blogger_ui" ]]; then
  BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED="true"
fi

OUTPUT_JSON=0
if [[ "${1:-}" == "--json" ]]; then
  OUTPUT_JSON=1
elif [[ "${1:-}" != "" ]]; then
  echo "Usage: $0 [--json]" >&2
  exit 2
fi

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

checked_at() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

PROCESS_STATUS="stopped"
PID_VALUE="-"
TMUX_VALUE="-"
PROCESS_DETAIL="no tracked pid or tmux session"

if [[ -f "$PID_FILE" ]]; then
  TRACKED="$(cat "$PID_FILE" || true)"
  if [[ "$TRACKED" == tmux:* ]]; then
    TMUX_VALUE="${TRACKED#tmux:}"
    PID_VALUE="tmux"
    if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$TMUX_VALUE" 2>/dev/null; then
      PROCESS_STATUS="running"
      PROCESS_DETAIL="tracked tmux session is running"
    else
      PROCESS_DETAIL="tracked tmux session is not running"
    fi
  elif [[ -n "$TRACKED" ]]; then
    PID_VALUE="$TRACKED"
    if kill -0 "$TRACKED" 2>/dev/null; then
      PROCESS_STATUS="running"
      PROCESS_DETAIL="tracked pid is running"
    else
      PROCESS_DETAIL="tracked pid is not running"
    fi
  fi
elif command -v tmux >/dev/null 2>&1 && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  PROCESS_STATUS="running"
  PID_VALUE="tmux"
  TMUX_VALUE="$TMUX_SESSION"
  PROCESS_DETAIL="expected tmux session is running without pid file"
fi

PORT_STATUS="down"
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PORT_STATUS="listening"
  if [[ "$PROCESS_STATUS" == "stopped" ]]; then
    PROCESS_STATUS="untracked"
    PROCESS_DETAIL="port is listening but tracked pid/tmux was not found"
  fi
fi

http_check() {
  local url="$1"
  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl_missing|0'
    return 0
  fi

  local code
  if code="$(curl -L -sS -o /dev/null -m 5 -w "%{http_code}" "$url" 2>/dev/null)"; then
    if [[ "$code" =~ ^[23] ]]; then
      printf 'ok|%s' "$code"
    else
      printf 'down|%s' "$code"
    fi
  else
    printf 'down|0'
  fi
}

WEB_CHECK="$(http_check "$WEB_URL")"
WEB_HTTP_STATUS="${WEB_CHECK%%|*}"
WEB_HTTP_CODE="${WEB_CHECK##*|}"
AUTOMATION_CHECK="$(http_check "$AUTOMATION_URL")"
AUTOMATION_HTTP_STATUS="${AUTOMATION_CHECK%%|*}"
AUTOMATION_HTTP_CODE="${AUTOMATION_CHECK##*|}"

LOG_STATUS="ok"
LOG_DETAIL="log file exists"
if [[ ! -f "$LOG_FILE" ]]; then
  LOG_STATUS="no_log"
  LOG_DETAIL="log file does not exist yet"
elif tail -120 "$LOG_FILE" | grep -Eiq "EADDRINUSE|Failed to compile|Module not found|Unhandled|uncaught|ECONNREFUSED|FATAL|PrismaClientInitializationError"; then
  LOG_STATUS="warning"
  LOG_DETAIL="recent log contains a fatal/error pattern"
fi

recommended_action_for() {
  local http_status="$1"
  if [[ "$http_status" == "ok" && "$LOG_STATUS" != "warning" ]]; then
    printf 'none'
  elif [[ "$PROCESS_STATUS" == "stopped" ]]; then
    printf 'start'
  elif [[ "$http_status" == "curl_missing" ]]; then
    printf 'install_curl_or_use_process_check'
  else
    printf 'restart_or_inspect_logs'
  fi
}

WEB_ACTION="$(recommended_action_for "$WEB_HTTP_STATUS")"
AUTOMATION_ACTION="$(recommended_action_for "$AUTOMATION_HTTP_STATUS")"
LOG_ACTION="none"
if [[ "$LOG_STATUS" == "warning" ]]; then
  LOG_ACTION="restart_or_inspect_logs"
elif [[ "$LOG_STATUS" == "no_log" && "$PROCESS_STATUS" == "stopped" ]]; then
  LOG_ACTION="start"
fi

OVERALL_STATUS="ok"
if [[ "$WEB_HTTP_STATUS" == "ok" && "$AUTOMATION_HTTP_STATUS" == "ok" && "$LOG_STATUS" != "warning" ]]; then
  OVERALL_STATUS="ok"
elif [[ "$PROCESS_STATUS" == "stopped" && "$WEB_HTTP_STATUS" != "ok" && "$AUTOMATION_HTTP_STATUS" != "ok" ]]; then
  OVERALL_STATUS="down"
else
  OVERALL_STATUS="degraded"
fi

if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  cat <<JSON
{
  "version": "blog_growth_agent_local_monitoring_contract:v1",
  "checked_at": "$(checked_at)",
  "overall_status": "$OVERALL_STATUS",
  "root_dir": "$(json_escape "$ROOT_DIR")",
  "run_dir": "$(json_escape "$RUN_DIR")",
  "log_dir": "$(json_escape "$LOG_DIR")",
  "port": $PORT,
  "host": "$(json_escape "$HOST")",
  "web_url": "$(json_escape "$WEB_URL")",
  "automation_url": "$(json_escape "$AUTOMATION_URL")",
  "blogger_public_asset_base_url_configured": $([[ -n "$BLOGGER_PUBLIC_ASSET_BASE_URL" ]] && printf 'true' || printf 'false'),
  "blogger_public_asset_base_url": "$(json_escape "$BLOGGER_PUBLIC_ASSET_BASE_URL")",
  "blogger_image_embed_mode": "$(json_escape "$BLOGGER_IMAGE_EMBED_MODE")",
  "blogger_oauth_redirect_origin": "$(json_escape "$BLOGGER_OAUTH_REDIRECT_ORIGIN")",
  "blogger_oauth_redirect_uri": "$(json_escape "$BLOGGER_OAUTH_REDIRECT_ORIGIN/api/settings/blogger/oauth/callback")",
  "daily_brief_auto_publish_method": "$(json_escape "$BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD")",
  "daily_brief_blogger_ui_auto_publish_enabled": $([[ "$BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED" == "true" ]] && printf 'true' || printf 'false'),
  "services": [
    {
      "name": "Blog Growth Agent web",
      "role": "web",
      "process_status": "$PROCESS_STATUS",
      "process_detail": "$(json_escape "$PROCESS_DETAIL")",
      "pid": "$(json_escape "$PID_VALUE")",
      "port_status": "$PORT_STATUS",
      "http_status": "$WEB_HTTP_STATUS",
      "http_code": "$WEB_HTTP_CODE",
      "url": "$(json_escape "$WEB_URL")",
      "pid_file": "$(json_escape "$PID_FILE")",
      "tmux_session": "$(json_escape "$TMUX_VALUE")",
      "log_file": "$(json_escape "$LOG_FILE")",
      "recommended_action": "$WEB_ACTION"
    },
    {
      "name": "Daily Brief automation page",
      "role": "automation_ui",
      "process_status": "$PROCESS_STATUS",
      "process_detail": "$(json_escape "$PROCESS_DETAIL")",
      "pid": "$(json_escape "$PID_VALUE")",
      "port_status": "$PORT_STATUS",
      "http_status": "$AUTOMATION_HTTP_STATUS",
      "http_code": "$AUTOMATION_HTTP_CODE",
      "url": "$(json_escape "$AUTOMATION_URL")",
      "pid_file": "$(json_escape "$PID_FILE")",
      "tmux_session": "$(json_escape "$TMUX_VALUE")",
      "log_file": "$(json_escape "$LOG_FILE")",
      "recommended_action": "$AUTOMATION_ACTION"
    },
    {
      "name": "Blog Growth Agent log",
      "role": "log",
      "process_status": "$PROCESS_STATUS",
      "process_detail": "$(json_escape "$PROCESS_DETAIL")",
      "pid": "$(json_escape "$PID_VALUE")",
      "port_status": "$PORT_STATUS",
      "http_status": "$LOG_STATUS",
      "http_code": "-",
      "url": "-",
      "pid_file": "$(json_escape "$PID_FILE")",
      "tmux_session": "$(json_escape "$TMUX_VALUE")",
      "log_file": "$(json_escape "$LOG_FILE")",
      "recommended_action": "$LOG_ACTION"
    }
  ],
  "commands": {
    "start": "$(json_escape "$ROOT_DIR/start.sh")",
    "stop": "$(json_escape "$ROOT_DIR/stop.sh")",
    "check_text": "$(json_escape "$ROOT_DIR/check.sh")",
    "check_json": "$(json_escape "$ROOT_DIR/check.sh --json")",
    "restart_sequence": [
      "$(json_escape "$ROOT_DIR/stop.sh")",
      "$(json_escape "$ROOT_DIR/start.sh")",
      "$(json_escape "$ROOT_DIR/check.sh --json")"
    ]
  }
}
JSON
else
  echo "Blog Growth Agent: $OVERALL_STATUS"
  echo "Web: $WEB_HTTP_STATUS ($WEB_HTTP_CODE) $WEB_URL"
  echo "Automation UI: $AUTOMATION_HTTP_STATUS ($AUTOMATION_HTTP_CODE) $AUTOMATION_URL"
  echo "Process: $PROCESS_STATUS ($PROCESS_DETAIL)"
  echo "Log: $LOG_STATUS ($LOG_DETAIL)"
  echo "Recommended action: $WEB_ACTION"
fi

if [[ "$OVERALL_STATUS" == "ok" ]]; then
  exit 0
fi
exit 1
