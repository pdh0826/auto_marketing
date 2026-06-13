# 02_ARCHITECTURE

## 권장 구조

```text
Frontend: Next.js 관리자 웹
Backend: Next.js API Route 또는 FastAPI
Database: PostgreSQL 또는 초기 SQLite
Scheduler: Node cron 또는 별도 worker
LLM Layer: OpenAI Adapter + Local LLM Adapter + LLM Router
Blogger Integration: Google OAuth + Blogger API
```

## 핵심 흐름

```text
입력 소재
→ 글 기획서
→ 본문 초안
→ HTML 변환
→ 품질검사
→ 미리보기
→ Blogger 초안 저장
→ 예약 발행
```
