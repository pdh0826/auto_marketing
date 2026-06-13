# 07_CODEX_WORKFLOW

## 작업 전 확인

```bash
git status --short
git branch --show-current
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
