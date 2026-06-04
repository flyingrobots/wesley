# GH-218 : Implement Landing Page Animations and Smooth Scrolling with GSAP

- Imported from: GitHub issue
- Issue: #218
- URL: https://github.com/flyingrobots/wesley/issues/218
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:16Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: _none_

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

# Quick Task: Implement Landing Page Animations and Smooth Scrolling with GSAP

## Overview

Add life to the landing page by implementing smooth-scrolling navigation and scroll-triggered animations using GSAP. This will make the page more engaging and improve the user experience.

## Acceptance Criteria

- [ ] GSAP is installed and configured in the project.
- [ ] Clicking on the header links ('What', 'Why', 'How') smoothly scrolls the page to the corresponding section.
- [ ] Content in the 'What is Wesley?', 'Why Wesley?', and 'How does it work?' sections animates into view as the user scrolls down the page.

## Definition of Done

- Tests / validation: Run `npm run dev` and verify that the smooth scrolling and animations are working as expected.
- Docs / comms touched: n/a

## Links

- Primary reference: [GSAP Documentation](https://greensock.com/docs/)
- Related issues / PRs: [WEB-002]
