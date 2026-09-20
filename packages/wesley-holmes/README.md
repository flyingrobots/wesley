# @wesley/holmes

The one remaining Node package in the Wesley repository. It provides the
`holmes` and `moriarty` commands that this repository's own assurance workflow
runs (`.github/workflows/wesley-holmes.yml`).

It is private, it is not part of the Wesley compiler, and its `package.json`
marks it `legacy-compatibility`. New compiler work goes in the Rust crates.

```bash
pnpm --filter @wesley/holmes test
```
