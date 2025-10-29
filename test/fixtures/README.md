# Test Fixtures

Fixtures live here so tests, docs, and demos all reference the same canonical inputs. Each subdirectory has its own README with specifics.

## Directory Overview

| Directory | Purpose | Consumed By |
| --- | --- | --- |
| `examples/` | Canonical GraphQL schemas plus generated outputs for docs and HOLMES tests. | CLI bats (`holmes-e2e.bats`), documentation snippets. |
| `blade/` | Daywalker Deploys demo assets (schemas, run script, signing key instructions). | Docs walkthrough, manual CLI demos. |
| `postgres/` | SQL scripts executed by CI Postgres services to install extensions. | `.github/workflows/ci.yml` and docker-compose setups. |
| `reference/` | Comprehensive SDL showcasing most directives; useful for experiments. | Manual runs, future regression suites. |
| `rls-schema.graphql` | Focused schema exercising RLS directives. | `cli-e2e.bats`, `cli-e2e-real.bats`. |

Always treat fixtures as immutable inputs. If you need to regenerate outputs, do so in a temporary workspace and update the fixture intentionally with accompanying tests/docs.
