---
title: Reference Links
---

# Reference Links

- Project README: https://github.com/flyingrobots/wesley/blob/main/README.md
- CLI Reference: https://github.com/flyingrobots/wesley/blob/main/docs/reference/cli.md
- Directive Truth Table: https://github.com/flyingrobots/wesley/blob/main/docs/reference/directives.md
- Project Manifest: https://github.com/flyingrobots/wesley/blob/main/docs/reference/project-manifest.md
- BEARING: https://github.com/flyingrobots/wesley/blob/main/docs/BEARING.md
- VISION: https://github.com/flyingrobots/wesley/blob/main/docs/VISION.md
- METHOD Process: https://github.com/flyingrobots/wesley/blob/main/docs/method/process.md
- Delivery Lifecycle: https://github.com/flyingrobots/wesley/blob/main/docs/architecture/lifecycle.md
- HOLMES Architecture: https://github.com/flyingrobots/wesley/blob/main/docs/architecture/holmes-architecture.md
- Direction Map: https://github.com/flyingrobots/wesley/blob/main/docs/site/roadmap.md
- Contribution Guide: https://github.com/flyingrobots/wesley/blob/main/CONTRIBUTING.md
- SECURITY Policy: https://github.com/flyingrobots/wesley/blob/main/SECURITY.md
- Labels taxonomy: https://github.com/flyingrobots/wesley/blob/main/docs/governance/labels.md

## Project Manifest Starter

Use `wesley.config.json` for the current JSON manifest path. The manifest names
GraphQL schema inputs and generic evidence/output locations; it does not define
database behavior, runtime policy, or downstream target semantics.

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"]
}
```

Validate the manifest with the native CLI:

```bash
wesley config validate --config wesley.config.json --json
```

For YAML and multi-schema examples, see the
[Project Manifest](https://github.com/flyingrobots/wesley/blob/main/docs/reference/project-manifest.md)
reference.
