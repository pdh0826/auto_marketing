# 10_SESSION_START_PROMPT

다음 세션 시작 시 아래 프롬프트를 Codex에 붙여넣는다.

```text
Blog Growth Agent 다음 개발 세션을 시작해줘.

먼저 AGENTS.md와 documents/ 폴더의 관련 문서를 읽고, git status --short, git branch --show-current, git log --oneline -21을 확인해줘.

repo: ~/blog-growth-agent
branch: master

최신 커밋:
- 1f83c77 Add HTML preview dry run for saved drafts
- 5c8f9c6 Document Blog Growth Agent session closeout
- a53094c Improve draft safety repair flow
- 1c89245 Generate draft markdown candidates with LLM
- a05c62b Add draft markdown dry run preview
- 2e7d5a0 Add editable plan candidate revalidation

현재 구현 완료 범위:
- PostgreSQL + Prisma 기반 CRUD API
- /settings/llm Provider/Model/Task Route/Call Log 관리
- OpenAI-compatible 및 Ollama-compatible Provider 연결 테스트
- /blogs, /brands CRUD UI
- /content/new 글 생성 요청 저장과 첨부 미디어 관리
- /content/[id] 상세 화면
- content_plan dry-run preview
- content_plan 실제 LLM 후보 생성
- planJson 후보 편집/재검증/반영
- LLM call logs Safe DTO
- content_draft dry-run preview
- content_draft 실제 LLM 후보 생성
- draftMarkdown 후보 편집/재검증/반영
- draft safety prompt 강화와 validation 실패 시 자동 repair 1회
- saved draftMarkdown 기반 HTML 변환 dry-run/preview
- HTML 후보 편집/재검증과 draftHtml 수동 반영

현재 DB/LLM 상태:
- 테스트 content item id: cmqc2xqbr00011y70sxmgl65v
- has_plan = true
- has_draft = true
- has_html = Patch 8D 수동 반영 여부에 따라 달라질 수 있음
- content_draft Task Route는 Local Ollama / OpenClaw General Qwen2.5 14B로 readiness pass 상태로 검증됨
- 최신 content_draft call log는 validationOk=true, repairAttempted=false, markdownLength=1665, mediaPlaceholderCount=1인 정상 생성 케이스가 확인됨
- draftMarkdown은 자동 저장되지 않고 사용자가 반영했을 때만 DB에 저장됨

다음 세션 1순위 작업:
Patch 8F 후보: publish readiness gate

Patch 8F 목표:
- saved draftHtml과 quality preview 결과를 기반으로 publish readiness gate를 설계한다.
- Blogger 연결 전제 조건, 수동 승인 상태, 안전성 조건을 점검한다.
- publish/scheduled publish는 구현하지 않는다.
- 실제 Blogger 연동은 아직 하지 않음

금지 사항:
- Blogger OAuth/API/publish 구현부터 시작 금지
- publish/scheduled publish 구현 금지
- 품질검사와 발행을 한 번에 구현 금지
- API Key나 secret 출력 금지
- raw LLM response나 prompt 전문 로그 저장 금지
- content_plan route를 content_draft 대용으로 사용 금지
- git add . 또는 git add -A 금지
- .env.local 읽기/출력/수정 금지

첫 작업으로 Patch 8F 작업계획을 제안해줘. 아직 구현하지 말고 계획만 작성해줘.
```

## 첫 점검 명령어

```bash
git status --short
git branch --show-current
git log --oneline -21
find documents -maxdepth 3 -type f | sort
```
