# 07_CODEX_WORKFLOW

## 작업 전 확인

```bash
git status --short
git branch --show-current
git log --oneline -21
```

## 필수 규칙

- AGENTS.md를 먼저 읽는다.
- 관련 documents 문서를 읽는다.
- 한 번에 하나의 패치만 수행한다.
- `.env`, token, credentials 파일을 읽거나 출력하지 않는다.
- `git add -A`를 사용하지 않는다.
- 실제 운영 블로그에 발행하지 않는다.

## 작업 요청 형식

```text
목표:
수정 범위:
수정 금지:
검증 방법:
완료 조건:
출력해야 할 결과:
```

## 검증

```bash
npm run lint
npm run typecheck
npm run build
```

권장 실행 순서:

```bash
npm run lint
npm run build
npm run typecheck
```

## Blog Growth Agent 협업 방식

이 프로젝트는 ChatGPT에서 패치 목표와 제약을 설계하고, Codex가 로컬 repository에서 실제 구현과 검증을 수행하는 방식으로 진행한다.

- ChatGPT 설계 단계에서는 구현 범위, 수정 금지 항목, 검증 기준을 먼저 확정한다.
- Codex 구현 단계에서는 `AGENTS.md`와 관련 documents를 먼저 읽고, git 상태를 확인한다.
- 실제 완료된 것만 문서에 완료로 기록한다.
- DB migration, API Key, Blogger publish 같은 고위험 작업은 명시 승인 없이 진행하지 않는다.
- `git add .` 또는 `git add -A`를 사용하지 않는다.
- patch 단위로 구현, 검증, 커밋한다.

## 세션 종료 문서화 절차

세션 종료 시 다음을 수행한다.

1. `AGENTS.md`와 documents를 읽는다.
2. `git status --short`, `git branch --show-current`, `git log --oneline -21`을 확인한다.
3. 실제 커밋된 패치와 검증된 DB/log 상태만 문서에 반영한다.
4. `documents/10_SESSION_START_PROMPT.md`와 `documents/11_SESSION_END_PROMPT.md`를 다음 세션 기준으로 갱신한다.
5. 필요하면 `documents/13_CHANGELOG.md`, `documents/14_NEXT_SESSION_BRIEF.md`, UTF-8 검증 파일, changed docs summary를 추가한다.
6. documents 폴더 전체를 zip으로 묶고 구조와 UTF-8을 검증한다.
