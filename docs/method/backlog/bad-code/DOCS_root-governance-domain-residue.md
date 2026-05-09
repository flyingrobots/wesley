# Root governance docs still carry domain residue

- Lane: `bad-code`
- Legend: `DX`

## Why now

The release branch now presents Wesley as a domain-empty `GraphQL -> whatever`
compiler and assurance toolchain, but root governance docs still describe the
old database-change product identity.

`CONTRIBUTING.md` says Wesley exists to make database change trustworthy, and
`SECURITY.md` promises generated-SQL, Supabase, RLS, bcrypt, and migration-risk
security behavior as if those are generic Wesley features.

## Hill

A new contributor can read the root governance and security files without being
sent toward wrong-repo database/product work.

## Done looks like

- `CONTRIBUTING.md` describes Wesley as the module-first compiler kernel and
  assurance toolchain
- `SECURITY.md` describes trusted modules, allowlist/disable controls,
  dependency audit posture, evidence integrity, and generated artifact review
- database, PostgreSQL, Supabase, RLS, and bcrypt behavior is explicitly framed
  as external module responsibility unless it is historical context
- README, GUIDE, ARCHITECTURE, CONTRIBUTING, and SECURITY agree on repo identity

## Repo Evidence

- `README.md`
- `docs/ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
