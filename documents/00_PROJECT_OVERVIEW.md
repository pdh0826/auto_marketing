# 00_PROJECT_OVERVIEW

## 프로젝트명

Blog Growth Agent

## 목적

Google Blogger 기반 블로그를 여러 개 운영하면서, 블로그별 주제와 문체에 맞는 글을 기획·작성·검수·초안 저장·예약 발행하는 콘텐츠 운영 플랫폼을 만든다.

이 플랫폼은 다음 두 가지 목적을 함께 가진다.

1. 검색 유입용 정보성 콘텐츠 생성
2. 급등포착 등 자체 서비스의 자연스러운 홍보 콘텐츠 생성

## 핵심 원칙

- 대량 스팸 글 생성기가 아니다.
- 경쟁글 문장을 복사하거나 유사하게 재작성하지 않는다.
- 상위글은 구조와 검색 의도만 분석한다.
- 모든 발행 전 품질검사와 금지표현 검사를 거친다.
- OpenAI API와 로컬 LLM을 선택적으로 사용할 수 있어야 한다.

## 2026-06-14 세션 종료 기준 현재 상태

현재 구현은 Google Blogger 발행 전 단계인 콘텐츠 기획과 본문 초안 후보 생성까지 진행되었다.

- PostgreSQL + Prisma 기반 DB 모델과 CRUD API가 구현되어 있다.
- `/settings/llm`에서 Provider, Model, Task Route, Call Log를 관리한다.
- OpenAI-compatible Provider와 Ollama-compatible Provider 연결 테스트가 구현되어 있다.
- `/blogs`, `/brands`, `/content/new`, `/content/[id]` 관리 화면이 DB 기반으로 동작한다.
- `content_plan` Task Route로 planJson 후보를 실제 LLM 호출로 생성하고, 사용자가 확인 후에만 저장한다.
- `content_draft` Task Route로 draftMarkdown 후보를 실제 LLM 호출로 생성하고, 사용자가 확인 후에만 저장한다.
- draftMarkdown 후보는 편집과 rule-based 재검증을 지원한다.
- draft safety prompt와 validation 실패 시 1회 자동 repair 흐름이 구현되어 있다.
- 저장된 draftMarkdown 기반 HTML 변환 dry-run/preview가 구현되어 있다.
- HTML preview는 media placeholder mapping과 sanitization/security readiness를 표시하며 DB에 저장하지 않는다.

아직 구현하지 않은 범위는 명확히 남아 있다.

- draftHtml 후보 편집/수동 반영 저장
- 품질검사
- Google OAuth
- Blogger API 초안 저장
- 실제 발행과 예약 발행
- 자동 bulk publishing

다음 세션의 1순위 후보 작업은 Patch 8D: HTML preview 후보 편집/재검증과 `draftHtml` 수동 반영 저장 정책이다. 다음 세션에서 Blogger publish로 바로 진행하지 않는다.

## 2026-06-16 현재 상태 추가

현재는 reviewed draft path가 Blogger draft save 1회 성공까지 확장되었다.

- Stepwise draft generation, deterministic HTML preview, manual `draftHtml` apply, Blogger OAuth/blog selection, payload approval, guarded Blogger draft save가 동작한다.
- 저장된 Blogger draft는 publish-ready가 아니며, `publishReady=false`와 top-level `ready=false`는 의도적으로 유지한다.
- Publish, scheduled publish, `posts.update`, token refresh, automatic status transition, `publishedAt`/`scheduledAt` mutation은 아직 구현하지 않았다.
- Publish/scheduled publish는 별도 approval, preflight, side-effect summary, audit, rollback 안내 정책을 설계한 뒤에만 구현한다.
- Publish preflight dry-run은 read-only로 추가되었으며 `canPublish=false`, `canSchedulePublish=false`, side-effect all false를 유지한다.
- Publish approval snapshot preview는 read-only로 추가되었으며 hash preview를 보여주지만 approval persistence나 publish 실행은 구현하지 않았다.
- Publish approval persistence policy는 planning-only로 문서화되었으며, 실제 table/schema/migration/DB write는 아직 구현하지 않았다.
