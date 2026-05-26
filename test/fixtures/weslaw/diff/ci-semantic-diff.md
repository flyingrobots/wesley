# Wesley Law Diff

| Field | Value |
| --- | --- |
| API version | `wesley.law-diff/v1` |
| Old schema hash | `sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6` |
| New schema hash | `sha256:ee681e8c2c99acb5db74f09b2eb06cca2e9379fc7d69627d3287cba6177ac4b6` |
| Old law hash | `sha256:88fcbb7fb07cc0bb5dfa30252ec61badb3a8dff1be71c0f20ae21031e4e80f51` |
| New law hash | `sha256:ba4a878e94a961bbbe68b421aa2829f39e9e464a4d3e4647dc8d4ccb0c55eab7` |

## Changes

| Kind | Law | Subject | Summary |
| --- | --- | --- | --- |
| `LAW_WEAKENED` | `echo.scalar.positiveInt.u32-positive` | `scalar:PositiveInt` | law weakened: body.minInclusive, body.maxInclusive, body.forbids |
| `LAW_WEAKENED` | `echo.variant.playback-mode` | `input:PlaybackModeInput` | law weakened: body.cases.PAUSED.forbids, body.cases.SEEK.requires |
| `FOOTPRINT_EXPANDED` | `jedit.op.replaceRangeAsTick.footprint` | `operation:Mutation.replaceRangeAsTick` | added reads: TextBlob; added creates: TickReceipt; removed forbids: Diagnostics |

