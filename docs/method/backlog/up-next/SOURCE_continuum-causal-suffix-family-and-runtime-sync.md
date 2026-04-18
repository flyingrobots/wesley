# Continuum causal suffix family and runtime sync

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

Continuum now has a cleaner "one graph, two temperatures" story and a sharper
runtime-handoff law, but the concrete transport family is still missing.

Without a shared authored family, the stack will drift toward:

- handwritten Echo transport DTOs
- handwritten `git-warp` transport DTOs
- adapter folklore instead of shared publication truth

## Hill

Wesley compiles one Continuum-authored causal suffix bundle family into
portable Rust and TypeScript artifacts without absorbing engine-local admission
semantics.

## Done looks like

- one design packet names the authored family / compiled artifacts / runtime
  law split
- one authored family names at least:
  - `ExportSuffixRequest`
  - `CausalSuffixBundle`
  - `ImportAdmissionResult`
  - bundle witness and payload helper objects
- one Rust output lane exists for runtime consumers
- one TypeScript output lane exists for tooling/bridge consumers
- one proof target is frozen:
  - Echo exports a suffix bundle against generated Rust artifacts
- one follow-on proof target is named:
  - `git-warp` import of that suffix bundle

## Must not do

- absorb Echo or `git-warp` admission policy into Wesley
- normalize state mirroring into the family boundary
- pretend cache equality is graph equality
- let the transport family replace receipt/settlement publication families
