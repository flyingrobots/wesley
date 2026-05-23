# GH-344 [bug] Wesley Website Deployment Failure on PRs

- Imported from: GitHub issue
- Issue: #344
- URL: https://github.com/flyingrobots/wesley/issues/344
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:05Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `bug`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

### Summary

The deployment job is not meant to run on any arbitrary branch. It fails. Looks red. Is bad for deployment success rates. False red-flag.

### Steps to Reproduce

1. Submit a PR (that touches the website).
2. Behold the terror of the error.

### Expected Behavior

Deployments should target some other env, or be disabled for PRs.

### Actual Behavior

<img width="831" height="206" alt="Image" src="https://github.com/user-attachments/assets/ed246016-adb9-4b14-abe5-3ca67c30f2da" />

### Environment

website

### Is this blocking you?

- [ ] Yes, blocks my workflow
- [x] No, minor inconvenience
