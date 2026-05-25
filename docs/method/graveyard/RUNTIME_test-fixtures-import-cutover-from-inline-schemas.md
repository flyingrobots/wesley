# RUNTIME test-fixtures import cutover from inline schemas

Legacy `TASKS.md` still tracked the migration from large inline GraphQL fixture
definitions toward `@wesley/test-fixtures`.

Status: archived by deletion.

`packages/wesley-test-fixtures/` was deleted in NR-083. The replacement path is
not another npm helper package: useful fixtures live as plain files under
`test/fixtures/` or as Rust test fixtures. Future duplication cleanup should
target those homes directly instead of resurrecting a shared JavaScript fixture
package.
