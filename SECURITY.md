# Security Policy

## Supported Versions

| Version or branch | Supported |
| ------- | ------- |
| Active release branches | Yes |
| Current `main` | Yes |
| Older pre-1.0 tags | No, unless a maintainer explicitly backports a fix |

## Reporting a Vulnerability

Wesley takes security seriously because it compiles schema-authored contracts,
loads trusted extension modules, and emits artifacts and evidence that other
systems may rely on.

### Where to Report

Please report security vulnerabilities to: security@flyingrobots.dev

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Time

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Based on severity
  - Critical: Within 72 hours
  - High: Within 1 week
  - Medium: Within 2 weeks
  - Low: Next release

## Security Considerations

### Trusted Module Execution

Wesley is a domain-empty compiler and assurance toolchain. Target semantics
enter through modules, and modules are trusted code.

- Load modules only from reviewed paths and packages.
- Use `WESLEY_MODULE_ALLOWLIST` in CI when module imports must be restricted.
- Use `WESLEY_DISABLE_MODULES=1` for no-module diagnostic runs.
- Treat failed, missing, duplicate, or disabled module entries as release
  evidence, not as harmless noise.
- Keep product/runtime/database policy in the owning module or sibling repo,
  not in generic Wesley.

### Generated Artifacts

Wesley may emit code, descriptors, manifests, bindings, evidence, or other
artifacts through generic emitters and external modules.

- Review generated artifacts before applying them to production systems.
- Verify the module that emitted each artifact and the input SDL it consumed.
- Treat database-specific output such as SQL, migrations, RLS, Supabase policy,
  or PostgreSQL execution plans as external-module responsibility.
- Do not assume Wesley core has validated target-specific security semantics
  unless the responsible module emits explicit evidence for that claim.

### Evidence Integrity

- Evidence should be content-addressed or hash-linked when it is used as a
  release gate.
- Bundle files should include version and source identity where applicable.
- Generated artifact review should preserve the input SDL, module identity,
  command, and validation output needed to reproduce the claim.

### Dependency And Host Posture

- Keep dependency updates reviewable and run repository preflight before
  release.
- Prefer deterministic inputs, injected clocks, and explicit host permissions
  for portable capability work.
- Do not grant portable modules ambient filesystem, network, process, or clock
  access without an explicit host-function design.

### Best Practices

1. Review the SDL, loaded modules, and emitted artifacts together.
2. Run `pnpm run preflight` before release.
3. Use module allowlists in CI for trusted module surfaces.
4. Keep database, runtime, and product-specific security decisions in the
   owning module or repo.
5. Preserve evidence needed to reproduce any security-relevant release claim.

## Security Features

- Module disable and allowlist controls for diagnostic and CI runs
- Domain-empty compiler boundary that keeps target security policy out of core
- Hash-linked evidence and artifact review surfaces
- Dependency and documentation preflight checks
- Explicit external-module responsibility for database, runtime, and product
  security behavior
