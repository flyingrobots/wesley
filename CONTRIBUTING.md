# Contributing to Wesley

First off, thank you for taking the time to contribute! ❤️  
This project thrives on community involvement — issues, PRs, docs, or ideas are all welcome.

---

## 📝 Ground Rules
- Use **Issues** to propose, request, or report — never as vague todo lists.
- Follow the provided **Issue Templates** (bug, feature, chore, RFC).
- Submit PRs against `main` unless otherwise directed.
- Keep changes **small and focused**. Large PRs without discussion will be closed.

---

## ⚙️ Setup
```bash
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install
pnpm test
```

- Use pnpm as the package manager.
- All commands are available via pnpm exec.

---

## ✅ Development Flow
1. Fork & branch (`git checkout -b feat/my-feature`).
2. Write code & tests.
3. Run `pnpm lint && pnpm test`.
4. Update docs if needed.
5. Submit a PR:
   - Fill out the PR template.
   - Reference related issues.
   - Expect reviews with line-level feedback.

---

## 🔍 Commit Conventions

We use Conventional Commits:
- `feat: add CLI option for …`
- `fix: handle null in parser`
- `chore: update CI workflow`
- `docs: improve README`

---

## 🤖 Agents

If you use AI to draft code or docs:
- Review everything manually.
- AI commits must be attributed with human oversight.
- See AGENTS.md.

---

## 🙌 Thank You

Every contribution matters — from typo fixes to major features. You make this project better.

