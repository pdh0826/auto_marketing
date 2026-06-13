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

## Patch 4 수동 검증

- `/blogs`에서 블로그 프로필 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/blogs`에서 블로그 프로필 생성, 수정, 삭제가 가능하다.
- `/blogs`의 배열 필드는 textarea 입력을 쉼표 또는 줄바꿈 기준으로 `String[]`로 저장한다.
- `/blogs`의 `autoPublishEnabled`는 정책 설정값으로만 표시되며 실제 자동 발행은 연결하지 않는다.
- `/blogs`에는 Blogger OAuth 실행 버튼이나 Blogger API 호출 기능이 없다.
- `/brands`에서 서비스/브랜드 프로필 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/brands`에서 서비스/브랜드 프로필 생성, 수정, 삭제가 가능하다.
- `/brands`의 배열 필드는 textarea 입력을 쉼표 또는 줄바꿈 기준으로 `String[]`로 저장한다.
- `/brands`의 `isDefault`는 단일 기본값 강제를 하지 않는다.
- `/brands`에는 OpenAI API, Local LLM, Blogger API 호출 기능이 없다.

## Patch 5 수동 검증

- `/content/new`에서 블로그 목록과 서비스/브랜드 프로필 목록을 선택할 수 있다.
- `/content/new`에서 기존 글 생성 요청 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/content/new`에서 글 생성 요청 생성, 수정, 삭제가 가능하다.
- `blogId`, `brandProfileId`가 비어 있으면 `null`로 저장된다.
- `sourceMemo` 또는 `targetKeyword` 중 하나 이상 없으면 저장을 막고 오류를 표시한다.
- `seo_keyword` 모드에서 targetKeyword가 없으면 권장 안내를 표시한다.
- `service_promotion` 모드에서 brandProfileId가 없으면 권장 안내를 표시한다.
- `existing_draft_improve`는 사용자가 직접 입력한 기존 글/초안 보강용이며 경쟁글 복사·재작성·재가공 용도가 아니라는 안내가 표시된다.
- 목록 테이블에서 sourceMemo는 전체 본문이 아니라 요약으로 표시된다.
- LLM 호출, 글 기획서 생성, 본문 생성, HTML 변환, 품질검사, Blogger 발행 기능은 없다.
