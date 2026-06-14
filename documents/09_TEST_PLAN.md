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

## Patch 7C 수동 검증

- `/content/[id]`의 `Content Plan Dry Run`에서 readiness가 통과하면 `기획서 생성` 버튼을 사용할 수 있다.
- `POST /api/content-items/[id]/generate-plan`은 `content_plan` Task Route의 primary Provider/Model로 실제 LLM 호출을 수행한다.
- primary provider 호출 자체가 실패하면 fallback Provider/Model이 있을 때 1회 fallback을 시도한다.
- JSON parse 실패나 validation 실패는 fallback하지 않고 안전한 오류 또는 후보 검증 결과를 반환한다.
- 생성 후보 planJson은 read-only preview로 표시되며 자동 저장되지 않는다.
- validation error가 있으면 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있으면 `planJson에 반영` 버튼을 사용할 수 있다.
- `planJson에 반영` 클릭 시에만 기존 `PATCH /api/content-items/[id]`로 planJson이 저장된다.
- 반영 후 Manual Plan JSON textarea가 저장된 값으로 갱신된다.
- planned 전환은 기존 버튼으로 별도 수행한다.
- `llm_call_logs`에는 taskType `content_plan`, provider/model/contentItem, status, latency, 제한된 metadata만 저장된다.
- `llm_call_logs`에는 prompt 전문, request body 전문, raw response 전문, API Key, Bearer token, secretRef 원문, encryptedValue, storagePath가 저장되지 않는다.
- 본문 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7C-HOTFIX 수동 검증

- primary provider 호출 실패 후 fallback provider 호출도 실패하면 fallback provider/model 기준으로 `llm_call_logs` failed 로그가 남는다.
- fallback이 없어서 primary 실패로 종료되면 primary provider/model 기준으로 `llm_call_logs` failed 로그가 남는다.
- provider 호출은 성공했지만 LLM 응답 JSON parse가 실패하면 해당 provider/model 기준으로 `responseSummary: json_parse_failed` failed 로그가 남는다.
- parse 실패 로그에는 prompt 전문, raw response 전문, request body 전문, API Key, Bearer token, secretRef 원문, encryptedValue, storagePath가 저장되지 않는다.

## Patch 7C-SAFETY-HOTFIX 수동 검증

- `content_plan` 후보 planJson에 `수익 보장`, `급등 확정`, `매수 추천`, `매도 추천`, `반드시 오른다`, `무조건 오른다`, `손실 없음`, `리스크 없음`, `원금 보장`, `수익률 예시`, `성공 사례`, `안전하게 매수`, `안전한 투자`, `확실한 수익`이 포함되면 validation error가 표시된다.
- validation error가 있으면 `/content/[id]`의 `planJson에 반영` 버튼이 비활성화된다.
- `무료 체험`, `지금 시작`, `신뢰할 수 있는 투자`, `매수 타이밍을 잡다`, `수익률`, `성공`은 기본적으로 validation warning으로 표시된다.
- `service_promotion` 모드에서 연결된 brand profile이 투자/주식/종목/매수/급등/투자 인사이트 관련이면 위 warning 표현도 validation error로 승격된다.
- warning만 있는 후보는 `planJson에 반영`이 가능하지만 화면에 경고가 표시된다.
- 생성 prompt는 투자/금융 서비스가 정보 제공 또는 참고 도구라는 원칙과 수익 보장/매수 추천/수익률 예시/성공 사례/안전하게 매수 금지를 포함한다.
- 안전성 validation 결과는 error/warning count만 `llm_call_logs` metadata에 반영되며 prompt 전문, raw response 전문, API Key, request body 전문은 저장되지 않는다.

## Patch 7D 수동 검증

- `GET /api/settings/llm/call-logs` 응답의 provider는 `id`, `name`, `providerType`, `invocationMode`, `apiFormat`만 포함한다.
- `GET /api/settings/llm/call-logs` 응답의 model은 `id`, `name`, `displayName`만 포함한다.
- `GET /api/settings/llm/call-logs` 응답의 contentItem은 `id`, `title`, `mode`, `status`, `targetKeyword`만 포함한다.
- call logs 응답에는 `sourceMemo`, `planJson`, `draftMarkdown`, `draftHtml`, `headersJson`, `requestTemplateJson`, `secretRef`, `apiKeyLast4`, `hasSecret`, `lastTestError`, `encryptedValue`가 포함되지 않는다.
- `POST /api/settings/llm/call-logs`는 JSON 형태의 405 Method Not Allowed 응답을 반환한다.
- `/settings/llm` Call Logs 화면은 task, status, provider, model, content summary, latency, tokens, error, createdAt, metadata만 표시한다.
- Call Logs 화면에는 prompt 전문, raw response, secret, API Key, content body를 반환하지 않는다는 안내가 표시된다.
- `/content/[id]` Generated Plan Candidate 영역은 validation status와 error/warning count를 표시한다.
- validation error가 있으면 planJson 반영 불가 안내가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있으면 검토 후 반영 가능 안내가 표시된다.

## Patch 7E 수동 검증

- `/content/[id]` Generated Plan Candidate 영역에서 `후보 편집` 버튼으로 candidate planJson textarea를 편집 모드로 전환할 수 있다.
- 후보를 편집하면 `편집된 후보는 재검증 후 반영할 수 있습니다.` 안내가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- `재검증` 버튼은 실제 LLM 호출 없이 `POST /api/content-items/[id]/validate-plan`만 호출한다.
- 잘못된 JSON을 입력하고 재검증하면 API 호출 없이 `유효하지 않은 JSON입니다. 재검증할 수 없습니다.` 안내가 표시된다.
- 위험 표현이 포함된 JSON을 재검증하면 validation error가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있는 후보를 재검증하면 warning 안내가 표시되고 `planJson에 반영` 버튼을 사용할 수 있다.
- 재검증만으로 DB의 `content_items.planJson`은 변경되지 않는다.
- 재검증만으로 `llm_call_logs`가 생성되지 않는다.
- `planJson에 반영`을 클릭해야 기존 content item PATCH 흐름으로 planJson이 저장된다.

## Patch 8A 수동 검증

- `/content/[id]`에 `Draft Markdown Dry Run` 섹션이 표시된다.
- Draft Dry Run은 저장된 `contentItem.planJson`만 사용하고, 아직 `planJson에 반영`하지 않은 Generated Plan Candidate는 사용하지 않는다.
- 저장된 `planJson`이 없으면 readiness fail과 `먼저 planJson에 반영하세요` 안내가 표시된다.
- `content_draft` Task Route가 없으면 `draft generation route not configured` fail이 표시된다.
- `content_plan` route는 draft generation 대용으로 사용되지 않는다.
- 저장된 `planJson`이 있고 `content_draft` route가 준비되어 있으면 draft prompt preview가 system/user/outputFormat으로 표시된다.
- readiness는 planJson 존재, validation, outline/coreMessage, route/provider/model enabled, provider lastTestStatus를 fail 기준으로 확인한다.
- blog/brand 누락, provider test timestamp 없음 또는 24시간 초과, attached media 없음, mediaPlan/assets 불일치, fallback 미설정 또는 fallback test 미성공은 warning으로 표시된다.
- media mapping preview는 attached media의 originalName, assetType, placementHint, caption, placeholder를 표시한다.
- prompt preview와 media mapping에는 API Key, secret, provider headers, request template, media `storagePath`가 포함되지 않는다.
- Draft Dry Run만으로 `draftMarkdown`, `draftHtml`, `llm_call_logs`가 변경되지 않는다.
- 실제 OpenAI/Ollama/Local LLM 호출, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 8B 수동 검증

- `/content/[id]`에서 Draft Dry Run readiness가 pass이면 `본문 초안 생성` 버튼을 사용할 수 있다.
- `POST /api/content-items/[id]/generate-draft`는 저장된 `planJson`과 `content_draft` Task Route만 사용한다.
- 저장된 `planJson`이 없거나 validation error가 있으면 draft generation을 수행하지 않고 JSON error를 반환한다.
- `content_draft` route가 준비되지 않았거나 primary provider/model readiness가 fail이면 draft generation을 수행하지 않는다.
- Local Ollama 또는 OpenAI-compatible Provider 호출 성공 시 `candidateDraftMarkdown`, validation, route summary, latency, markdown length가 응답된다.
- 후보 생성 직후 DB의 `draftMarkdown`은 자동 저장되지 않는다.
- 후보 textarea는 기본 read-only이며, `후보 편집` 후에는 재검증 전 `draftMarkdown에 반영` 버튼이 비활성화된다.
- 재검증은 client-side rule-based validation으로 수행하며 LLM 호출과 `llm_call_logs` 생성을 하지 않는다.
- 위험 표현이 있으면 validation error가 표시되고 `draftMarkdown에 반영`이 비활성화된다.
- warning만 있으면 안내를 표시하되 사용자가 검토 후 `draftMarkdown에 반영`할 수 있다.
- `draftMarkdown에 반영` 클릭 시 기존 content item PATCH 흐름으로 `draftMarkdown`만 저장하고 `draftHtml`은 생성하지 않는다.
- 실제 LLM 호출 결과는 `llm_call_logs`에 taskType `content_draft`로 기록하되 prompt 전문, raw response 전문, 후보 Markdown 전문, request body 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, media `storagePath`는 저장하지 않는다.
- call logs API 응답에도 후보 Markdown 전문과 민감 필드가 노출되지 않는지 확인한다.

## Patch 8B-HOTFIX 수동 검증

- Draft prompt preview에는 금융/투자/서비스 홍보 위험 문구 금지와 중립 대체 표현이 포함된다.
- `POST /api/content-items/[id]/generate-draft`에서 초안 후보 validation error가 발생하면 같은 provider/model로 repair를 1회 시도한다.
- repair는 fallback 대상이 아니며, primary/fallback 선택 이후 실제 사용된 provider/model에서만 수행된다.
- repair 성공 시 응답 metadata에 `repairAttempted: true`, `repairSucceeded: true`, 초기/최종 validation count가 표시된다.
- repair 후에도 validation error가 있으면 `repairSucceeded: false`이며 `/content/[id]`에서 반영 버튼이 비활성화된다.
- repair 여부와 결과는 Generated Draft Candidate 영역에 표시된다.
- repair 후에도 후보는 자동 저장되지 않고, `draftMarkdown에 반영` 클릭 전까지 DB의 `draftMarkdown`은 변경되지 않는다.
- `llm_call_logs` metadata에는 repair 요약 count와 `repairResponseSummary`만 저장하고 original/repaired draft 전문, prompt 전문, raw response 전문, API Key, Bearer token, provider headers, media `storagePath`는 저장하지 않는다.
- 재검증은 여전히 client-side validation이며 LLM 호출과 `llm_call_logs` 생성을 하지 않는다.

## 2026-06-14 closeout 검증 기록

실제 확인된 상태:

- 최신 커밋은 `a53094c Improve draft safety repair flow`다.
- 테스트 content item `cmqc2xqbr00011y70sxmgl65v`는 `has_plan = true`, `has_draft = true`, `has_html = false` 상태로 확인되었다.
- 최신 `content_draft` call log는 `validationOk = true`, `repairAttempted = false`, `markdownLength = 1665`, `mediaPlaceholderCount = 1`인 정상 생성 케이스로 확인되었다.
- draftMarkdown 후보는 생성 직후 자동 저장되지 않았고, 사용자가 `draftMarkdown에 반영`을 클릭했을 때만 DB에 저장되었다.
- `draftHtml`은 아직 생성하지 않았다.

다음 세션 검증 시작점:

- Patch 8C는 저장된 `draftMarkdown`을 입력으로 HTML 변환 dry-run/preview를 검증한다.
- `draftHtml` 자동 저장, Blogger OAuth/API/publish, 품질검사는 여전히 금지한다.

## Patch 8C 수동 검증

- `/content/[id]`에 `HTML Conversion Dry Run` 섹션이 표시된다.
- 저장된 `draftMarkdown`이 없으면 dry-run을 실행할 수 없고 안내가 표시된다.
- `POST /api/content-items/[id]/html-preview`는 content item, blog, brand, attached assets를 read-only로 조회한다.
- HTML Dry Run 실행 시 previewHtml, readiness checks, draft validation, media placeholder mapping, sanitization/security checks가 표시된다.
- previewHtml은 화면에만 표시되고 `content_items.draftHtml`에는 저장되지 않는다.
- 테스트 content item `cmqc2xqbr00011y70sxmgl65v`는 HTML Dry Run 후에도 `has_plan = true`, `has_draft = true`, `has_html = false` 상태를 유지해야 한다.
- media placeholder가 attached asset과 매칭되면 preview에서는 내부 file API URL만 사용하고 `storagePath`를 표시하지 않는다.
- raw HTML은 escape되고, script/iframe/form/style, `javascript:`, event handler 속성 패턴은 security readiness fail로 표시된다.
- LLM 호출, `llm_call_logs` 생성, Blogger API 호출은 발생하지 않는다.

## Patch 8D 수동 검증

- HTML Dry Run 성공 후 `previewHtml`이 편집 가능한 HTML 후보로 표시된다.
- HTML 후보를 편집하면 재검증 전 `draftHtml에 반영` 버튼이 비활성화된다.
- `POST /api/content-items/[id]/validate-html`은 DB를 변경하지 않는다.
- `<script>alert(1)</script>`, `javascript:`, `onerror=`가 포함되면 validation error가 표시된다.
- `local-data/`, `/uploads/`, `storagePath`, 로컬 절대 경로가 포함되면 validation error가 표시된다.
- `/api/content-assets/unknown/file`처럼 현재 content item의 attached asset이 아닌 media reference는 validation error가 된다.
- warning만 있는 HTML 후보는 검토 후 `draftHtml에 반영`할 수 있다.
- `POST /api/content-items/[id]/apply-html`은 서버에서 validation을 다시 수행하고, error가 없을 때만 `content_items.draftHtml`을 업데이트한다.
- validate/apply 과정에서 LLM 호출, `llm_call_logs` 생성, Blogger OAuth/API/publish는 발생하지 않는다.

## Patch 8E 수동 검증

- `/content/[id]`에 `Quality Dry Run` 섹션이 표시된다.
- 저장된 `draftHtml`이 없으면 품질검사를 실행할 수 없고 안내가 표시된다.
- `POST /api/content-items/[id]/quality-preview`는 저장된 `draftHtml`을 read-only로 검사한다.
- API 응답에는 원본 content item 객체와 원본 assets 객체를 그대로 반환하지 않는다.
- score preview, grade, metadata, structure/SEO/media/safety/Blogger compatibility 그룹별 check가 표시된다.
- `qualityScore 저장`은 후속 패치 placeholder이며 Patch 8E에서 저장하지 않는다.
- quality-preview 호출 전후 `qualityScore`, status, draftHtml, publishedAt, scheduledAt이 변경되지 않는다.
- quality-preview 호출만으로 `llm_call_logs`가 생성되지 않는다.
- 응답과 UI에는 `storagePath`, local upload path, API Key, secret, token, provider headers, request template이 포함되지 않는다.
- H1 없음, H1 2개 이상, H2/H3 부족, paragraph 부족, CTA 없음, FAQ 없음, external link rel 누락, unknown media reference, img alt 누락, 위험 HTML 패턴, 금융 위험 표현과 안전문구 누락이 check로 표시된다.

## Patch 8F 수동 검증

- `/content/[id]`에 `Publish Readiness Gate` 섹션이 표시된다.
- `POST /api/content-items/[id]/publish-readiness`는 saved planJson, draftMarkdown, draftHtml, HTML validation, quality preview 결과를 read-only로 평가한다.
- 응답에는 `ready`, `contentReady`, `publishReady`, stage, summary, checks, blockingIssues, warnings, metadata가 포함된다.
- Patch 8F에서는 Blogger 연결과 사용자 최종 승인 저장이 없으므로 `publishReady`와 top-level `ready`는 false다.
- Blogger connection은 `not_configured` placeholder로 표시된다.
- publish-readiness 호출 전후 status, qualityScore, draftHtml, publishedAt, scheduledAt이 변경되지 않는다.
- publish-readiness 호출만으로 `llm_call_logs`가 생성되지 않는다.
- 응답과 UI에는 원본 content item/assets 객체, `storagePath`, local upload path, API Key, secret, token, provider headers, request template이 포함되지 않는다.
- Blogger OAuth/API/draft/publish, scheduled publish는 발생하지 않는다.

## Patch 9A 수동 검증

- `/settings/blogger` 페이지가 표시된다.
- `GET /api/settings/blogger`는 Blogger connection placeholder 목록을 반환한다.
- `POST /api/settings/blogger`는 placeholder connection을 생성하지만 OAuth/API 호출을 하지 않는다.
- `PATCH /api/settings/blogger/[id]`는 안전한 설정 필드만 수정한다.
- `GET /api/settings/blogger/[id]/status`는 DB에 저장된 상태만 반환한다.
- API 응답에는 access token, refresh token, client secret 원문, encryptedValue, Bearer token, API Key가 포함되지 않는다.
- `accessToken`, `refreshToken`, `clientSecret`, `encryptedValue` 같은 민감 필드를 요청에 넣으면 저장이 거부된다.
- `/settings/blogger`의 OAuth 시작과 Blogger 연결 테스트 버튼은 disabled placeholder다.
- publish readiness는 Blogger connection status를 반영하지만 `publishReady`와 top-level `ready`는 false를 유지한다.
- Blogger OAuth start/callback, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9B 수동 검증

- `POST /api/settings/blogger/[id]/oauth/start`는 authorization URL dry-run을 반환한다.
- OAuth start 응답에는 authorizationUrl, expiresAt, redirectUri, scopes, `oauthDryRun: true`가 포함된다.
- OAuth start 응답에는 stateHash, access token, refresh token, client secret, authorization code 원문이 포함되지 않는다.
- `blogger_oauth_states`에는 state 원문이 아니라 `stateHash`만 저장된다.
- authorizationUrl에는 client_id, redirect_uri, scope, state가 포함된다.
- `GET /api/settings/blogger/oauth/callback`은 state 검증까지만 수행하고 token exchange를 하지 않는다.
- callback dry-run 성공 시 state는 consumed 처리된다.
- 같은 state를 재사용하면 400으로 거부된다.
- 만료된 state는 400으로 거부된다.
- `/settings/blogger`에는 OAuth URL 생성 dry-run UI와 token exchange 미구현 안내가 표시된다.
- Blogger API 호출, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9C-1 수동 검증

- Prisma schema에 `BloggerSecretKind`와 `BloggerConnectionSecret`이 추가되어 있다.
- `blogger_connection_secrets`에는 `encryptedValue`와 safe metadata만 있으며 access token, refresh token, client secret 원문 컬럼은 없다.
- `GET /api/settings/blogger/[id]/secret-status`는 secret metadata만 반환한다.
- secret status 응답에는 `encryptedValue`, access token 원문, refresh token 원문, client secret 원문, authorization code 원문이 포함되지 않는다.
- `POST /api/settings/blogger/[id]/secret-self-test`는 서버 내부 dummy string만 사용한다.
- secret self-test 응답에는 plaintext, ciphertext, `encryptedValue`가 포함되지 않는다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 self-test는 safe failure를 반환하고 token exchange는 계속 비활성 상태다.
- `/settings/blogger`에는 Token Storage Security 섹션이 표시되며 token/client secret 원문 입력창은 없다.
- OAuth callback token exchange는 여전히 미구현이다.
- `https://oauth2.googleapis.com/token` 호출 코드는 아직 없다.
- Blogger API 호출, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.
