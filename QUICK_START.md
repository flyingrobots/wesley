# 🚀 Wesley Quick Start - From Zero to Production in 5 Minutes

## Installation (30 seconds)

```bash
# Clone the repository
git clone https://github.com/yourusername/wesley.git
cd wesley

# Install dependencies
pnpm install

# Link packages for development
pnpm run link

# Install globally (optional)
npm link packages/wesley-cli
npm link packages/wesley-holmes
```

## Your First Schema (1 minute)

Create `schema.graphql`:

```graphql
type User @table @critical {
  id: ID! @primaryKey @default(expr: "gen_random_uuid()")
  email: String! @unique @pii @weight(9)
  password_hash: String! @sensitive @weight(10)
  created_at: DateTime! @default(expr: "now()")
}

type Post @table {
  id: ID! @primaryKey @default(expr: "gen_random_uuid()")
  user_id: ID! @foreignKey(ref: "User.id") @index
  title: String! @weight(7)
  content: String
  published: Boolean! @default(expr: "false")
}
```

## Generate Everything (30 seconds)

```bash
# Generate SQL, TypeScript, tests, and evidence
wesley generate --schema schema.graphql --emit-bundle

# Output:
# ✨ Generated:
#   ✓ PostgreSQL DDL       → out/schema.sql
#   ✓ TypeScript Types     → out/types.ts
#   ✓ pgTAP Tests          → tests/generated.sql
#   ✓ Evidence Bundle      → .wesley/
# 
# 📊 Scores:
#   SCS: 84.3%
#   MRI: 23.0%
#   TCI: 71.0%
# 
# 🎯 Verdict: READY FOR REVIEW
```

## Run Intelligence Analysis (30 seconds)

```bash
# Investigate with HOLMES
holmes investigate

# Output:
# 🔍 SHA-lock HOLMES Investigation
# Weighted Completion: ████████░░ 84%
# Critical Issues: 0
# Warnings: 1 (Add RLS for User table)

# Verify with WATSON
holmes verify

# Predict with MORIARTY
holmes predict
# ETA to 95%: 3 days
```

## Apply to Database (1 minute)

```bash
# Start local Supabase (if not running)
supabase start

# Apply the generated SQL
psql $DATABASE_URL < out/schema.sql

# Run the tests
pg_prove -d test tests/generated.sql

# All 47 tests pass!
```

## Set Up CI/CD (1 minute)

Copy the workflow to your repo:

```bash
cp .github/workflows/wesley-holmes.yml your-repo/.github/workflows/
```

Now every PR gets:
- Automatic generation
- HOLMES investigation
- WATSON verification
- MORIARTY predictions
- Report as PR comment

## Advanced Features (30 seconds)

### Add Supabase RLS

```graphql
type Post @table @rls(
  select: "true"
  insert: "auth.uid() = user_id"
  update: "auth.uid() = user_id"
  delete: "auth.uid() = user_id"
) {
  # ... fields
}
```

### Add Realtime

```graphql
type Post @table @realtime {
  # ... subscribable in realtime
}
```

### Custom Weights

```graphql
type Config @table {
  api_key: String! @sensitive @weight(10)  # Critical
  theme: String @weight(2)                 # Cosmetic
}
```

## Production Checklist

Wesley tells you when you're ready:

- [ ] **SCS > 80%** - Schema coverage weighted by importance
- [ ] **MRI < 40%** - Migration risk is acceptable
- [ ] **TCI > 70%** - Tests cover critical paths
- [ ] **All @sensitive fields** have constraints
- [ ] **All @pii fields** have RLS policies
- [ ] **Evidence bundle** committed to repo

## Common Commands

```bash
# Watch mode for development
wesley watch --schema schema.graphql

# Generate migration from changes
wesley migrate --from v1.graphql --to v2.graphql

# Run full investigation
wesley investigate && wesley verify && wesley predict

# Generate for Supabase
wesley generate --schema schema.graphql --supabase

# Custom output directory
wesley generate --schema schema.graphql --out ./database
```

## Troubleshooting

**Q: Why is my score low?**
A: Check high-weight fields. One missing critical field impacts more than many cosmetic ones.

**Q: How do I improve MRI?**
A: Avoid dropping columns/tables. Add defaults to new NOT NULL columns.

**Q: Can I customize weights?**
A: Yes! Use `@weight(1-10)` on any field or table.

## The Demo

See the complete e-commerce demo:

```bash
cd example
./demo.sh
```

This shows:
- Production schema with 20+ tables
- Security constraints enforced
- RLS policies generated
- Complete test coverage
- CI/CD integration

## Get Help

- Documentation: `/docs`
- Examples: `/example`
- Issues: GitHub Issues
- Discord: [Join our Discord](#)

---

**"Make it so, schema."**

Wesley: Where schemas become systems.