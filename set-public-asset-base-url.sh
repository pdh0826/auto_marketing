#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$ROOT_DIR/local-data/daily-brief-scheduler"
CONFIG_FILE="$CONFIG_DIR/public-asset-base-url.txt"

usage() {
  echo "Usage: $0 https://public.example.com"
}

URL="${1:-}"
if [[ -z "$URL" ]]; then
  usage >&2
  exit 2
fi

URL="${URL%/}"
if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "Public asset base URL must start with http:// or https://." >&2
  exit 2
fi

if [[ "$URL" == *"localhost"* || "$URL" == *"127.0.0.1"* || "$URL" == *".local"* ]]; then
  echo "Public asset base URL must be reachable by Blogger; localhost/127.0.0.1/.local are not allowed." >&2
  exit 2
fi

mkdir -p "$CONFIG_DIR"
printf '%s\n' "$URL" > "$CONFIG_FILE"

echo "Saved Blogger public asset base URL: $URL"
echo "Restart Blog Growth Agent for the setting to take effect:"
echo "  $ROOT_DIR/stop.sh"
echo "  USE_TMUX=1 $ROOT_DIR/start.sh"
