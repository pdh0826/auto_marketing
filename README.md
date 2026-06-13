# Blog Growth Agent

Google Blogger 기반 블로그 글 생성·검수·초안 저장·예약 발행 플랫폼입니다.

이 프로젝트의 목표는 단순 AI 대량 글 생성기가 아니라, 블로그별 주제/문체와 급등포착 같은 자체 서비스 홍보 목적에 맞는 콘텐츠를 기획하고, 품질검사를 거친 뒤 안전하게 발행하는 운영 도구를 만드는 것입니다.

## 초기 실행

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000
```

## 검증

```bash
npm run lint
npm run typecheck
npm run build
```

## 보안

이 저장소에는 실제 비밀정보를 넣지 않습니다.

금지 파일:

- `.env`
- `.env.local`
- `token.json`
- `credentials.json`
- `client_secret*.json`
- `*.pem`
- `*.key`

환경변수 예시는 `.env.example`만 사용합니다.

## 개발 순서

1. 문서/규칙 확정
2. DB 모델
3. LLM Provider 설정
4. Blogger OAuth
5. 블로그/서비스 프로필
6. 글 생성 입력
7. 기획서 생성
8. 본문/HTML 생성
9. 품질검사
10. Blogger 초안 저장
11. 예약 발행

## Codex 작업

Codex 작업 전 반드시 `AGENTS.md`와 `documents/07_CODEX_WORKFLOW.md`를 읽어야 합니다.
