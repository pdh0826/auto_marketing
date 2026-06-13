# 09_TEST_PLAN

## 기본 검증

```bash
npm run lint
npm run typecheck
npm run build
```

## MVP 기능 검증

- LLM Provider 등록 가능
- LLM Model 등록 가능
- LLM Task Route 등록 가능
- LLM Call Log 조회 가능
- OpenAI/Local LLM 연결 테스트 가능
- 블로그 프로필 저장 가능
- 서비스 프로필 저장 가능
- 글 생성 요청 저장 가능
- 기획서 생성 가능
- 품질검사 차단 가능
- 테스트 Blogger 초안 저장 가능
- 예약 발행 로그 확인 가능

## Patch 3 수동 검증

- `/settings/llm`에서 Provider 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- Provider 생성/수정/삭제가 가능하다.
- Provider 화면에는 API Key 원문 입력 필드가 없다.
- Model 생성 시 Provider를 선택할 수 있다.
- Task Route 생성 시 primary Provider에 속한 Model만 primary Model 후보로 표시된다.
- Task Route 생성 시 fallback Provider에 속한 Model만 fallback Model 후보로 표시된다.
- Task Route 중복 생성 실패 시 오류 메시지가 화면에 표시된다.
- Call Log metadata는 전체 원문이 아니라 접기/요약 형태로 표시된다.
