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
13. HTML 변환 후보 생성과 수동 반영: 다음 패치 후보
14. 품질검사
15. Blogger OAuth 연결
16. Blogger 초안 저장
17. 예약 발행
18. 운영 대시보드
19. 키워드 연구소
20. 상위글 구조 분석
21. 서비스 홍보 엔진 고도화
22. 이미지/썸네일
23. 성과 분석과 리라이트

## Patch 8C 완료 기준

완료:

- 저장된 `draftMarkdown` 기반 HTML 변환 준비 상태 확인
- media placeholder 변환 preview
- HTML sanitization/security policy 검토
- 실제 Blogger 연동 없음
- `draftHtml` 자동 저장 없음

다음 패치 후보:

- previewHtml 후보 편집/재검증
- `draftHtml` 수동 반영 저장 정책
- HTML sanitization 강화

먼저 하지 말 것:

- Blogger OAuth/API/publish 구현
- HTML 변환과 발행을 한 번에 구현
- `draftHtml` 자동 저장
- API Key나 secret 출력
- raw LLM response나 prompt 전문 로그 저장
- `content_plan` route를 `content_draft` 대용으로 사용
