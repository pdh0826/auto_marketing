# 08_PHASE_PLAN

## Patch 순서

1. 프로젝트 스캐폴딩: 완료
2. DB 모델과 기본 CRUD: 완료
3. LLM Provider 설정 화면: 완료
4. 블로그/브랜드 프로필 관리: 완료
5. 글 생성 입력 화면: 완료
6. 첨부 미디어 관리: 완료
7. 글 기획서 dry-run과 실제 후보 생성: 완료
8. planJson 후보 편집/재검증/반영: 완료
9. 본문 초안 dry-run과 실제 후보 생성: 완료
10. draftMarkdown 후보 편집/재검증/반영: 완료
11. draft safety prompt와 자동 repair: 완료
12. HTML 변환 dry-run/preview: 완료
13. HTML 후보 편집, 재검증, draftHtml 수동 반영: 완료
14. Patch 8E - saved draftHtml 기반 품질검사 dry-run/preview: 완료
15. Patch 8F - publish readiness gate: 완료
16. Patch 9A - Blogger 연결 설정 설계 + placeholder scaffold: 완료
17. Patch 9B - Blogger OAuth state + authorization URL dry-run: 완료
18. Patch 9C-1 - Blogger token storage security foundation: 완료
19. Patch 9C-2 - OAuth callback token exchange: 완료
20. Patch 9D - Blogger blog list read-only 또는 connection test: 다음 패치 후보
21. Patch 9E 이후 - Blogger API draft/publish
22. 예약 발행
23. 운영 대시보드
24. 키워드 연구소
25. 상위글 구조 분석
26. 서비스 홍보 엔진 고도화
27. 이미지/썸네일
28. 성과 분석과 리라이트

## Patch 8C 완료 기준

완료:

- 저장된 `draftMarkdown` 기반 HTML 변환 준비 상태 확인
- media placeholder 변환 preview
- HTML sanitization/security policy 검토
- 실제 Blogger 연동 없음
- `draftHtml` 자동 저장 없음

Patch 8D 완료:

- previewHtml 후보 편집/재검증
- `validate-html` read-only 검증 API
- `apply-html` 서버 재검증 후 `draftHtml` 수동 저장 API
- HTML sanitization/security/media reference validation

Patch 9A 완료:

- `blogger_connections` placeholder 모델과 migration 추가
- `/settings/blogger` placeholder UI 추가
- Blogger settings safe CRUD/status API 추가
- publish readiness에 Blogger connection status context 반영
- 실제 Blogger OAuth/API/publish는 아직 미구현

다음 패치 후보:

- Patch 9D: Blogger blog list read-only 또는 connection test
- 실제 Blogger draft save/publish는 Patch 9E 이후

먼저 하지 말 것:

- Blogger OAuth/API/publish 구현
- HTML 변환과 발행을 한 번에 구현
- `draftHtml` 자동 저장
- API Key나 secret 출력
- raw LLM response나 prompt 전문 로그 저장
- `content_plan` route를 `content_draft` 대용으로 사용
