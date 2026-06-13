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

## Patch 6A 수동 검증

- `/content/new`에서 글 생성 요청을 선택한 뒤 첨부 미디어 섹션을 사용할 수 있다.
- 선택된 글 생성 요청이 없으면 먼저 요청을 선택하라는 안내가 표시된다.
- 허용된 이미지/동영상 MIME type만 업로드할 수 있다.
- 이미지 최대 10MB, 영상 최대 100MB 제한을 적용한다.
- 업로드 파일은 `local-data/uploads/content-assets/{contentItemId}/`에 저장되고 Git에 포함되지 않는다.
- DB에는 파일 본문이 아니라 content asset 메타데이터만 저장된다.
- UI에는 `storagePath`가 표시되지 않는다.
- image는 이미지 미리보기, video는 controls가 있는 동영상 미리보기를 표시한다.
- caption, altText, userNote, placementHint, sortOrder, isPrimary를 수정할 수 있다.
- 자산 삭제 시 DB row와 로컬 파일을 함께 삭제한다.
- content item 삭제 시 연결된 asset 파일도 정리한다.
- 대표 미디어 단일 강제, 외부 스토리지, Blogger 업로드, LLM 호출은 구현하지 않는다.

## Patch 6B 수동 검증

- `/content/new`의 첨부 미디어 카드에서 `메타데이터 자동 추천` 버튼을 사용할 수 있다.
- 기존 caption, altText, userNote가 있으면 추천값을 채우기 전 confirm이 표시된다.
- 추천 버튼은 `POST /api/content-assets/[assetId]/suggest-metadata`를 호출한다.
- 추천 API는 추천값을 DB에 바로 저장하지 않는다.
- 추천 결과는 asset metadata edit form에 채워진다.
- 사용자가 `메타데이터 수정` 버튼을 눌러야 DB에 저장된다.
- 추천 결과 안내에 rationale과 warnings가 표시된다.
- warnings에는 파일 내용 분석 없이 메타데이터만 사용했다는 한계가 표시된다.
- OpenAI API, Local LLM, 이미지/영상 분석, Blogger API 호출은 발생하지 않는다.

## Patch 6C 수동 검증

- `/content/new` 목록에서 `상세` 링크로 `/content/[id]` 상세 화면에 이동할 수 있다.
- `/content/[id]`에서 content item 기본 정보, blog name, brand profile name, sourceMemo가 표시된다.
- `planJson`이 비어 있으면 기본 템플릿이 textarea에 표시된다.
- 유효하지 않은 JSON은 저장하지 않고 오류를 표시한다.
- 유효한 JSON object는 `PATCH /api/content-items/[id]`로 저장된다.
- 빈 `{}` 또는 빈 템플릿만으로는 `planned` 전환을 허용하지 않는다.
- 기획 항목이 있는 유효한 `planJson`은 저장 후 status를 `planned`로 전환할 수 있다.
- 첨부 미디어는 이미지/동영상 미리보기와 메타데이터를 읽기 중심으로 표시한다.
- 첨부 미디어 상세 화면에는 `storagePath`가 표시되지 않는다.
- `draftMarkdown`, `draftHtml`, `qualityScore`는 read-only로 표시되며 `draftHtml`은 실제 HTML로 렌더링하지 않는다.
- OpenAI API, Local LLM, 글 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7A 수동 검증

- `/settings/llm` Provider 섹션에서 invocationMode와 apiFormat을 선택할 수 있다.
- Provider에 baseUrl, endpointPath, defaultModel, headersJson, requestTemplateJson, cliExecutable, cliArgsJson을 저장할 수 있다.
- API Key 입력 필드는 저장/교체 전용이며 저장 후 비워진다.
- Provider 목록에는 API Key 전체값이 표시되지 않고 `hasSecret` 또는 `apiKeyLast4`만 표시된다.
- `headersJson`에 authorization, token, api-key 계열 민감 header를 넣으면 저장이 실패한다.
- CLI executable에 sh, bash, zsh, fish, sudo, rm, osascript, curl, wget을 넣으면 저장이 실패한다.
- OpenAI-compatible Provider 연결 테스트는 `/v1/chat/completions` 형태의 짧은 내부 테스트 prompt를 사용한다.
- Ollama-compatible Provider 연결 테스트는 `/api/generate` 형태의 짧은 내부 테스트 prompt를 사용한다.
- custom_http, custom_cli 테스트는 Patch 7A에서 비활성 안내를 반환한다.
- 연결 테스트 결과는 Provider의 lastTestStatus, lastTestedAt, lastTestError에 반영된다.
- 연결 테스트는 `llm_call_logs.taskType = provider_test`로 제한된 metadata만 기록한다.
- 테스트 로그 metadata에는 secret, API Key, prompt 전문, request body 전문, response 전문이 저장되지 않는다.
- 실제 content_plan, 본문 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7A-HOTFIX 수동 검증

- 잘못된 OpenAI-compatible API Key로 연결 테스트를 실행해도 응답 JSON, Provider lastTestError, llm_call_logs errorMessage, metadata.responseSummary에 API Key 일부가 표시되지 않는다.
- OpenAI HTTP 401/403 실패는 외부 error.message 전문이 아니라 `authentication_failed` 또는 `Authentication failed. Check the API key.` 수준의 안전 요약만 표시한다.
- OpenAI HTTP 404 실패는 외부 응답 전문이 아니라 endpoint/model not found 수준의 안전 요약만 표시한다.
- Ollama 실패도 외부 response body 전문을 저장하지 않고 HTTP status 기반 안전 요약만 저장한다.
- provider_test metadata에는 secret, API Key, Bearer token, prompt 전문, request body 전문, response 전문이 저장되지 않는다.
- `/settings/llm`에서 실패 응답 처리 시 `body stream already read` 오류가 표시되지 않는다.
- Local Ollama provider 연결 테스트 success 흐름은 유지된다.

## Patch 7A-HOTFIX-2 수동 검증

- OpenAI-compatible Provider의 defaultModel이 `gpt-5.4-mini`이면 연결 테스트 request body에 `max_completion_tokens`가 사용된다.
- `gpt-5`, `gpt-5.*`, `gpt-5-*`, `o1*`, `o3*`, `o4*` 계열은 `max_completion_tokens`를 사용한다.
- 그 외 구형 chat-completions 호환 모델은 `max_tokens`를 사용한다.
- OpenAI-compatible HTTP 400 실패는 외부 error body 전문이 아니라 `parameter_error` 또는 provider parameter 확인 수준의 안전 요약만 저장한다.
- Local Ollama provider 연결 테스트 success 흐름은 유지된다.
- provider_test 로그에는 API Key, Bearer token, request body 전문, response body 전문이 저장되지 않는다.

## Patch 7B 수동 검증

- `/content/[id]` 상세 화면에 `Content Plan Dry Run` 섹션이 표시된다.
- 화면은 `GET /api/settings/llm/task-routes`를 재사용해 `content_plan` route를 표시한다.
- Primary Provider/Model, Fallback Provider/Model, Provider lastTestStatus, lastTestedAt, lastTestError가 표시된다.
- `Dry Run` 버튼은 실제 LLM 호출 없이 readiness checks와 prompt preview만 생성한다.
- readiness는 route 존재, route 활성화, primary provider/model 존재 및 활성화, provider test success, sourceMemo 또는 targetKeyword 존재 여부를 fail 조건으로 판단한다.
- blog 누락, brand 누락, media 없음, fallback 없음, fallback 중복, fallback test 실패는 warning으로 표시된다.
- prompt preview는 system, user, outputFormat으로 분리되어 화면에만 표시된다.
- prompt preview에는 API Key, apiKeyLast4, secretRef 원문, encryptedValue, headersJson, requestTemplateJson, storagePath가 포함되지 않는다.
- Dry Run은 `planJson`을 자동 저장하지 않고 `llm_call_logs`를 생성하지 않는다.
- OpenAI API, Ollama API, Local LLM HTTP 호출, Blogger API 호출은 발생하지 않는다.
