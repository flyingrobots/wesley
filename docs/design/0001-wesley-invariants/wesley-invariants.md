---
title: 'Wesley Invariants'
---

## Sponsors

- Human: I can point to a finite, exact set of Wesley application invariants
  and tell whether a proposed cycle preserves them.
- Agent: I can inspect repo-visible files and determine what Wesley claims must
  remain true, what would violate those claims, and how each invariant is
  checked.

## Hill

Wesley's application invariants become a canonical, finite, repo-grounded set
instead of an implied cluster of slogans spread across the README, roadmap, and
architecture notes.

## Playback Questions

### Human

- [ ] Can I read `docs/invariants/README.md` and know the exact invariant set
      without inferring it from scattered doctrine?
- [ ] Does each invariant say what preserves it, what violates it, and how to
      check it?
- [ ] Is it now clear which nearby ideas are product pillars or theses rather
      than invariants?

### Agent

- [ ] Can I map each invariant back to repo-visible source claims rather than
      treating it as invented process language?
- [ ] Is the set finite and non-overlapping enough to use during future cycle
      review?
- [ ] Can I distinguish source-authority claims from product-scope claims such
      as transmutations?

## Accessibility and Assistive Reading

- The invariant files must read clearly as plain Markdown in a linear reader.
- Each file should front-load the invariant statement before rationale or
  examples.

## Localization and Directionality

- Keep invariant names short, literal, and stable.
- Prefer explicit scope words over metaphor or layout-dependent language.

## Agent Inspectability and Explainability

- Each invariant must expose repo-visible checks rather than relying on oral
  tradition or undocumented taste.
- The set should distinguish product invariants from phase-specific contracts or
  implementation tactics.
- The set should also distinguish invariants from core pillars or product
  theses, especially where the wording is adjacent.

## Non-goals

- [ ] Proving that every invariant is fully satisfied on every path today.
- [ ] Automating every invariant check in this cycle.
- [ ] Rewriting the product roadmap or architecture notes beyond what the
      invariant set requires.
- [ ] Inventing a large legend taxonomy just to classify invariants.
