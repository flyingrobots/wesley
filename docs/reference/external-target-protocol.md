# External Target Protocol MVP

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This page specifies the conservative executable extension boundary for future
Wesley target authors:

```text
Wesley compiler facts -> external process -> artifact manifest and diagnostics
```

Status: protocol MVP specification. The current `v0.2.0` native CLI does not
ship `wesley target verify` or `wesley target run` yet. Until those commands
exist with tests and release evidence, project manifests and fixture descriptors
remain metadata surfaces.

## Goals

- Give third-party target authors one executable protocol to implement.
- Let Wesley validate a target descriptor before executing untrusted code.
- Keep target semantics outside Wesley core.
- Keep all examples generic and domain-empty.

## Non-Goals

- No dynamic JavaScript module loader revival.
- No Postgres, Echo, Continuum, renderer, auth, or runtime semantics in Wesley
  core.
- No network, ambient filesystem, or host-resource access unless a future host
  policy explicitly grants it.
- No `target run` command before descriptor verification, fixtures, and path
  safety rules are implemented.

## Lifecycle

1. A project manifest selects target metadata.
2. A target descriptor declares protocol version, command shape, capabilities,
   output expectations, and host requirements.
3. `wesley target verify <descriptor>` validates the descriptor without running
   target code.
4. A future `wesley target run` lowers the schema, builds a request envelope,
   resolves the descriptor command without `PATH` lookup, starts the external
   process under host-enforced capability restrictions, and passes the request
   over stdin or a temp file.
5. The target writes generated files only under a host-created staging output
   root.
6. The target returns a response envelope with diagnostics and an artifact
   manifest.
7. Wesley validates the response envelope, artifact paths, staged artifact
   bytes, and deterministic manifest before copying staged artifacts into
   accepted workspace output paths.

## Descriptor Envelope

The descriptor is plain JSON. It is safe to validate without execution.

```json
{
  "apiVersion": "wesley.target-descriptor/v1",
  "name": "hello-wesley-target",
  "protocol": {
    "kind": "external-process",
    "version": "wesley.target-process/v1"
  },
  "command": {
    "program": "./bin/hello-wesley-target",
    "args": ["--request-stdin"]
  },
  "execution": {
    "timeoutMs": 30000
  },
  "capabilities": {
    "inputs": ["wesley.l1-ir/v1", "wesley.schema-operations/v1"],
    "outputs": ["wesley.target-artifact-manifest/v1"],
    "requiresNetwork": false,
    "requiresAmbientFilesystem": false
  },
  "outputs": {
    "defaultOutDir": "generated/hello"
  }
}
```

Descriptor rules:

- `apiVersion` must be exactly `wesley.target-descriptor/v1` for this MVP.
- `name` must be stable, non-empty, and path-safe.
- `protocol.kind` must be `external-process`.
- `command.program` must be a descriptor-relative executable path, not a shell
  string, bare program name, or `PATH` lookup. A future package or digest-backed
  binary reference may be added only if it preserves deterministic resolution.
- `command.args` must be argv elements, not a shell command.
- `execution.timeoutMs` must be finite and bounded by the host maximum.
- output directories must be workspace-relative.
- descriptors must not contain product semantics; examples should use names
  like `hello`, `model`, or `artifact`.

## Request Envelope

The request envelope is the only input a target needs from Wesley.

```json
{
  "apiVersion": "wesley.target-request/v1",
  "requestId": "stable-or-random-run-id",
  "workspaceRoot": "/workspace",
  "schema": {
    "id": "app",
    "path": "schema.graphql",
    "hash": "sha256:..."
  },
  "ir": {
    "apiVersion": "wesley.l1-ir/v1",
    "json": {}
  },
  "operations": {
    "apiVersion": "wesley.schema-operations/v1",
    "items": []
  },
  "target": {
    "name": "hello-wesley-target",
    "module": "example.hello",
    "outputDir": "generated/hello"
  },
  "capabilityContext": {
    "network": "denied",
    "ambientFilesystem": "denied",
    "allowedOutputDirs": ["generated/hello"],
    "stagingOutputRoot": "/tmp/wesley-target-runs/request-123/out"
  }
}
```

Request rules:

- `workspaceRoot` is informational; target output paths must still be
  workspace-relative.
- `ir.json` is the lowered Wesley L1 IR object.
- `operations.items` is the schema operation catalog when requested.
- `target` mirrors manifest target metadata after Wesley normalization.
- `capabilityContext` is the host decision; the target must not exceed it.
  Denied capabilities are not advisory: `wesley target run` must enforce them at
  the process boundary before executing target code.
- `stagingOutputRoot` is a host-created private directory. The target writes
  artifacts there, preserving manifest-relative paths; it must not write
  directly into workspace output directories.

## Response Envelope

Targets return one JSON response envelope on stdout. Human logs should go to
stderr.

```json
{
  "apiVersion": "wesley.target-response/v1",
  "requestId": "stable-or-random-run-id",
  "status": "ok",
  "diagnostics": [],
  "artifacts": {
    "apiVersion": "wesley.target-artifact-manifest/v1",
    "items": [
      {
        "path": "generated/hello/model.txt",
        "kind": "text",
        "sha256": "..."
      }
    ]
  }
}
```

Response rules:

- `status` is `ok` or `error`.
- `requestId` must match the request.
- `diagnostics` must be machine-readable.
- artifact paths must be workspace-relative, normalized, and inside allowed
  output directories.
- `sha256` is over the emitted artifact bytes.
- malformed JSON, path escapes, unknown response versions, or missing artifact
  hashes are hard failures.

## Diagnostic Shape

```json
{
  "severity": "error",
  "code": "target.output.path_escape",
  "message": "artifact path escapes the allowed output directory",
  "subject": "generated/../escape.txt"
}
```

Diagnostic rules:

- `severity` is `error`, `warning`, or `info`.
- `code` is stable and dot-separated.
- `message` is for humans.
- `subject` is optional and should be a schema coordinate, target name, or
  artifact path when available.

## Artifact Manifest Shape

```json
{
  "apiVersion": "wesley.target-artifact-manifest/v1",
  "items": [
    {
      "path": "generated/hello/model.txt",
      "kind": "text",
      "sha256": "..."
    }
  ]
}
```

Artifact manifest rules:

- Every artifact must have a path, kind, and hash.
- Paths must be relative and must not contain `..`, Windows drive prefixes, or
  absolute path prefixes.
- Artifact order must be deterministic.
- Repeated paths are invalid.

## Host Enforcement Rules

`wesley target run` must not ship until the host can enforce the protocol
instead of trusting target cooperation:

- resolve `command.program` relative to the descriptor location after descriptor
  validation; do not search `PATH`
- invoke the target without a shell and pass args as argv values
- enforce `network: denied` with a host sandbox or equivalent process
  restriction before target startup
- enforce `ambientFilesystem: denied` by granting the process only the request
  input, the private staging output root, and explicitly allowed host resources
- terminate the target when `execution.timeoutMs` expires and emit a
  deterministic `target.execution.timeout` diagnostic
- discard the staging directory on malformed JSON, non-zero exit, timeout,
  path escape, duplicate artifact path, missing hash, or hash mismatch
- copy staged artifacts into workspace output directories only after every
  response and artifact-manifest rule passes

## Exit And I/O Rules

| Condition                           | Host Behavior                     |
| ----------------------------------- | --------------------------------- |
| Exit code `0` + valid `ok` response | Accept after artifact validation. |
| Exit code `0` + `error` response    | Fail with target diagnostics.     |
| Non-zero exit code                  | Fail and include bounded stderr.  |
| Malformed JSON                      | Fail before artifact acceptance.  |
| Missing response                    | Fail before artifact acceptance.  |
| Timeout                             | Kill target and discard staging.  |
| Path escape                         | Fail before workspace copy-out.   |

Wesley must not invoke targets through a shell. Program and args stay separate
argv values.

## `hello-wesley-target` Template

The first SDK template should contain:

- `schema.graphql`: a minimal GraphQL schema using `User` and `Query`.
- `target-descriptor.json`: the descriptor envelope above.
- `fixtures/request.json`: a request envelope generated from the schema.
- `expected/model.txt`: one deterministic emitted artifact.
- `expected/artifacts.json`: the artifact manifest.
- one conformance test that runs the target process and compares the response
  and artifact bytes.

The template must not mention Postgres, Echo, Continuum, auth, routing,
deployment, or product runtime behavior.

## Required Conformance Fixtures

Before `wesley target run` ships, fixtures should cover:

- valid descriptor verification
- descriptor-relative command resolution
- bare program name rejection
- duplicate target names
- missing required capabilities
- incompatible protocol or ABI version
- host-enforced denied network capability
- host-enforced denied ambient filesystem capability
- target timeout and deterministic timeout diagnostic
- bad exit code
- malformed JSON response
- path escapes
- staging discard on rejected response
- duplicate artifact paths
- output outside allowed directories
- copy-out only after artifact validation
- deterministic output for repeated runs

## Relationship To Current Surfaces

- [Project Manifest](./project-manifest.md) selects target metadata today.
- [Module Authoring Guide](../guides/module-authoring.md) explains the current
  descriptor-only boundary.
- [Extension Modules](../topics/extension-modules.md) routes extension work.
- The Rust capability registry models descriptors and pre-execution policy; it
  does not execute target code yet.
