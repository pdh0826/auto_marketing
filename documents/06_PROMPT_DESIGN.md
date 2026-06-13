# 06_PROMPT_DESIGN

## MVP 프롬프트

1. 글 기획서 생성
2. 본문 초안 생성
3. HTML 변환
4. 품질검사
5. AI 말투 제거/문체 변환
6. CTA 생성

## 출력 원칙

- 가능한 작업은 JSON schema를 정의한다.
- 품질검사는 점수, 경고, 차단 사유를 분리한다.
- 글 생성은 경쟁글 문장 복사를 금지한다.

## Patch 7B content_plan preview

Patch 7B의 content planning prompt preview는 실제 LLM 호출 없이 `/content/[id]` 화면에만 표시한다.

- system: helpful, original, people-first content planner 역할과 안전 원칙을 포함한다.
- user: content item, blog profile, brand profile, attached media metadata를 포함한다.
- outputFormat: `planJson` 기본 템플릿 구조를 포함한다.
- prompt preview는 DB에 저장하지 않는다.
- API Key, secret, provider headers, request template, media storagePath는 prompt에 포함하지 않는다.
