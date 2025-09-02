# Wesley + SHA-lock HOLMES Demo Script

## Opening (0:00-0:15)

"Everyone generates GraphQL from databases. Wesley generates databases from GraphQL.

Today I'll show you how Wesley revolutionizes database development by making GraphQL your single source of truth, with production-grade intelligence from SHA-lock HOLMES."

## The Problem (0:15-0:45)

"Traditional development is insane. You write the same data shape 5+ times:
- SQL DDL
- GraphQL schema
- TypeScript types
- Zod validation
- Migrations
- Tests

Wesley inverts this. Write GraphQL once. Get everything else for free."

## The Schema (0:45-1:30)

```graphql
type User @table @critical @uid("tbl:user") {
  email: String! @pii @weight(9)
  password_hash: String! @sensitive @weight(10)
  theme: String @weight(2)  # Low priority
}
```

"Look at these directives:
- @uid gives stable identities that survive renames
- @weight tells Wesley what matters - password is 10, theme is 2
- @sensitive enforces security constraints automatically
- @critical marks mission-critical tables"

## Generation Demo (1:30-2:30)

```bash
wesley generate --schema ecommerce.graphql --emit-bundle
```

"One command generates:
- PostgreSQL DDL with constraints
- TypeScript types
- Zod schemas
- pgTAP tests weighted by risk
- Evidence bundle for verification

Look at the scores:
- Schema Coverage: 84% weighted by importance
- Migration Risk: 23% - quantified danger
- Test Confidence: 71% - risk-weighted coverage"

## SHA-lock HOLMES (2:30-3:30)

```bash
holmes investigate
```

"HOLMES investigates with surgical precision:

| Feature | Weight | Status | Evidence |
|---------|--------|--------|----------|
| password_hash | 10 | ✅ | schema.sql:15@abc123 |
| payment_id | 9 | ✅ | schema.sql:89@abc123 |

Every claim is SHA-locked. No more 'works on my machine.'"

## Security Gates (3:30-4:00)

"Wesley enforces production safety:

```graphql
password: String! @sensitive
```

This BLOCKS deployment if there's no bcrypt constraint.

```graphql
email: String! @pii
```

This WARNS if there's no RLS masking.

Security isn't optional - it's enforced."

## CI/CD Integration (4:00-4:30)

"Every PR gets automatic analysis:
- HOLMES investigates
- WATSON verifies independently  
- MORIARTY predicts ship date
- Report posted as comment

Your PR shows:
- Weighted coverage: 84%
- Migration risk: 23%
- ETA to production: 3 days"

## The Paradigm Shift (4:30-5:00)

"This isn't just code generation. It's a paradigm shift.

Migrations are a byproduct, not a task.
Tests are weighted by what matters.
Evidence is SHA-locked, not promised.

Wesley knows that User.password matters more than User.theme.
It generates tests accordingly.
It blocks dangerous operations automatically.

One schema. Complete intelligence.

Make it so, schema."

## Closing (5:00-5:15)

"Wesley + SHA-lock HOLMES. 
Built in 7 days.
Ready for production.

Where schemas become systems."

---

## Key Talking Points

1. **Production Mindset**: Not toys - production safety gates
2. **Quantified Metrics**: Numbers, not opinions  
3. **Verifiable Evidence**: SHA-locked, not promises
4. **Intelligent Prioritization**: Knows what matters
5. **Complete Solution**: Schema to deployed database

## Questions to Anticipate

**Q: How does this compare to Prisma?**
A: Prisma generates types FROM your database. Wesley generates your database FROM GraphQL. Complete inversion.

**Q: What about existing databases?**
A: Wesley can introspect and generate migration diffs. Your schema becomes the source of truth going forward.

**Q: Is this production-ready?**
A: The scoring system tells you. When SCS > 80%, MRI < 40%, TCI > 70%, you're ready. Data-driven, not gut feelings.

**Q: How does weighting work?**
A: Critical fields like passwords get weight 10. UI preferences get weight 2. Wesley prioritizes testing and validation accordingly.

**Q: What's the SHA-lock?**
A: Every piece of evidence is tied to a specific commit SHA. Claims are verifiable, not just assertions.