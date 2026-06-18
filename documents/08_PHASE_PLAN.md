# 08_PHASE_PLAN

## Patch 순서

1. 프로젝트 스캐폴딩: 완료
2. DB 모델과 기본 CRUD: 완료
3. LLM Provider 설정 화면: 완료
4. 블로그/브랜드 프로필 관리: 완료
5. 글 생성 입력 화면: 완료
6. 첨부 미디어 관리: 완료
7. 글 기획서 dry-run과 실제 후보 생성: 완료
8. planJson 후보 편집/재검증/반영: 완료
9. 본문 초안 dry-run과 실제 후보 생성: 완료
10. draftMarkdown 후보 편집/재검증/반영: 완료
11. draft safety prompt와 자동 repair: 완료
12. HTML 변환 dry-run/preview: 완료
13. HTML 후보 편집, 재검증, draftHtml 수동 반영: 완료
14. Patch 8E - saved draftHtml 기반 품질검사 dry-run/preview: 완료
15. Patch 8F - publish readiness gate: 완료
16. Patch 9A - Blogger 연결 설정 설계 + placeholder scaffold: 완료
17. Patch 9B - Blogger OAuth state + authorization URL dry-run: 완료
18. Patch 9C-1 - Blogger token storage security foundation: 완료
19. Patch 9C-2 - OAuth callback token exchange: 완료
20. Patch 9D-1 - Blogger blog list read-only 조회: 완료
21. Patch 9D-2 - 조회된 Blogger blog를 connection에 수동 반영: 완료
22. Patch 9E-0 - Blogger draft save readiness / draft payload preview: 완료
23. Patch 9E-1 - Blogger draft save final guard / manual approval gate: 완료
24. Patch 9E-2 - approved snapshot guard 기반 Blogger API actual draft save: 완료
25. Patch 9E-3 - Blogger draft save live verification runbook + retry/update policy documentation: 완료
26. Patch 9E-4A - manual HTML quality repair preview: 완료
27. Patch 9E-4B - repair candidate apply UX polish: 완료
28. Patch 9E-4C 이후 - Local LLM long-form generation
29. Patch 9E-5 이후 - Blogger OAuth/test blog readiness 재점검
30. 예약 발행
31. 운영 대시보드
32. 키워드 연구소
33. 상위글 구조 분석
34. 서비스 홍보 엔진 고도화
35. 이미지/썸네일
36. 성과 분석과 리라이트

## Patch 8C 완료 기준

완료:

- 저장된 `draftMarkdown` 기반 HTML 변환 준비 상태 확인
- media placeholder 변환 preview
- HTML sanitization/security policy 검토
- 실제 Blogger 연동 없음
- `draftHtml` 자동 저장 없음

Patch 8D 완료:

- previewHtml 후보 편집/재검증
- `validate-html` read-only 검증 API
- `apply-html` 서버 재검증 후 `draftHtml` 수동 저장 API
- HTML sanitization/security/media reference validation

Patch 9A 완료:

- `blogger_connections` placeholder 모델과 migration 추가
- `/settings/blogger` placeholder UI 추가
- Blogger settings safe CRUD/status API 추가
- publish readiness에 Blogger connection status context 반영
- 실제 Blogger draft save/publish는 아직 미구현

Patch 9D-1 완료:

- encrypted access token을 서버 내부에서만 복호화해 Blogger blog list를 read-only로 조회
- `POST /api/settings/blogger/[id]/blogs` 추가
- `/settings/blogger`에 Blogger 목록 조회 버튼과 safe result table 추가
- Blogger API raw response, token, client secret, encryptedValue는 반환하지 않음
- DB mutation, token refresh, draft save, publish는 구현하지 않음

Patch 9D-2 완료:

- `BloggerConnection`에 `bloggerBlogUrl`, `bloggerBlogVerifiedAt` safe metadata 추가
- `POST /api/settings/blogger/[id]/blogs/select` 추가
- 선택 저장 전 read-only blog list 재조회로 접근 가능한 blog인지 서버 재검증
- `/settings/blogger` blog list 결과에서 “이 블로그 선택” 액션 추가
- publish readiness에 Blogger blog selection check 추가, `publishReady=false` 유지
- token refresh, draft save, publish는 구현하지 않음

Patch 9E-0 완료:

- `POST /api/content-items/[id]/blogger-draft-preview` preview-only API 추가
- saved `draftHtml`만 Blogger draft payload 후보로 사용
- verified Blogger blog selection metadata만 target blog로 사용
- Blogger connection이 여러 개면 임의 선택하지 않고 `blogger_connection_ambiguous` blocking issue 반환
- HTML validation, quality preview, publish readiness를 조합해 `draftPayloadReady` preview flag 제공
- Blogger API read/write, DB mutation, token refresh, draft save, publish는 구현하지 않음
- publish readiness의 `publishReady=false`, top-level `ready=false` 유지

Patch 9E-1 완료:

- `blogger_draft_approvals` 테이블과 `BloggerDraftApprovalStatus` enum 추가
- server-side draft payload preview 재계산 결과로만 approval 생성
- approval snapshot은 canonical JSON + SHA-256으로 계산
- full `draftHtml`은 저장하지 않고 `draftHtmlHash`, `snapshotHash`, target blog safe metadata, title, readiness summary만 저장
- `POST /api/content-items/[id]/blogger-draft-approval`와 `DELETE /api/content-items/[id]/blogger-draft-approval` 추가
- preview API 응답에 approval status/match/hash prefix summary 추가
- publish readiness manual approval check가 current preview snapshot과 active approval이 일치하면 pass 가능
- `publishReady=false`, top-level `ready=false` 유지
- Blogger API read/write, token refresh, draft save, publish는 구현하지 않음

Patch 9E-2 완료:

- `blogger_draft_saves` 테이블과 `BloggerDraftSaveStatus` enum 추가
- `POST /api/content-items/[id]/blogger-draft-save` 추가
- actual Blogger write는 `posts.insert?isDraft=true`만 사용
- current preview snapshot과 active approval snapshot/hash가 일치해야 draft save 허용
- same approval snapshot에 successful draft save가 이미 있으면 중복 insert 차단
- success/failure는 safe metadata만 저장하고 raw Blogger response/error body는 저장하지 않음
- token refresh, `posts.update`, publish, scheduled publish는 구현하지 않음
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않음
- publish readiness에 draft saved check/metadata 추가, `publishReady=false`, top-level `ready=false` 유지

Patch 9E-3 완료:

- 실제 Blogger live draft save 검증 runbook 문서화
- live write 전 고정 사용자 승인 문구 명시
- connected token, verified blog, saved `draftHtml`, `draftPayloadReady=true`, active approval match, no prior success 조건 명시
- retryable failure만 재시도 후보로 보고 guard failure는 retry 대상에서 제외
- same approval success record가 있으면 중복 `posts.insert` 차단 유지
- 새 approval은 새 draft insert가 가능하지만 Blogger draft 누적 위험을 문서화
- `posts.update`는 Patch 9E-4에서 update/retry semantics 설계 후 검토하는 정책으로 분리
- content detail UI draft save 확인/성공/실패 문구 보강
- live Blogger draft save 검증은 실행하지 않음
- publish readiness의 `publishReady=false`, top-level `ready=false` 유지

Patch 9E-4A 완료:

- saved `draftMarkdown` 기반 rule-based HTML quality repair preview helper 추가
- `POST /api/content-items/[id]/quality-repair-preview` 추가
- current `draftHtml`이 짧거나 placeholder에 가까우면 draftMarkdown rebuild candidate를 우선 생성
- fallback으로 current `draftHtml`에 section/CTA/disclaimer를 append하는 candidate 지원
- content detail UI에 Quality Repair Preview 섹션 추가
- candidate textarea, 재검증, 기존 HTML 후보 편집기로 복사 flow 추가
- 자동 `draftHtml` 저장, `qualityScore` 저장, status 변경 없음
- LLM 호출, `llm_call_logs` 생성, Blogger API 호출 없음

Patch 9E-4B 완료:

- repair candidate handoff 버튼을 `HTML 후보로 사용` 흐름으로 명확화
- HTML candidate source를 UI-only 상태로 `html-preview`, `quality-repair`, `manual-edit` 표시
- repair candidate를 HTML 후보로 복사한 뒤 기존 validation을 clear/stale 처리하고 재검증을 요구
- HTML Dry Run 결과가 없어도 repair candidate 기반 HTML candidate editor 표시
- `apply-html` 성공 후 Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview 재실행과 Blogger draft approval 재승인 안내
- 자동 `draftHtml` 저장, 자동 apply, LLM 호출, Blogger API 호출 없음

다음 패치 후보:

- Patch 9E-5C: explicit token refresh design approval
- Patch 9E-5D: posts.update preflight/approval design
- Patch 9E-6B: publish preflight/approval design, still without Blogger publish execution

먼저 하지 말 것:

- Blogger publish/scheduled publish 구현
- HTML 변환과 발행을 한 번에 구현
- `draftHtml` 자동 저장
- API Key나 secret 출력
- raw LLM response나 prompt 전문 로그 저장
- `content_plan` route를 `content_draft` 대용으로 사용

Patch 9E-6A 완료:

- Blogger draft save 성공 이후 publish/scheduled publish policy를 UI와 문서에 planning-only로 표시
- publish와 scheduled publish의 차이, 필요한 approval/preflight/side-effect summary/audit/rollback 정책 문서화
- `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml` 변경은 별도 정책 전 금지로 유지
- token expired 상태에서는 publish/scheduled publish보다 OAuth 재연결이 우선이라는 정책 유지
- `posts.update`/retry 정책과 publish 정책을 분리
- Blogger publish/scheduled publish route, Blogger write, token refresh, DB schema/migration은 구현하지 않음

Patch 9E-6B 완료:

- `POST /api/content-items/[id]/publish-preflight` read-only dry-run API 추가
- Content Detail에 Publish Preflight Dry-run UI 추가
- `canPublish=false`, `canSchedulePublish=false`, `publishReady=false`, top-level `ready=false` 유지
- publish/scheduled publish not implemented, publish approval not implemented, content item mutation policy not implemented blocker 표시
- access token expired 상태는 publish/scheduled publish 전 OAuth 재연결 필요 blocker로 표시
- 향후 publish approval snapshot field 후보 문서화
- Blogger publish/scheduled publish/write, token refresh, DB schema/migration, content item mutation은 구현하지 않음

Patch 9E-6C 완료:

- `POST /api/content-items/[id]/publish-approval-preview` read-only snapshot preview API 추가
- Content Detail에 Publish Approval Snapshot Preview UI 추가
- non-secret approval snapshot preview와 `approvalSnapshotHashPreview` 표시
- `canCreatePublishApproval=false`, `canPublish=false`, `canSchedulePublish=false` 유지
- `publish_approval_persistence_not_implemented`, publish/scheduled not implemented, token expired blocker 표시
- side-effect all false 유지, `dbWrite=false`, `approvalPersistence=false` 표시
- publish approval persistence, Blogger write, publish/scheduled publish, DB schema/migration, content item mutation은 구현하지 않음

Patch 9E-6D 완료:

- Publish Approval Snapshot Preview UI에 approval persistence policy 안내 추가
- approval persistence가 아직 table/schema/migration/route/DB write가 아님을 명확히 표시
- 향후 publish approval은 immutable snapshot, deterministic hash, rollback acknowledgement, side-effect acknowledgement, token state checkedAt, invalidation policy, publish attempt audit가 필요하다고 문서화
- draft/content/blog/post/schedule/timezone/token/status 변경 시 approval이 stale 또는 invalidated가 되어야 한다는 정책 문서화
- stored publish approval과 실제 publish execution은 별도 단계이며 publish/scheduled publish는 후속 승인 전 구현하지 않음
- Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, DB schema/migration, content item mutation, LLM 호출은 구현하지 않음

Patch 9E-7A 완료:

- `BloggerPublishApprovalMode`, `BloggerPublishApprovalStatus`, `BloggerPublishApproval` Prisma model 추가
- `blogger_publish_approvals` migration 추가 및 local dev DB 적용
- publish approval snapshot 저장 helper 추가
- `POST /api/content-items/[id]/publish-approval-save` 추가
- save route는 서버에서 publish approval snapshot을 재생성하고 client preview hash와 일치할 때만 저장
- rollback acknowledgement, side-effect acknowledgement, approval persistence acknowledgement 3개를 모두 요구
- 같은 content/mode/snapshot/schedule active approval은 idempotent하게 existing row 반환 가능
- Content Detail UI에 local DB approval storage 옵션, acknowledgement checkbox, save 버튼, safe result summary 추가
- 저장 후에도 `canPublish=false`, `canSchedulePublish=false` 유지
- Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, content item mutation, LLM 호출은 구현하지 않음

Patch 9E-7B 완료:

- `POST /api/content-items/[id]/publish-approval-readback` read-only API 추가
- saved publish approval latest/active summary readback 추가
- Content Detail UI에 Saved Publish Approval Readback 블록 추가
- publish approval save response에 `existing`을 표시하고 existing 재사용 시 `dbWrite=false`, `approvalPersistence=false`로 구분
- 1건 local DB insert smoke와 같은 snapshot idempotent save 검증
- 저장된 approval이 있어도 `canPublish=false`, `canSchedulePublish=false` 유지
- Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, content item mutation, LLM 호출은 구현하지 않음

Patch 9E-7C 완료:

- `POST /api/content-items/[id]/publish-approval-execution-guard` read-only API 추가
- latest saved publish approval과 현재 content/Blogger draft metadata match summary 추가
- invalidation candidates를 read-only 판단 결과로 표시
- Content Detail UI에 execution guard 결과, blockers, required-before-execution, side-effect summary 추가
- `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, `canSchedulePublish=false` 유지
- approval invalidation DB update, Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, content item mutation, LLM 호출은 구현하지 않음

Patch 9E-7D 완료:

- `POST /api/content-items/[id]/publish-approval-invalidation-preview` read-only API 추가
- execution guard 결과를 기반으로 invalidation dry-run plan 생성
- normal preview는 current approval match 상태에서 `wouldInvalidate=false`, `canInvalidate=false` 유지
- manual reason dry-run은 `wouldInvalidate=true`를 표시할 수 있지만 `canInvalidate=false` 및 `dbWrite=false` 유지
- Content Detail UI에 invalidation preview, manual dry-run reason, invalidation reasons/candidates, dry-run plan, side-effect summary 추가
- approval invalidation DB update, Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, content item mutation, LLM 호출은 구현하지 않음

Patch 9E-7E 완료:

- `POST /api/content-items/[id]/publish-execution-attempt-preview` read-only API 추가
- future `blogger_publish_execution_attempts` schema/policy plan 문서화
- attempt가 `publishApprovalId`와 approval snapshot hash에 연결되어야 한다는 정책 정리
- retry eligible / retry blocked / partial failure 정책 요약 추가
- raw Blogger response/error body, token, encrypted value, full HTML, prompt/raw LLM response 저장 금지 redaction 정책 정리
- Content Detail UI에 Publish Execution Attempt Preview planning-only 결과와 side-effect summary 추가
- `attemptStorageImplemented=false`, `wouldCreateAttempt=false`, `canCreateAttempt=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false` 유지
- schema/migration, attempt insert, Blogger publish/scheduled publish/write, token refresh, posts.update, additional draft save, content item mutation, LLM 호출은 구현하지 않음
