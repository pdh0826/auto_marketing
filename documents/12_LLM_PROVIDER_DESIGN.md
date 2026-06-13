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
