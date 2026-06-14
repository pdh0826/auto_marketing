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

## 초기 제외 기능

- 자동 키워드 수집
- 상위글 자동 분석
- 이미지 파일 분석
- 썸네일 자동 생성
- 성과 분석
- 자동 리라이트
- 멀티채널 자동 발행
