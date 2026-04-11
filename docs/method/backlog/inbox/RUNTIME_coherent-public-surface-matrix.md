# Coherent Public Surface Matrix

- Lane: `inbox`
- Legend: `RUNTIME`

## Why now

The old README carried a much larger public surface:

- browser playground
- hosts and package matrix
- demos and runtime smokes
- broader integration and future platform breadth

The new signposts are more honest, but they no longer carry that whole surface
as a front-door story. That is good for truthfulness, but it risks losing the
coherent public product shape Wesley was trying to present.

## Hill

The repo has one calm public surface matrix that says which major surfaces are:

- current
- experimental
- legacy
- target state

## Matrix shape

The matrix should be a Markdown table in `docs/public-surface-matrix.md`.

Required columns:

- `Surface`
- `Owner`
- `Status`
- `Link`
- `Notes`

Required rows should include:

- browser or playground
- host surfaces
- runtime surfaces
- package surfaces
- major demos or integrations

Example row:

| Surface | Owner | Status | Link | Notes |
| --- | --- | --- | --- | --- |
| browser/playground | Wesley docs/site owners | `target` | `docs/README.md` | Visible goal, not current front-door truth |

## Done looks like

- the browser/playground story is a row in the matrix with an explicit status
- host/runtime/package surfaces are rows in the matrix instead of a huge badge
  wall
- major public surfaces link from the matrix to their real owning docs
- future-facing breadth remains visible without being presented as shipped fact
- the broader coherent product surface remains an explicit target, not a dead
  README dream

## Repo Evidence

- old `README.md` at commit `6672939`
- `README.md`
- `docs/VISION.md`
- `docs/README.md`
- package READMEs under `packages/`
- `ROADMAP.md`
