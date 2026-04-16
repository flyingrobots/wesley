# Observer Spec / Plan Lowering

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

The stack has now converged on a cleaner optic boundary:

- GraphQL authors the set side
- applications need a lawful way to author the get side
- Echo stays generic substrate truth
- sliced holograms and frontiers should feed observer readings instead of full
  state materialization

Wesley currently compiles:

- mutation-facing contract families
- reading/result types
- runtime rewrite surfaces

What is still missing is the compiler seam for the observer side:

- app-authored `ObserverSpec`
- compiler-produced `ObserverPlan`
- observer-state and reading codecs

## Hill

Wesley lowers one app-authored observer spec into a substrate-legal observer
plan with explicit state/read codecs and without normalizing arbitrary
callbacks.

## Done looks like

- one design packet names `ObserverSpec`, `ObserverPlan`, and `ObserverInstance`
  as distinct layers
- one compiler-facing authored shape is chosen for the first observer lane
- one output shape is named for:
  - observer plan
  - observer state codec
  - reading codec
  - hologram/frontier envelope helpers where needed
- one first proving target is frozen:
  - `jedit` `worldlineSnapshot` as a memoryless observer
- follow-on target is named:
  - one accumulative observer proof slice

## Must not do

- normalize arbitrary JS closures into observer legality
- normalize arbitrary Rust callbacks into observer legality
- pretend GraphQL query shape is already a full observer
- collapse authored spec, compiled plan, hosted instance, and reading into one
  object
