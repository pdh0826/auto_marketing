# AGENTS.md

## Project Summary

This project is **Blog Growth Agent**.

It is a Google Blogger content planning, writing, quality-checking, draft-saving, and scheduled-publishing platform.

The platform must support:

- Google Blogger OAuth/API integration
- Blog profile management
- Brand/service profile management
- SEO content generation
- Service promotion content generation
- OpenAI API and local LLM provider switching
- Task-based LLM routing
- Quality checks before publishing
- Draft save and scheduled publishing

This is **not** a mass spam content generator. The product must prioritize helpful, original, reviewed content.

## Core Safety Rules

Do not implement features that copy or rewrite competitor articles sentence-by-sentence.

Do not create or commit real secrets.

Never read, print, or commit:

- `.env`
- `.env.local`
- `token.json`
- `credentials.json`
- `client_secret*.json`
- `*.pem`
- `*.key`

Do not add generated build folders:

- `node_modules`
- `.next`
- `dist`
- `build`
- `.venv`
- `__pycache__`

## Git Rules

Before making changes, run:

```bash
git status --short
git branch --show-current
```

Do not use:

```bash
git add -A
```

Only stage intended files.

After changes, show:

- Modified files
- Summary of changes
- Validation result
- Next recommended patch

## Development Rules

Work in small patches.

Do not implement Blogger real publishing before:

1. OAuth is working.
2. A test blog is connected.
3. Quality checks block risky content.
4. Draft save works.

Do not implement automatic bulk publishing in MVP.

## LLM Rules

The platform must support both:

- OpenAI API
- Local LLM HTTP endpoint

LLM usage must go through a provider abstraction layer.

Do not hardcode OpenAI API keys.

Do not hardcode local LLM endpoint except as a harmless default example.

Each LLM call must record:

- Task type
- Provider
- Model
- Status
- Latency
- Error message if failed

## Required Validation

For every patch, run relevant checks.

For this Next.js project, prefer:

```bash
npm run lint
npm run typecheck
npm run build
```

If a command does not exist yet, document that it is not available.

## MVP Order

1. Project scaffold
2. Documentation
3. Database models
4. LLM provider settings
5. Blog and brand profiles
6. Blogger OAuth
7. Content input
8. Content planning
9. Draft and HTML generation
10. Quality check
11. Blogger draft save
12. Scheduled publishing
