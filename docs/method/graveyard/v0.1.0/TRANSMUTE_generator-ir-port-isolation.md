---
title: 'Generator IR Port Isolation'
legend: TRANSMUTE
release: 'v0.1.0'
lane: v0.1.0
---

# Generator IR Port Isolation

Formalize the IR port so generators only consume IR plus explicit emission context, with zero knowledge of filesystem layout or original SDL paths. The release witness is that generator contracts enforce the boundary instead of relying on discipline.
