# Wesley + SHA-lock HOLMES Integration

## The Schema Intelligence System

Wesley generates code from GraphQL. SHA-lock HOLMES proves it's correct, WATSON verifies it independently, and MORIARTY predicts when it's production-ready.

**HOLMES is a separate sidecar package** (`@wesley/holmes`) that consumes Wesley's evidence bundle without bloating the core.

```mermaid
graph TB
    subgraph "Wesley Core"
        Schema[GraphQL Schema]
        Parser[Parser]
        IR[Domain IR]
        Generators[Generators]
    end
    
    subgraph "Generated Artifacts"
        SQL[SQL DDL]
        Types[TypeScript]
        Zod[Zod Schemas]
        Tests[pgTAP Tests]
    end
    
    subgraph "Evidence System"
        EvidenceMap[Evidence Map]
        Scores[SCS/MRI/TCI]
        Bundle[.wesley-cache/bundle]
    end
    
    subgraph "SHA-lock HOLMES"
        Holmes[Investigation]
        Watson[Verification]
        Moriarty[Prediction]
    end
    
    Schema --> Parser --> IR --> Generators
    Generators --> SQL & Types & Zod & Tests
    Generators --> EvidenceMap
    IR --> Scores
    EvidenceMap & Scores --> Bundle
    Bundle --> Holmes --> Watson --> Moriarty
    
    style Schema fill:#f9f,stroke:#333,stroke-width:4px
    style Bundle fill:#9f9,stroke:#333,stroke-width:2px
```

## New Directives

Wesley now supports intelligent directives that enable HOLMES analysis:

### Identity Directives

```graphql
directive @uid(value: String!) on OBJECT | FIELD_DEFINITION

type User @table @uid("tbl:user") {
  id: ID! @primaryKey @uid("col:user.id")
  email: String! @unique @uid("col:user.email")
}
```

**Purpose**: Stable identities that survive renames. HOLMES uses these to track elements across commits.

### Weight & Criticality Directives

```graphql
directive @weight(value: Int! = 5) on OBJECT | FIELD_DEFINITION
directive @critical on OBJECT | FIELD_DEFINITION
directive @sensitive on FIELD_DEFINITION
directive @pii on FIELD_DEFINITION

type User @table @critical {
  id: ID! @primaryKey
  email: String! @pii @weight(8)
  password: String! @sensitive @weight(10)
  theme: String @weight(2)  # Low priority UI preference
}
```

**Purpose**: Not all fields are equal. Critical auth fields matter more than UI preferences.

### Default Weights

| Directive/Type | Default Weight | Rationale |
|----------------|----------------|-----------|
| `@critical` | 10 | Mission-critical functionality |
| `@primaryKey` | 10 | Core identity field |
| `@sensitive` | 9 | Security-critical |
| `@foreignKey` | 8 | Relationship integrity |
| `@unique` | 8 | Business constraint |
| `@pii` | 8 | Privacy compliance |
| `@index` | 5 | Performance optimization |
| Default field | 5 | Standard field |

## The Evidence Map

Every `wesley generate` now produces generated evidence artifacts under `.wesley-cache/`:

```json
{
  "sha": "abc123def456",
  "timestamp": "2024-03-20T10:30:00Z",
  "evidence": {
    "col:user.email": {
      "sql": [{
        "file": "out/schema.sql",
        "lines": "42-49",
        "sha": "abc123d",
        "timestamp": "2024-03-20T10:30:00Z"
      }],
      "ts": [{
        "file": "out/types/User.d.ts",
        "lines": "5-10",
        "sha": "abc123d"
      }],
      "zod": [{
        "file": "out/zod/user.ts",
        "lines": "9-15",
        "sha": "abc123d"
      }],
      "tests": [{
        "file": "tests/schema/constraints.sql",
        "lines": "70-90",
        "sha": "abc123d"
      }]
    }
  }
}
```

**Purpose**: HOLMES can cite `file:lines@sha` without brittle grep. Every claim is SHA-locked.

## The Scoring System

Wesley calculates three scores:

### SCS - Schema Coverage Score

**Formula**: `Σ(weight × present) / Σ(weight)`

- Measures: Did artifacts exist for each schema element?
- Range: 0-1 (0% to 100%)
- Threshold: 0.8 (80%) recommended
- Breakdown surfaced in bundles:
  - **sql** – weighted DDL coverage for each UID
  - **types** – TypeScript emission coverage
  - **validation** – Zod/runtime schema coverage
  - **tests** – pgTAP suites covering the element

Example:
```javascript
// High-weight critical field missing TypeScript type
User.password: weight=10, sql=✓, ts=✗, zod=✓ → 66% coverage
User.theme:    weight=2,  sql=✓, ts=✓, zod=✓ → 100% coverage

// Weighted average favors critical field
SCS = (10 × 0.66 + 2 × 1.0) / 12 = 0.72 (72%)
```

### MRI - Migration Risk Index

**Formula**: Risk points normalized to 0-1

| Operation | Risk Points | Reason |
|-----------|-------------|--------|
| DROP TABLE | 40 | Data loss |
| DROP COLUMN | 25 | Data loss |
| ALTER TYPE (unsafe) | 30 | May fail |
| ADD NOT NULL (no default) | 25 | Requires backfill |
| RENAME (no @uid) | 10 | Breaks references |
| CREATE INDEX (blocking) | 10 | Performance impact |

Breakdown vectors in `scores.breakdown.mri`:

- **drops** – destructive operations such as `DROP TABLE`/`DROP COLUMN`
- **renames** – renames without `@uid` continuity
- **defaults** – new NOT NULL columns missing defaults/backfill strategy
- **typeChanges** – ALTER TYPE operations (unsafe casts weigh more)
- **indexes** – blocking index creation or missing `CONCURRENTLY`
- **other** – residual operations recorded for transparency

Example:
```sql
-- Migration with MRI = 0.55 (55% risk)
DROP COLUMN users.old_field;     -- +25
ALTER COLUMN posts.count TYPE bigint; -- +30 (unsafe)
-- Total: 55 points → 0.55 MRI
```

### TCI - Test Confidence Index

**Weighted formula**:
- Structure tests: 20%
- Constraint tests: 45% (weighted by field importance)
- Migration tests: 25%
- Performance tests: 10%
- Bundle sub-metrics:
  - **unitConstraints** – weighted structure/constraint coverage (with depth detail)
  - **rls** – RLS policy verification for tables annotated with `@wes_rls`
  - **integrationRelations** – behaviour/computed/relationship checks
  - **e2eOps** – migration steps exercised by pgTAP suites

Example:
```
Structure:    15/15 tables tested = 100% × 0.20 = 0.20
Constraints:  23/25 tested = 92% × 0.45 = 0.41
Migrations:   8/10 tested = 80% × 0.25 = 0.20
Performance:  1/5 indexes = 20% × 0.10 = 0.02
TCI = 0.83 (83%)
```

## The Truth Bundle

Every `wesley generate` creates a `.wesley-cache/` bundle:

```
.wesley-cache/
├── schema.ast.json       # Normalized AST (sorted)
├── schema.ir.json        # Wesley domain IR
├── artifacts.json        # {artifact: [files]} with hashes
├── evidence-map.json     # Element → file:lines@sha
├── snapshot.json         # Previous IR for diffs
├── scores.json          # SCS/MRI/TCI scores + breakdowns
└── history.json         # Score history for predictions
```

Bundles include `"bundleVersion": "2.0.0"` to let downstream consumers branch on schema changes without guessing.

## CI Integration Notes for Moriarty

Moriarty can leverage the PR’s actual git graph to better infer active work on a branch, preventing false “plateau” warnings when SCS hasn’t ticked yet:

- Ensure checkout is unshallowed and remote branches are fetched:
  - Use `actions/checkout@v4` with `fetch-depth: 0`.
  - Optionally run `git fetch --prune --unshallow --tags` and fetch refs under `refs/remotes/origin/*`.
- Provide the base branch (typically `github.base_ref`) as `MORIARTY_BASE_REF`.
- Optional environment tuning:
  - `MORIARTY_GIT_WINDOW_HOURS`: 24 (fallback activity window)
  - `MORIARTY_ACTIVITY_THRESHOLD`: 0.35 (suppress plateau if activity above this)
  - `MORIARTY_ACTIVITY_COMMITS_PER_DAY`: 6
  - `MORIARTY_ACTIVITY_RELEVANT_PER_DAY`: 4

Moriarty blends signals as follows:

- `activityIndex = 0.6 × PRActivity + 0.4 × WindowActivity` (each normalized 0–1)
- Blended velocity = `0.7 × SCSRecentVelocity + 0.3 × activityIndex × 0.02`
- Plateau triggers only when blended velocity is below 1%/day AND the activity index is below threshold.

This keeps the predictor conservative: activity doesn’t “buy” readiness, it only prevents premature “stalled” judgments in active branches.

## Package Architecture

Wesley and HOLMES are separate packages:

```
@wesley/core        # Pure domain logic, zero dependencies
@wesley/host-node   # Platform adapters (fs, graphql parser)
@wesley/cli         # Main CLI for generation
@wesley/holmes      # Sidecar intelligence package
```

## Commands

### Wesley (Main Generator)
```bash
# Generate with evidence tracking
wesley generate --schema schema.graphql --emit-bundle

# Run tests
wesley test
```

### HOLMES (Sidecar Intelligence)
```bash
# Install separately
npm install -g @wesley/holmes

# Run investigation
holmes investigate

# Emit machine-readable JSON alongside markdown
holmes investigate --json holmes-report.json > holmes-report.md

# WATSON verification
holmes verify --json watson-report.json > watson-report.md

# MORIARTY predictions
holmes predict --json moriarty-report.json > moriarty-report.md

# Combined report
holmes report --json holmes-suite.json > holmes-suite.md

# All commands accept --json <path> to persist structured output
```

The JSON documents contain the same information rendered in the markdown (investigation metadata, evidence tables, verification stats, velocity analysis, etc.) and are ideal for downstream automation.

## CI/CD Integration

```yaml
name: Wesley + SHA-lock HOLMES

on: [push, pull_request]

jobs:
  wesley-generate:
    steps:
      - run: wesley generate --schema schema.graphql --emit-bundle
      
  holmes-investigate:
    needs: wesley-generate
    steps:
      - uses: ./.github/actions/holmes-setup
      - run: |
          holmes investigate \
            --json holmes-report.json > holmes-report.md
      - uses: actions/upload-artifact@v4
        with:
          name: holmes-report
          path: |
            holmes-report.md
            holmes-report.json

  watson-verify:
    needs: holmes-investigate
    steps:
      - uses: ./.github/actions/holmes-setup
      - run: |
          holmes verify \
            --json watson-report.json > watson-report.md
      - uses: actions/upload-artifact@v4
        with:
          name: watson-report
          path: |
            watson-report.md
            watson-report.json

  moriarty-predict:
    needs: watson-verify
    steps:
      - uses: ./.github/actions/holmes-setup
      - run: |
          holmes predict \
            --json moriarty-report.json > moriarty-report.md
      - uses: actions/upload-artifact@v4
        with:
          name: moriarty-report
          path: |
            moriarty-report.md
            moriarty-report.json

  comment-reports:
    needs: [holmes-investigate, watson-verify, moriarty-predict]
    steps:
      - uses: actions/download-artifact@v4
        with:
          merge-multiple: true
          path: reports
      - name: Post summary comment
        run: node .github/scripts/holmes-comment.mjs # combines markdown sections
```

## Report Validation & Dashboard

- **End-to-end integration test** – `test/holmes-e2e.bats` runs the full suite (`wesley generate --emit-bundle` → `holmes investigate/verify/predict`) and asserts that both Markdown and JSON artifacts exist with the expected keys (SCS/TCI/MRI, verdicts, velocity metrics). The test fails loudly if any file is missing, so HOLMES regressions surface immediately during local Bats runs or in the CLI workflows.
- **JSON schema validation** – `@wesley/holmes` ships lightweight runtime schemas (`packages/wesley-holmes/src/report-schemas.mjs`) with targeted node tests. The CLI validates each report against the schema before emitting JSON, which prevents malformed artifacts from leaking into CI.
- **Static dashboard artifact** – The HOLMES workflow now assembles a `holmes-dashboard` artifact containing `docs/holmes-dashboard/index.html` plus the suite JSON. Open the HTML locally (or host via GitHub Pages) to visualize recent SCS/TCI/MRI history, MORIARTY velocity/ETA, and verdict summaries without needing additional tooling.

The GitHub comment highlights the markdown narratives and links directly to the JSON artifacts so other workflows (or local tooling) can consume structured results without scraping text.

## Machine-Readable Reports

- `holmes-report.json` – investigation summary, weighted evidence table, gate results, verdict metadata
- `watson-report.json` – citation verification counts, recalculated SCS, inconsistencies, opinion verdict
- `moriarty-report.json` – latest score snapshot, blended velocity, optional ETA windows, detected patterns, recent history

These files live under the HOLMES workflow artifacts (flat files, no subdirectories) and mirror the markdown comment content. The combined `holmes report --json holmes-suite.json` command is convenient for local dashboards.

## History Hydration & Caching

- Each `wesley generate --emit-bundle` appends a point to `.wesley-cache/history.json` (day, timestamp, SCS/TCI/MRI, and evidence-trust metadata when citation quality is known).
- When MORIARTY runs in CI, the CLI merges local history, the merge-base snapshot (`git show <merge-base>:.wesley-cache/history.json`), and a GitHub Actions cache keyed by commit SHA (with branch/base fallbacks). This gives predictions continuity across branch reruns.

## Customising Weighting

HOLMES now loads weights from `wesley.weights.json`. Use the following structure (all numeric weights):

```json
{
  "default": 5,
  "substrings": {
    "password": 12,
    "ssn": 11
  },
  "directives": {
    "sensitive": 10,
    "critical": 9
  },
  "overrides": {
    "col:User.email": 8,
    "tbl:Orders.*": 7
  }
}
```

Precedence: **overrides → directives → substrings → default**. Keys in `overrides` can target exact UIDs (`col:User.email`) or wildcard suffixes (`tbl:Orders.*`). Directive keys omit the leading `@` (`"sensitive": 10`) and honour the same aliases Wesley already supports (e.g. `pk`, `primaryKey`, or `@primaryKey` all map to the same entry).

Environment overrides still work when needed:

| Variable | Purpose |
|----------|---------|
| `WESLEY_HOLMES_WEIGHTS` | JSON string override (highest priority) |
| `WESLEY_HOLMES_WEIGHT_FILE` | Path override for the config file |

Run `holmes weights:validate [--file path]` to lint configuration files locally. The HOLMES report now states which source supplied the weights and the reason behind each element’s weight.

## Security Gates

Wesley + HOLMES enforces security automatically:

### Sensitive Field Gate
```graphql
password: String! @sensitive
```
❌ **BLOCKS** if no hash constraint in SQL:
```sql
-- Required constraint
CHECK (char_length(password_hash) = 60)  -- bcrypt
```

### PII Field Gate
```graphql
email: String! @pii
```
⚠️ **WARNS** if no RLS masking policy

### RLS Coverage Gate
```graphql
type Post @table @rls
```
❌ **BLOCKS** if RLS enabled but policies missing for used operations

## Example Investigation Output

```markdown
## 🔍 SHA-lock HOLMES Investigation

**Weighted Completion**: ████████░░ 84% (156/185 weighted points)
**Verification Status**: 47/47 claims independently verified
**Ship Verdict**: ELEMENTARY

| Feature | Weight | Source | Status | Evidence | Deduction |
|---------|--------|--------|--------|----------|-----------|
| User.password | 12 | Override col:User.password | ✅ | `schema.sql:45@abc123d` | "Properly hashed!" |
| User.email | 8 | Substring email | ✅ | `schema.sql:42@abc123d` | "Unique as required" |
| Post.content | 5 | Default | ⚠️ | Missing Zod validation | "Minor oversight" |
| User.theme | 2 | Substring theme | ✅ | `types.ts:8@abc123d` | "Low priority complete" |

## 📊 Scores

- **SCS**: 0.84 (84%) ✅ Threshold: 80%
- **MRI**: 0.23 (23%) ✅ Threshold: ≤40%
- **TCI**: 0.71 (71%) ✅ Threshold: 70%

## 🔮 Prediction

Based on velocity of 3.2%/day:
- **ETA**: 5 days (March 25, 2024)
- **Confidence**: 87%
```

## Benefits

1. **Weighted Priorities**: Critical fields matter more than cosmetic ones
2. **SHA-Locked Evidence**: Every citation tied to commit SHA
3. **Independent Verification**: WATSON double-checks HOLMES
4. **Risk Assessment**: Know migration danger before production
5. **Predictive ETAs**: Data-driven completion estimates
6. **Automatic Security**: Sensitive fields enforced

## The Revolution Continues

Wesley generates the code. HOLMES proves it's correct. WATSON verifies independently. MORIARTY predicts readiness.

**One schema. Complete intelligence.**
