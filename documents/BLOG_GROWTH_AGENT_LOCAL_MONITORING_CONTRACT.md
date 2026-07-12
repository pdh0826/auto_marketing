# Blog Growth Agent Local Monitoring Contract

## Purpose

같은 Mac 안의 통합 모니터링 웹은 이 문서를 기준으로 Blog Growth Agent 로컬 개발 서비스를 감시하고 제어한다. 이 계약은 로컬 Next.js 웹앱 기동 여부, 주요 UI 접근성, 로컬 로그 상태만 다루며, Blogger publish/write, OAuth reconnect, token refresh, DB migration, LLM 호출, deploy/service-control은 포함하지 않는다.

## Service Endpoints

| Service | Process owner | Health URL | Expected |
| --- | --- | --- | --- |
| Blog Growth Agent web | `start.sh` | `http://127.0.0.1:3004/` | HTTP 2xx/3xx reachable |
| Daily Brief automation page | `start.sh` | `http://127.0.0.1:3004/automation/daily-brief` | HTTP 2xx/3xx reachable |

The Blog Growth Agent local web port is fixed at `3004` for local operation.

## Control Commands

| Action | Command | Use from dashboard |
| --- | --- | --- |
| Start | `/Users/pdh0826/blog-growth-agent/start.sh` | 서비스가 내려가 있거나 처음 기동할 때 |
| Stop | `/Users/pdh0826/blog-growth-agent/stop.sh` | 로컬 개발 서비스를 종료할 때 |
| Check, text | `/Users/pdh0826/blog-growth-agent/check.sh` | 사람이 터미널에서 확인할 때 |
| Check, JSON | `/Users/pdh0826/blog-growth-agent/check.sh --json` | 통합 모니터링 웹이 파싱할 때 |

Recommended restart sequence:

```bash
/Users/pdh0826/blog-growth-agent/stop.sh
/Users/pdh0826/blog-growth-agent/start.sh
/Users/pdh0826/blog-growth-agent/check.sh --json
```

## Machine-Readable Status

The monitoring dashboard should prefer:

```bash
/Users/pdh0826/blog-growth-agent/check.sh --json
```

Exit code:

| Exit | Meaning |
| --- | --- |
| `0` | Expected service URLs are reachable and recent logs do not show fatal patterns |
| `1` | Service is down or degraded |
| `2` | Invalid `check.sh` option |

Top-level JSON fields:

| Field | Meaning |
| --- | --- |
| `version` | Contract version, currently `blog_growth_agent_local_monitoring_contract:v1` |
| `checked_at` | UTC timestamp |
| `overall_status` | `ok`, `degraded`, or `down` |
| `root_dir` | Repository root |
| `run_dir` | Runtime state directory |
| `log_dir` | Runtime log directory |
| `port` | Local web port |
| `host` | Local bind/check host |
| `web_url` | Main web URL |
| `automation_url` | Daily Brief scheduler/automation UI URL |
| `services[]` | Per-service process, HTTP/log, and recommended action |
| `commands` | Absolute control command paths |

Per-service fields:

| Field | Meaning |
| --- | --- |
| `name` | Human label |
| `role` | `web`, `automation_ui`, or `log` |
| `process_status` | `running`, `untracked`, or `stopped` |
| `process_detail` | Short process diagnostic |
| `pid` | Tracked PID, `tmux`, or `-` |
| `port_status` | `listening` or `down` |
| `http_status` | `ok`, `down`, `curl_missing`, `ok`/`warning`/`no_log` for log role |
| `http_code` | HTTP response code, `0`, or `-` for log role |
| `url` | URL used for reachability, or `-` for log role |
| `pid_file` | PID/tmux tracking file maintained by `start.sh` |
| `tmux_session` | tmux session name, or `-` |
| `log_file` | Service log path |
| `recommended_action` | `none`, `start`, `restart_or_inspect_logs`, or `install_curl_or_use_process_check` |

## Process Checks

The dashboard can show process diagnostics by reading `check.sh --json`. Service health should be based on JSON status rather than raw `ps -ef` alone.

Runtime files:

| Item | Path |
| --- | --- |
| PID/tmux tracking file | `/Users/pdh0826/blog-growth-agent/.run/blog-growth-agent-3004.pid` |
| Log file | `/Users/pdh0826/blog-growth-agent/logs/blog-growth-agent-3004.log` |
| Expected tmux session | `blog-growth-agent-3004` |

Optional manual diagnostics:

```bash
cat /Users/pdh0826/blog-growth-agent/.run/blog-growth-agent-3004.pid
ps -ef | grep '[b]log-growth-agent'
lsof -nP -iTCP:3004 -sTCP:LISTEN
tmux has-session -t blog-growth-agent-3004
```

## Dashboard Interpretation

| Condition | Meaning | Suggested dashboard control |
| --- | --- | --- |
| `overall_status=ok` | Web and Daily Brief automation UI are reachable | Show healthy |
| `overall_status=degraded` | Process exists but URL fails, log has fatal pattern, or service is untracked | Show warning, offer restart and log view |
| `overall_status=down` | Expected service URLs do not respond and no tracked process is running | Show stopped/down, offer start |
| `process_status=running`, `http_status=down` | Process exists but app route is unhealthy | Offer restart, show last log lines |
| `process_status=untracked`, `http_status=ok` | Something responds on port 3004, but not from tracked PID/tmux files | Show reachable but untracked; avoid stopping automatically |
| `recommended_action=start` | No reachable tracked service | Start button should run `start.sh` |
| `recommended_action=restart_or_inspect_logs` | Process/log/route is suspicious | Restart button should run `stop.sh`, then `start.sh`; log button should show log tail |

Polling guidance:

| Situation | Interval |
| --- | --- |
| Normal dashboard monitoring | 15-30 seconds |
| Immediately after start/restart | 2-5 seconds for up to 60 seconds |
| Failure state | Show last 80 log lines and keep polling every 15 seconds |

## Log Display

For the dashboard, show only the tail of the log by default:

```bash
tail -80 /Users/pdh0826/blog-growth-agent/logs/blog-growth-agent-3004.log
```

Logs can include local paths and development diagnostics. Do not expose secrets, raw Blogger payloads, OAuth tokens, refresh tokens, DB URLs, cookies, headers, full draft HTML/Markdown bodies, LLM prompts, or raw provider responses in the monitoring UI.

## Integration Prompt

Use this text when adding Blog Growth Agent to the separate integrated monitoring web:

```text
Blog Growth Agent 모니터링 대상 추가해줘.

계약 문서:
 /Users/pdh0826/blog-growth-agent/documents/BLOG_GROWTH_AGENT_LOCAL_MONITORING_CONTRACT.md

상태 체크:
 /Users/pdh0826/blog-growth-agent/check.sh --json

기동:
 /Users/pdh0826/blog-growth-agent/start.sh

중지:
 /Users/pdh0826/blog-growth-agent/stop.sh

웹 URL:
 http://127.0.0.1:3004/

Daily Brief 자동화 URL:
 http://127.0.0.1:3004/automation/daily-brief

JSON의 overall_status가 ok면 정상, degraded면 일부 장애, down이면 기동 안 됨으로 표시해줘.
services[].recommended_action이 start면 기동 버튼, restart_or_inspect_logs면 재기동/로그확인 버튼을 보여줘.
```

## Boundaries

The integrated monitoring web may:

- Run `check.sh --json`.
- Run `start.sh`.
- Run `stop.sh`.
- Display redacted/tail-only local logs.
- Show process, PID/tmux, URL, HTTP code, and exit-code metadata.

The integrated monitoring web must not use this contract to:

- Read `.env`, `.env.local`, OAuth secrets, encrypted values, or token files.
- Connect to DB, apply SQL, or run migrations.
- Execute Blogger draft save, Blogger publish/write, OAuth reconnect, token refresh, LLM calls, or deploy/service-control actions.
- Modify content items, generated posts, approval rows, scheduler config, or local data.
- Claim live Blogger publishing proof beyond local service reachability.
