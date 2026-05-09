# RUNTIME test-fixtures import cutover from inline schemas

Legacy `TASKS.md` still tracked the migration from large inline GraphQL fixture
definitions toward `@wesley/test-fixtures`.

Done when:
- tests that still embed large duplicated schema fixtures import shared builders or helpers from `@wesley/test-fixtures`
- duplication is materially reduced across packages
- the cut does not silently change test meaning or hide coverage gaps
