---
title: "Transmuter Lowering Engine Extraction"
legend: TRANSMUTE
release: "v0.1.0"
lane: v0.1.0
---

# Transmuter Lowering Engine Extraction

Split the current Transmuter so SDL -> IR lowering becomes a standalone service with a narrow interface. The release witness is that lowering can be exercised independently of generator orchestration and no generator has to reach back into the authored SDL to do its work.
