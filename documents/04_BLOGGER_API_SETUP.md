# 04_BLOGGER_API_SETUP

## 준비사항

1. 테스트용 Google 계정 준비
2. 테스트용 Blogger 블로그 생성
3. Google Cloud 프로젝트 생성
4. Blogger API 활성화
5. OAuth 동의 화면 설정
6. OAuth Client ID 생성
7. Redirect URI 등록

## 원칙

- 초기 개발은 반드시 테스트 블로그만 사용한다.
- 운영 블로그 발행은 MVP 검증 후 별도 승인 단계에서 진행한다.
- OAuth Secret과 Token은 Git에 포함하지 않는다.

## Patch 9A placeholder 정책

Patch 9A는 실제 OAuth/API 호출 없이 Blogger 연결 설정 placeholder만 추가한다.

- `/settings/blogger`에서 connection placeholder를 생성/수정한다.
- 저장 가능한 값은 name, 연결 대상 blog profile, Blogger blog ID/name, status, scope, 안전한 secret/token 메타데이터다.
- access token, refresh token, client secret 원문은 입력하거나 저장하지 않는다.
- OAuth 시작 버튼과 연결 테스트 버튼은 disabled placeholder다.
- Blogger blog list 조회, draft save, publish는 Patch 9B 이후에만 검토한다.
