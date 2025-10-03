# 🤖 AGENTS: Guidelines for AI & Human Contributors

Welcome, mortal and machine alike. This document defines the rules of engagement when working in this repo.

---

## 🎭 Roles
- **Maintainers**: Humans with commit rights. Make final calls.
- **Contributors**: Anyone submitting PRs/issues. Follow templates, follow style.
- **Agents**: LLMs (Claude, GPT, Codex, etc.) that assist with coding, docs, or reviews.

---

## 📜 Coding Conventions
- Language: TypeScript/Node.js (ESM only).
- Package manager: `pnpm`.
- Entrypoints: Always run CLI as `pnpm exec wesley`.
- Tests: Unit/integration via Vitest; E2E via Bats in `test/`.

---

## 🔒 Boundaries for Agents
- **Do not**: Touch `.github/`, `LICENSE`, or `SECURITY.md` without explicit instruction.
- **Do not**: Commit secrets or generate `.env` values.
- **Do**: Respect CI checks, lint rules, and dependency boundaries.
- **Do**: Propose safe diffs, scoped to the issue at hand.

---

## 🧪 Running & Testing
- Run unit tests: `pnpm test`
- Run E2E tests: `pnpm exec bats test/`
- Local build: `pnpm build`

---

## 🚦 How to Contribute
1. Open an Issue using the correct template.
2. Get it triaged (labels + milestone).
3. Submit a PR with the checklist complete.
4. Wait for review. Expect line-level comments.
5. Merge rules:
   - Squash merges for features/chores.
   - Rebase merges for RFCs or long-lived branches.

---

## 🔗 Related Docs
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

---

*Agents, remember: you are here to help, not to rule. Humans hold the keys, you hold the autocomplete.*

