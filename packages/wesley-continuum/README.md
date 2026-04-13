# @wesley/continuum

Continuum-specific package for Wesley. It owns the shared-family scope profiles,
publication-boundary defaults, and the Continuum judgment profile for
SHA-lock HOLMES, Watson, and Moriarty.

- **Scope profiles**: current-minimum, receipt-family, and settlement-family
  defaults for local compile, witness, and drift-watch workflows.
- **Publication boundary policy**: the generated roots, authored homes, and
  reserved roots that Continuum witness lanes are allowed to rely on.
- **Judgment profile**: Continuum-specific expectations for what Holmes,
  Watson, and Moriarty each do, consume, emit, and explicitly do not own.
- **Execution split**: `@wesley/holmes` remains the shared execution engine;
  `@wesley/continuum` owns the product profile that the Continuum lane should
  apply.

This package is not the primary cross-repo consumer surface for Echo,
`git-warp`, or `warp-ttd`. The intended consumer surface is a versioned
contract bundle or one of its generated projections; `@wesley/continuum`
exists so Wesley-side commands and reports can load Continuum policy without
hardcoding it into generic compiler packages.

## Usage

```bash
pnpm --filter @wesley/continuum test
```

Import it from other Wesley packages when a command or report needs Continuum
defaults without hardcoding them into generic CLI logic.

## Status

Status: Active

Alpha package for the release line. It carries product policy and operator
defaults, not generic compiler infrastructure or the universal runtime
dependency for neighboring repos.
