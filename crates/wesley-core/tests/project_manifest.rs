use wesley_core::{load_project_manifest, select_changed_schema_paths};

#[test]
fn project_manifest_loads_json_and_normalizes_defaults() {
    let manifest = load_project_manifest(
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": [
            { "id": "core", "path": "schemas/core/schema.graphql" },
            "schemas/audit/schema.graphql"
          ],
          "targets": [
            {
              "name": "rust-models",
              "module": "wesley.emit.rust",
              "exclusiveGroup": "model-emitter",
              "default": true
            }
          ]
        }
        "#,
    )
    .expect("manifest should load");

    assert_eq!(manifest.api_version, "wesley.project-manifest/v1");
    assert_eq!(manifest.bundle_dir, ".wesley-cache");
    assert_eq!(manifest.comment_mode.as_str(), "update");
    assert_eq!(manifest.resolved_schema_paths()[0].id, "core");
    assert_eq!(
        manifest.resolved_schema_paths()[1].id,
        "schemas-audit-schema-graphql"
    );
    assert_eq!(manifest.targets[0].name, "rust-models");
}

#[test]
fn project_manifest_loads_yaml() {
    let manifest = load_project_manifest(
        r#"
apiVersion: wesley.project-manifest/v1
bundleDir: .wesley-cache/platform
commentMode: append
schemaPaths:
  - id: core
    path: schemas/core/schema.graphql
    rebuildOnGlobs:
      - schemas/core/**
dashboard:
  enabled: true
  artifactPath: .wesley-cache/platform/dashboard
"#,
    )
    .expect("YAML manifest should load");

    assert_eq!(manifest.bundle_dir, ".wesley-cache/platform");
    assert_eq!(manifest.comment_mode.as_str(), "append");
    assert!(manifest.dashboard.enabled);
    assert_eq!(
        manifest.dashboard.artifact_path.as_deref(),
        Some(".wesley-cache/platform/dashboard")
    );
}

#[test]
fn project_manifest_rejects_mutually_exclusive_targets() {
    let error = load_project_manifest(
        r#"
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"],
  "targets": [
    { "name": "rust", "exclusiveGroup": "model-emitter" },
    { "name": "typescript", "exclusiveGroup": "model-emitter" }
  ]
}
"#,
    )
    .expect_err("conflicting targets should fail validation");

    assert!(error
        .to_string()
        .contains("exclusive group 'model-emitter' selects multiple targets"));
}

#[test]
fn changed_schema_selection_uses_schema_and_global_globs() {
    let manifest = load_project_manifest(
        r#"
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    {
      "id": "core",
      "path": "schemas/core/schema.graphql",
      "rebuildOnGlobs": ["schemas/core/**", "shared/core.graphql"]
    },
    {
      "id": "audit",
      "path": "schemas/audit/schema.graphql",
      "rebuildOnGlobs": ["schemas/audit/**"]
    }
  ],
  "bundleDir": ".wesley-cache/platform",
  "rebuildOnGlobs": ["wesley.config.json"]
}
"#,
    )
    .expect("manifest should load");

    let selected = select_changed_schema_paths(&manifest, ["schemas/core/types.graphql"]);
    assert_eq!(selected.len(), 1);
    assert_eq!(selected[0].id, "core");
    assert_eq!(selected[0].bundle_dir, ".wesley-cache/platform/core");
    assert_eq!(
        selected[0].reason,
        "matched schema rebuild glob `schemas/core/**`"
    );

    let selected = select_changed_schema_paths(&manifest, ["wesley.config.json"]);
    assert_eq!(selected.len(), 2);
    assert_eq!(selected[0].bundle_dir, ".wesley-cache/platform/core");
    assert_eq!(selected[1].bundle_dir, ".wesley-cache/platform/audit");
    assert!(selected
        .iter()
        .all(|schema| schema.reason == "matched global rebuild glob `wesley.config.json`"));

    let selected = select_changed_schema_paths(&manifest, std::iter::empty::<&str>());
    assert_eq!(selected.len(), 2);
    assert!(selected
        .iter()
        .all(|schema| schema.reason == "no changed files provided"));
}

#[test]
fn project_manifest_rejects_schema_ids_that_are_not_path_safe() {
    let error = load_project_manifest(
        r#"
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    { "id": "../bad", "path": "schema.graphql" }
  ]
}
"#,
    )
    .expect_err("path-unsafe ids should fail validation");

    assert!(error
        .to_string()
        .contains("schemaPath id '../bad' must contain only ASCII letters"));
}

#[test]
fn project_manifest_rejects_dot_only_schema_ids() {
    let error = load_project_manifest(
        r#"
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    { "id": "..", "path": "schema.graphql" }
  ]
}
"#,
    )
    .expect_err("dot-only schema ids should fail validation");

    assert!(error
        .to_string()
        .contains("schemaPath id '..' must not be '.', '..', or only dots"));
}

#[test]
fn project_manifest_rejects_unknown_schema_path_fields() {
    let error = load_project_manifest(
        r#"
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    {
      "id": "core",
      "path": "schema.graphql",
      "domain": "not-wesley"
    }
  ]
}
"#,
    )
    .expect_err("unknown schemaPath fields should fail validation");

    let message = error.to_string();
    assert!(
        message.contains("did not match any variant of untagged enum SchemaPathConfig"),
        "{message}"
    );
}
