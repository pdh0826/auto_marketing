# 10_SESSION_START_PROMPT

다음 세션 시작 시 아래 프롬프트를 Codex에 붙여넣는다.

```text
Blog Growth Agent 다음 개발 세션을 시작해줘.

먼저 AGENTS.md와 documents/ 폴더의 관련 문서를 읽고, git status --short, git branch --show-current, git log --oneline -10을 확인해줘.

repo: ~/blog-growth-agent
branch: master

현재 구현 완료 범위:
- PostgreSQL + Prisma 기반 CRUD API
- /settings/llm Provider/Model/Task Route/Call Log 관리
- /blogs, /brands CRUD UI
- /content/new 글 생성 요청 저장과 첨부 미디어 관리
- /content/[id] 상세 화면
- content_plan/content_draft dry-run과 LLM 후보 생성
- draftMarkdown 후보 편집/재검증/반영
- saved draftMarkdown 기반 HTML preview/apply
- saved draftHtml 기반 quality preview
- publish readiness preview
- Blogger OAuth state/callback token exchange
- encrypted Blogger token metadata
- Blogger blog list read-only 조회
- verified Blogger blog selection 저장
- Blogger draft payload preview
- Blogger draft manual approval guard
- Blogger draft save via posts.insert?isDraft=true
- Blogger draft live verification runbook and retry/update policy documentation
- manual HTML quality repair preview

현재 Blogger 상태:
- Blogger draft save는 active approval snapshot과 current preview snapshot/hash가 일치할 때만 허용됨
- draft save 결과는 safe metadata로 blogger_draft_saves에 저장됨
- live write 전에는 “실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?” 승인 문구를 사용함
- same approval success record가 있으면 중복 posts.insert를 차단함
- retryable=true failure만 같은 approval snapshot에서 재시도 후보로 봄
- raw Blogger response/error body, token, encryptedValue, full draftHtml은 API/UI에 반환하지 않음
- posts.update, publish, scheduled publish, token refresh는 아직 구현하지 않음
- content item status, qualityScore, publishedAt, scheduledAt은 자동 변경하지 않음
- publish readiness는 selected blog/manual approval/draft saved check를 표시할 수 있지만 publishReady=false를 유지함
- Patch 9E-4A에서 짧거나 placeholder에 가까운 draftHtml을 보강하는 rule-based quality repair preview가 추가됨
- repair candidate는 자동 저장되지 않고 기존 apply-html 수동 flow를 통해서만 draftHtml에 반영 가능함

다음 세션 1순위 작업:
Patch 9E-4B 후보: repair candidate apply UX polish

대체 후보:
- Patch 9E-4C: Local LLM sectioned multi-pass long-form generation
- Patch 9E-5: Blogger OAuth/test blog readiness 재점검

금지 사항:
- publish/scheduled publish 구현 금지
- token refresh 구현 금지
- posts.update는 policy 설계 없이 구현 금지
- draftHtml 자동 저장 금지
- LLM 호출은 별도 Patch로 선택하기 전까지 금지
- 품질검사와 발행을 한 번에 구현 금지
- API Key나 secret 출력 금지
- raw LLM response나 prompt 전문 로그 저장 금지
- git add . 또는 git add -A 금지
- .env.local 읽기/출력/수정 금지

첫 작업으로 Patch 9E-4B 작업계획을 제안해줘. 아직 구현하지 말고 계획만 작성해줘.
```

## 첫 점검 명령어

```bash
git status --short
git branch --show-current
git log --oneline -10
find documents -maxdepth 3 -type f | sort
```
