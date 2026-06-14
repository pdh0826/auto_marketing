# 11_SESSION_END_PROMPT

세션 종료 시 아래 절차로 문서화한다.

## 종료 문서화 프롬프트

```text
Blog Growth Agent 세션 종료 문서화 작업을 수행해줘.

먼저 AGENTS.md와 documents 폴더의 기존 문서들을 읽고, git status --short, git branch --show-current, git log --oneline -21을 확인해줘.

이번 세션에서 실제로 구현/검증/커밋한 내용만 기준으로 documents 문서를 최신화해줘.
추정이나 과장은 금지하고, 미구현 기능은 명확히 미구현 또는 다음 세션으로 표시해줘.

갱신 대상:
- documents/00_PROJECT_OVERVIEW.md
- documents/01_REQUIREMENTS.md
- documents/02_ARCHITECTURE.md
- documents/03_DATA_MODEL.md
- documents/05_CONTENT_POLICY.md
- documents/06_PROMPT_DESIGN.md
- documents/07_CODEX_WORKFLOW.md
- documents/08_PHASE_PLAN.md
- documents/09_TEST_PLAN.md
- documents/10_SESSION_START_PROMPT.md
- documents/11_SESSION_END_PROMPT.md
- documents/12_LLM_PROVIDER_DESIGN.md

필요하면 다음 파일을 추가해줘:
- documents/13_CHANGELOG.md
- documents/14_NEXT_SESSION_BRIEF.md
- documents/UTF8_VERIFICATION_YYYYMMDD.txt
- documents/changed_docs_summary_YYYYMMDD_blog_growth_closeout.txt

주의:
- prompt 전문, raw response 전문, API Key, Bearer token, secret, storagePath를 문서에 기록하지 않는다.
- .env.local을 읽거나 출력하거나 수정하지 않는다.
- git add . 또는 git add -A를 사용하지 않는다.
- 실제 완료된 것만 완료로 기록한다.

검증:
- git status --short
- git branch --show-current
- git log --oneline -21
- find documents -maxdepth 3 -type f | sort
- npm run lint
- npm run build
- npm run typecheck
- documents.zip 생성 후 zipinfo 또는 unzip -l 확인
- documents 내 md/txt 파일 UTF-8 decode 확인

완료 후 갱신 문서 목록, 생성한 zip 경로, UTF-8 검증 결과, git status, 다음 세션 시작 문장을 출력해줘.
```

## 커밋/검증 확인 방법

```bash
git status --short
git branch --show-current
git log --oneline -21
npm run lint
npm run build
npm run typecheck
```

DB 상태 확인 예시:

```bash
psql -d blog_growth_agent_dev -c 'select id, "planJson" is not null as has_plan, "draftMarkdown" is not null as has_draft, "draftHtml" is not null as has_html from content_items where id = '''cmqc2xqbr00011y70sxmgl65v''';'
```

Call log 안전성 확인 예시:

```bash
curl -s http://localhost:3000/api/settings/llm/call-logs | python3 -m json.tool
curl -s http://localhost:3000/api/settings/llm/call-logs | grep -E "sk-|Bearer|Authorization|raw response|candidateDraftMarkdown|draftMarkdown|repairedDraft|originalDraft|storagePath|requestTemplateJson|headersJson|secretRef|encryptedValue" || echo "OK: no obvious secret/raw draft fragments found"
```

`draftMarkdown` 문자열은 과거 안전한 errorMessage인 `Generated draftMarkdown did not pass validation.` 때문에 false positive로 잡힐 수 있다. metadata에 후보 Markdown 전문이 저장되는지와 구분해서 확인한다.

## documents.zip 재생성 방법

```bash
zip -r blog_growth_agent_documents_YYYYMMDD_closeout.zip documents -x "__MACOSX/*" "*.DS_Store" "*/node_modules/*" "*/.next/*" "*/cache/*"
zipinfo blog_growth_agent_documents_YYYYMMDD_closeout.zip
```

## UTF-8 검증 방법

```bash
python3 - <<'PY'
from pathlib import Path
errors = []
for path in sorted(Path("documents").rglob("*")):
    if path.is_file() and path.suffix.lower() in {".md", ".txt"}:
        try:
            path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            errors.append(f"{path}: {exc}")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)
print("OK: all markdown/text documents decode as UTF-8")
PY
```
