# TRANSMUTE RepairGenerator MigrationSafety constructor injection

Legacy `TASKS.md` still called out direct `new MigrationSafety()` creation
inside `RepairGenerator`.

Done when:
- `RepairGenerator` accepts the dependency through injection instead of direct instantiation
- tests prove the generator can run against an alternate or stubbed safety collaborator
- the generator no longer hard-codes one concrete safety implementation
