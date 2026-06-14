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
26. Patch 9E-4 이후 - draft update/retry semantics 또는 publish handoff readiness
27. 예약 발행
28. 운영 대시보드
29. 키워드 연구소
30. 상위글 구조 분석
31. 서비스 홍보 엔진 고도화
32. 이미지/썸네일
33. 성과 분석과 리라이트

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

다음 패치 후보:

- Patch 9E-4: Blogger draft update/retry semantics 또는 draft save 이후 publish handoff readiness
- Blogger publish/scheduled publish는 별도 패치

먼저 하지 말 것:

- Blogger publish/scheduled publish 구현
- HTML 변환과 발행을 한 번에 구현
- `draftHtml` 자동 저장
- API Key나 secret 출력
- raw LLM response나 prompt 전문 로그 저장
- `content_plan` route를 `content_draft` 대용으로 사용
