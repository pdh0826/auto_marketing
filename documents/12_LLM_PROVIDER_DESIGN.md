# 12_LLM_PROVIDER_DESIGN

## 목표

Blog Growth Agent는 OpenAI API와 로컬 LLM을 모두 지원한다.
관리자는 웹 설정에서 기본 Provider, 모델, 작업별 라우팅, fallback 정책을 변경할 수 있어야 한다.

## 작업별 라우팅

| 작업 | 권장 기본값 | 대체 |
|---|---|---|
| 글 기획서 생성 | OpenAI API | Local LLM |
| 본문 초안 생성 | OpenAI API | Local LLM |
| HTML 변환 | Rule-based + Local LLM | OpenAI API |
| 품질검사 | Rule-based + Local LLM | OpenAI API |
| 금지표현 검사 | Rule-based 필수 | LLM 보조 |
| CTA 생성 | Local LLM | OpenAI API |
| 문체 변환 | Local LLM | OpenAI API |

## Provider 추상화

```text
Content Tasks
→ LLM Router
→ OpenAI Provider / Local LLM Provider
```

## 필수 로그

- task_type
- provider_type
- model_name
- status
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- error_message

## 보안 원칙

- API Key는 평문 저장 금지
- 화면에 전체 API Key 표시 금지
- 로그에 API Key 출력 금지
- 민감 자료는 로컬 LLM 우선 처리 가능해야 함

## Patch 3 설정 화면

`/settings/llm` 화면은 Patch 2의 PostgreSQL + Prisma CRUD API를 사용해 다음 데이터를 관리한다.

- LLM Provider
- LLM Model
- LLM Task Route
- LLM Call Log

Provider, Model, Task Route는 목록 조회, 생성, 수정, 삭제를 지원한다.
Call Log는 최근 로그 목록 조회만 지원한다.

### Patch 3 제외 항목

- 실제 OpenAI API 호출
- 실제 Local LLM HTTP 호출
- API Key 원문 입력/저장
- Google OAuth
- Blogger API
- 발행 기능

### 화면 보안 원칙

- Provider 화면은 `secretRef`, `apiKeyLast4` 같은 안전한 메타 정보만 다룬다.
- API Key 전체값을 입력하거나 표시하지 않는다.
- Call Log 화면은 secret, prompt 전문, 본문 원문을 표시하지 않는다.
- metadata는 요약/접기 형태로만 표시한다.

## Patch 7A Provider Invocation 확장

Patch 7A는 Provider 등록 구조를 `providerType`만으로 판단하지 않고 `invocationMode`와 `apiFormat` 중심으로 확장한다.

### Provider 유형

- `external_http`: 외부 HTTP LLM API
- `local_http`: 로컬 HTTP LLM API
- `cli`: 로컬 CLI 실행 기반 Provider

기존 `openai`, `local` providerType 값은 호환성을 위해 유지한다.

### API Format

- `openai_compatible`: `/v1/chat/completions` 형태의 외부 API 테스트
- `ollama_compatible`: `/api/generate` 형태의 로컬 Ollama API 테스트
- `custom_http`: 설정 저장은 가능하지만 Patch 7A에서는 자유 template 실행을 제한한다.
- `custom_cli`: 설정 저장은 가능하지만 Patch 7A에서는 CLI 테스트 실행을 비활성화한다.

### Secret 처리

- API Key 원문은 DB에 저장하지 않는다.
- API Key는 서버에서 `LLM_SECRET_ENCRYPTION_KEY`를 사용해 암호화한 뒤 `llm_provider_secrets.encryptedValue`에 저장한다.
- 화면과 API 응답에는 `hasSecret`, `apiKeyLast4`, `secretRef`만 표시한다.
- 저장 후 API Key 전체값은 다시 표시하지 않는다.
- `LLM_SECRET_ENCRYPTION_KEY`가 없으면 secret 저장과 secret이 필요한 연결 테스트는 실패한다.

### 연결 테스트 로그

- 연결 테스트 API는 `POST /api/settings/llm/providers/[id]/test`다.
- 테스트 로그는 `llm_call_logs.taskType = provider_test`로 저장한다.
- 로그 metadata에는 `purpose`, `invocationMode`, `apiFormat`, `httpStatus`, `responseSummary`, `latencyMs` 같은 제한된 진단 정보만 저장한다.
- secret, API Key, request body 전문, response 전문, prompt 전문은 저장하지 않는다.
- 외부 Provider의 error response 전문은 저장하지 않고 HTTP status 기반의 안전 요약만 저장한다.
- OpenAI-compatible 401/403은 `authentication_failed` 또는 `Authentication failed. Check the API key.` 수준으로만 표시한다.
- OpenAI-compatible 400은 외부 error body 전문이 아니라 `parameter_error` 수준으로만 표시한다.
- OpenAI-compatible 테스트 요청은 모델명에 따라 `max_tokens` 또는 `max_completion_tokens`를 선택한다.
- `gpt-5`, `gpt-5.*`, `gpt-5-*`, `o1*`, `o3*`, `o4*` 계열은 `max_completion_tokens`를 사용한다.
- Bearer token, `sk-` 계열 API Key, API key/token/secret fragment로 보이는 문자열은 저장 전 redaction을 통과시킨다.

### CLI 보안 원칙

- raw shell command는 저장하거나 실행하지 않는다.
- CLI 설정은 `cliExecutable`과 `cliArgsJson` string array로만 저장한다.
- Patch 7A에서는 CLI 연결 테스트 실행을 비활성화한다.
- 후속 패치에서 실행을 열 경우 `child_process.spawn`과 `shell: false`, timeout, stdout/stderr 길이 제한, dangerous executable 차단을 적용한다.
