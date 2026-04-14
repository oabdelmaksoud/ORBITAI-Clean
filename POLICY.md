# OrbitAI — Compliance & Usage Policy

> Last Updated: April 2026

---

## 1. Access & Authorization

This repository is **private and proprietary**. Access is restricted to authorized contributors only.

- Do **not** share, redistribute, or publish any portion of this codebase without explicit written permission from the repository owner.
- Contributors must be granted access via GitHub and must have signed any applicable contributor agreements before merging code.

---

## 2. Data Handling

- All user data stored in MongoDB must be handled in accordance with applicable data-protection laws (GDPR, CCPA, etc.).
- Personally Identifiable Information (PII) must never be logged in plaintext. Use anonymized IDs in log statements.
- API keys and credentials **must** be stored as environment variables and never committed to version control.
- The `.env` file is in `.gitignore`. Rotate any secrets immediately if they are accidentally exposed in a commit.

---

## 3. AI Model Usage

- AI-generated output is **not** guaranteed to be accurate, safe, or appropriate for all use cases. Output must be reviewed before being used in critical decisions.
- Do not use OrbitAI to generate content that violates Anthropic, OpenAI, Google, or other provider usage policies.
- Do not use OrbitAI to process sensitive personal data without appropriate user consent.

---

## 4. Third-Party Integrations

All third-party API credentials (Slack, Microsoft Teams, GitHub, cloud providers) must:

1. Be stored in environment variables (`server/.env`).
2. Be rotated periodically following each provider's recommended security practices.
3. Be scoped to the minimum required permissions.

---

## 5. Security Responsibilities

- Report security vulnerabilities to the repository owner privately before filing a public issue.
- Do not merge code that introduces known OWASP Top 10 vulnerabilities (SQL/NoSQL injection, XSS, CSRF, broken authentication, etc.).
- All pull requests touching authentication, authorization, or data access code require a second reviewer.

---

## 6. Deployment

- Production deployments must use HTTPS (TLS 1.2+).
- `NODE_ENV=production` disables verbose error messages and development tools.
- See `DEPLOYMENT.md` for the full deployment checklist.

---

## 7. License

This software is proprietary. Unauthorized copying, modification, distribution, or use is strictly prohibited.
