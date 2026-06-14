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

## Patch 9B OAuth dry-run 정책

Patch 9B는 OAuth state 저장과 authorization URL 생성 dry-run만 구현한다.

- `/api/settings/blogger/[id]/oauth/start`는 Google authorization URL을 생성하지만 Google API를 호출하지 않는다.
- OAuth state 원문은 DB에 저장하지 않고 `stateHash`만 저장한다.
- OAuth state는 10분 만료로 관리하며 callback dry-run에서 1회만 사용할 수 있다.
- `/api/settings/blogger/oauth/callback`은 state/code/error query를 받아 state 검증까지만 수행한다.
- callback dry-run은 authorization code 원문을 DB/API/UI/log에 저장하지 않는다.
- token exchange, access token 저장, refresh token 저장, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9C-1 token storage security foundation

Patch 9C-1은 실제 token exchange 전에 encrypted token storage 기반만 구현한다.

- `blogger_connection_secrets`는 encrypted secret value와 safe metadata만 저장한다.
- access token, refresh token, client secret 원문 컬럼은 만들지 않는다.
- API와 UI는 `encryptedValue`를 반환하지 않는다.
- `/api/settings/blogger/[id]/secret-status`는 저장된 secret metadata만 반환한다.
- `/api/settings/blogger/[id]/secret-self-test`는 서버 내부 dummy string으로 암복호화 helper만 검증하며 plaintext/ciphertext/encryptedValue를 반환하지 않는다.
- 암호화 key는 `BLOGGER_SECRET_ENCRYPTION_KEY`를 사용한다.
- key가 없으면 self-test는 safe failure를 반환하며 token exchange는 계속 비활성 상태다.
- token exchange, token refresh, Blogger API 호출, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9C-2 OAuth callback token exchange

Patch 9C-2는 OAuth callback에서 authorization code를 Google token endpoint로 교환한다.

- `/api/settings/blogger/oauth/callback`은 state를 검증한 뒤 token exchange 직전에 state를 consumed 처리한다.
- token exchange 실패 후 같은 state는 재사용하지 않는다.
- Google token endpoint는 `https://oauth2.googleapis.com/token`만 호출한다.
- `oauthClientIdRef`는 Google token endpoint의 `client_id`로 사용한다.
- `clientSecretRef`는 서버 내부 `process.env[clientSecretRef]` key name으로만 해석한다.
- `.env.local` 내용은 읽거나 출력하지 않는다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 token exchange를 중단하고 safe error를 반환한다.
- access token과 refresh token은 `blogger_connection_secrets.encryptedValue`에만 저장한다.
- refresh token이 새로 내려오지 않으면 기존 refresh token을 유지한다.
- 새 refresh token도 기존 refresh token도 없으면 connection status는 `oauth_required`로 둔다.
- API/UI/log에는 authorization code, access token, refresh token, client secret, encryptedValue, raw token response를 반환하거나 저장하지 않는다.
- token refresh, Blogger API 호출, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9D-1 Blogger blog list read-only

Patch 9D-1은 저장된 encrypted access token을 서버 내부에서만 복호화해 Blogger blog list를 read-only로 조회한다.

- `POST /api/settings/blogger/[id]/blogs`는 `https://www.googleapis.com/blogger/v3/users/self/blogs`만 호출한다.
- `BloggerConnectionSecret.secretKind = access_token`만 사용하며 refresh token은 사용하지 않는다.
- access token 원문은 Authorization header에만 사용하고 API/UI/log/docs에 반환하지 않는다.
- 응답은 Blogger blog ID, name, URL, published, updated만 포함하는 safe DTO로 축소한다.
- access token이 없거나 만료된 경우 Blogger API를 호출하지 않고 safe error를 반환한다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없거나 복호화에 실패하면 safe server error를 반환한다.
- Blogger API 401/403은 raw error body 없이 safe message와 status suggestion만 반환한다.
- DB 저장, Blogger blog 선택 반영, token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9D-2 Blogger blog selection

Patch 9D-2는 read-only로 조회한 Blogger blog 중 하나를 connection에 수동 반영한다.

- `POST /api/settings/blogger/[id]/blogs/select`는 body의 `blogId`만 받는다.
- 저장 전 현재 connected token으로 Blogger blog list를 다시 조회해 접근 가능한 blog인지 재검증한다.
- 조회 결과에 있는 blog만 `bloggerBlogId`, `bloggerBlogName`, `bloggerBlogUrl`, `bloggerBlogVerifiedAt`으로 저장한다.
- raw Blogger response, token, client secret, encrypted value는 반환하거나 저장하지 않는다.
- token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9E-0 Blogger draft payload preview

Patch 9E-0은 Blogger posts API를 호출하기 전에 draft payload 후보와 readiness만 preview한다.

- `POST /api/content-items/[id]/blogger-draft-preview`는 Blogger API를 호출하지 않는다.
- target blog는 저장된 verified Blogger blog selection metadata만 사용한다.
- saved `draftHtml`만 HTML source로 사용하고 `draftMarkdown` 변환은 수행하지 않는다.
- 응답에는 target blog safe metadata, title candidate, HTML length/snippet, labels candidate, readiness flags, blocking issues, warnings를 포함한다.
- DB mutation, token refresh, draft save, publish, scheduled publish는 구현하지 않는다.
