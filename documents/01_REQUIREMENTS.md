# 01_REQUIREMENTS

## MVP 필수 기능

1. 관리자 기본 화면
2. LLM Provider 설정
3. OpenAI API / Local LLM 선택 구조
4. 블로그 프로필 관리
5. 서비스/브랜드 프로필 관리
6. 글 생성 입력 화면
7. 글 기획서 생성
8. 본문 초안 생성
9. HTML 생성
10. 품질검사
11. Blogger 초안 저장
12. 예약 발행
13. 발행/LLM 호출 로그

## 2026-06-14 구현 상태

완료:

- 관리자 기본 화면과 주요 관리 화면
- PostgreSQL + Prisma 기반 CRUD API
- LLM Provider/Model/Task Route/Call Log 관리
- OpenAI-compatible 및 Ollama-compatible Provider 연결 테스트
- 블로그 프로필 관리
- 서비스/브랜드 프로필 관리
- 글 생성 요청 저장
- 첨부 미디어 업로드와 메타데이터 관리
- rule-based 첨부 미디어 메타데이터 추천
- content_plan dry-run preview
- content_plan 실제 LLM 후보 생성, 편집, 재검증, 수동 반영
- Call Log Safe DTO
- content_draft dry-run preview
- content_draft 실제 LLM 후보 생성, 편집, 재검증, 수동 반영
- draft safety prompt 강화와 validation 실패 시 1회 자동 repair

미구현:

- draftHtml 생성과 HTML 변환
- 품질검사
- Google OAuth
- Blogger API 초안 저장
- 실제 발행과 예약 발행
- 자동 bulk publishing

## 2026-06-16 구현 상태 추가

완료:

- 저장된 `draftHtml` 품질 preview와 publish-readiness preview
- Blogger OAuth callback token exchange와 encrypted token storage
- Blogger blog list read-only 조회와 verified blog selection
- Blogger draft payload preview, manual approval snapshot, guarded draft save
- Blogger `posts.insert?isDraft=true` 기반 draft save 1회 live 검증
- Post-save duplicate protection, token-expired reauth guidance, update/retry policy planning
- Publish preflight dry-run과 future publish approval snapshot field 설계
- Publish approval snapshot/hash preview
- Publish approval persistence storage/readback/execution guard/invalidation preview
- Publish execution attempt preview와 future attempt schema/retry/partial failure/redaction/content mutation ordering policy
- Publish execution attempt local storage/readback for planning-only records

아직 구현하지 않음:

- Publish approval invalidation DB update
- Blogger publish
- Scheduled publish
- `posts.update`
- Token refresh
- Automatic `content_items.status`, `qualityScore`, `publishedAt`, `scheduledAt` mutation

Publish approval persistence는 local DB snapshot storage/readback/execution guard/invalidation preview까지 구현된 상태지만, 이것은 publish 실행이나 approval invalidation update가 아니다. Publish execution attempt storage도 planning-only audit record 저장일 뿐 Blogger publish 실행이 아니다. Publish/scheduled publish는 별도 publish execution preflight, side-effect summary, audit, rollback 안내, token 상태 정책, local status/timestamp mutation 정책이 설계되기 전까지 구현하지 않는다.

## 초기 제외 기능

- 자동 키워드 수집
- 상위글 자동 분석
- 이미지 파일 분석
- 썸네일 자동 생성
- 성과 분석
- 자동 리라이트
- 멀티채널 자동 발행
