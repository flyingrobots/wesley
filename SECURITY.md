# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

Wesley takes security seriously, especially when generating production database code.

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

### Generated SQL

Wesley generates SQL with security in mind:
- `@sensitive` fields enforce constraints
- `@pii` fields trigger RLS recommendations
- Password fields require bcrypt constraints
- RLS policies use Supabase Auth functions

### Evidence Integrity

- All evidence is SHA-locked
- Bundle files include version numbers
- Migration risk is calculated automatically

### Best Practices

1. **Always review generated SQL** before applying to production
2. **Use @sensitive and @pii directives** appropriately
3. **Enable RLS** for multi-tenant applications
4. **Test migrations** in isolated environments first
5. **Monitor MRI scores** - high risk requires manual review

## Security Features

- **Automatic bcrypt enforcement** for password fields
- **RLS policy generation** from @rls directives
- **PII field detection** and warnings
- **Migration risk scoring** (MRI)
- **SHA-locked evidence** for audit trails
