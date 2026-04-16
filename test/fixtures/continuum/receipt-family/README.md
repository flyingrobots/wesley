# Continuum Receipt Family Fixtures

These fixtures pin the first boring receipt-family witness lane.

- `minimal.json` names the emitted family nouns, operations, invariants, and
  footprints that both generated legs must preserve.
- `boundary.json` pins the authored field boundaries for the object types that
  matter to the family witness.
- `roundtrip.json` pins one concrete operation-vector set whose args and result
  rows must stay compatible with both emitted legs.
- `receipt-vs-witness.json` names the fields that must remain separate across
  `Receipt`, `Witness`, and `DeliveryObservation`.
- `invalid.json` carries one intentionally bad delivery-observation row used by
  the witness tests to prove the separation checks actually fail when the
  family boundaries blur.
