use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;
use yaml_rust2::{Yaml, YamlLoader};

use wesley_core::{
    build_contract_bundle_manifest_v1, compute_registry_hash, diff_law_ir_v1,
    list_schema_operations_sdl, load_weslaw_yaml, lower_schema_sdl, to_canonical_law_ir_json,
};

fn repo_path(path: impl AsRef<Path>) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

fn read_text(path: &str) -> String {
    fs::read_to_string(repo_path(path)).expect("fixture should be readable")
}

fn read_json(path: &str) -> serde_json::Value {
    serde_json::from_str(&read_text(path)).expect("JSON should parse")
}

fn schema_json(path: &str) -> serde_json::Value {
    let mut schema = read_json(path);
    inline_local_schema_refs(&mut schema);
    schema
}

fn inline_local_schema_refs(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(object) => {
            if let Some(serde_json::Value::String(reference)) = object.get("$ref") {
                if let Some(path) = local_schema_ref(reference) {
                    *value = schema_json(path);
                    return;
                }
            }

            for child in object.values_mut() {
                inline_local_schema_refs(child);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                inline_local_schema_refs(child);
            }
        }
        serde_json::Value::Null
        | serde_json::Value::Bool(_)
        | serde_json::Value::Number(_)
        | serde_json::Value::String(_) => {}
    }
}

fn local_schema_ref(reference: &str) -> Option<&'static str> {
    match reference {
        "realm.schema.json#" => Some("schemas/realm.schema.json"),
        "runtime-event.schema.json#" => Some("schemas/runtime-event.schema.json"),
        "runtime-run.schema.json#" => Some("schemas/runtime-run.schema.json"),
        "wesley-target-artifact-manifest-v1.schema.json#" => {
            Some("schemas/wesley-target-artifact-manifest-v1.schema.json")
        }
        "wesley-target-diagnostic-v1.schema.json#" => {
            Some("schemas/wesley-target-diagnostic-v1.schema.json")
        }
        _ => None,
    }
}

fn assert_schema_valid(schema_path: &str, artifact_name: &str, artifact: &serde_json::Value) {
    let schema = schema_json(schema_path);
    let validator = jsonschema::validator_for(&schema).expect("schema should compile");
    let errors = validator
        .iter_errors(artifact)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();

    assert!(
        errors.is_empty(),
        "{artifact_name} failed {schema_path}: {errors:#?}"
    );
}

fn assert_schema_invalid(schema_path: &str, artifact_name: &str, artifact: &serde_json::Value) {
    let schema = schema_json(schema_path);
    let validator = jsonschema::validator_for(&schema).expect("schema should compile");
    let errors = validator.iter_errors(artifact).collect::<Vec<_>>();

    assert!(
        !errors.is_empty(),
        "{artifact_name} unexpectedly satisfied {schema_path}"
    );
}

fn yaml_fixture_to_json(source: &str) -> serde_json::Value {
    let documents = YamlLoader::load_from_str(source).expect("fixture should parse as YAML");
    assert_eq!(
        documents.len(),
        1,
        "fixture should contain one YAML document"
    );
    yaml_to_json_value(&documents[0])
}

fn yaml_to_json_value(value: &Yaml) -> serde_json::Value {
    match value {
        Yaml::Real(text) => {
            serde_json::Number::from_f64(text.parse::<f64>().expect("real should parse"))
                .map(serde_json::Value::Number)
                .expect("real should be finite")
        }
        Yaml::Integer(integer) => serde_json::Value::Number((*integer).into()),
        Yaml::String(text) => serde_json::Value::String(text.clone()),
        Yaml::Boolean(value) => serde_json::Value::Bool(*value),
        Yaml::Array(items) => {
            serde_json::Value::Array(items.iter().map(yaml_to_json_value).collect())
        }
        Yaml::Hash(map) => {
            let object = map
                .iter()
                .map(|(key, value)| {
                    (
                        key.as_str()
                            .expect("fixture object keys should be strings")
                            .to_string(),
                        yaml_to_json_value(value),
                    )
                })
                .collect();
            serde_json::Value::Object(object)
        }
        Yaml::Null => serde_json::Value::Null,
        Yaml::Alias(_) | Yaml::BadValue => panic!("unsupported YAML value in fixture"),
    }
}

fn contract_bundle_shape() -> (
    wesley_core::WesleyIR,
    Vec<wesley_core::SchemaOperation>,
    String,
) {
    let sdl = read_text("test/fixtures/weslaw/contract-bundle-shape.graphql");
    let ir = lower_schema_sdl(&sdl).expect("fixture schema should lower");
    let operations = list_schema_operations_sdl(&sdl).expect("fixture operations should list");
    let schema_hash = format!(
        "sha256:{}",
        compute_registry_hash(&ir).expect("schema hash should compute")
    );

    (ir, operations, schema_hash)
}

#[test]
fn l1_ir_fixtures_satisfy_declared_schema() {
    let fixture_dir = repo_path("test/fixtures/ir-parity");
    let mut fixtures = fs::read_dir(&fixture_dir)
        .expect("IR fixture directory should be readable")
        .map(|entry| entry.expect("fixture entry should be readable").path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".l1.json"))
        })
        .collect::<Vec<_>>();
    fixtures.sort();

    assert!(!fixtures.is_empty(), "expected at least one L1 IR fixture");

    for fixture in fixtures {
        let artifact = serde_json::from_str(
            &fs::read_to_string(&fixture).expect("IR fixture should be readable"),
        )
        .expect("IR fixture should parse");
        assert_schema_valid(
            "schemas/ir.schema.json",
            &fixture
                .strip_prefix(repo_path(""))
                .unwrap_or(&fixture)
                .display()
                .to_string(),
            &artifact,
        );
    }
}

#[test]
fn weslaw_artifact_families_satisfy_declared_schemas() {
    let law_fixture = "test/fixtures/weslaw/accepted/footprint-replace-range.weslaw.yaml";
    let law_source = read_text(law_fixture);
    let authoring_json = yaml_fixture_to_json(&law_source);
    assert_schema_valid(
        "schemas/weslaw-v1.schema.json",
        law_fixture,
        &authoring_json,
    );

    let law_ir = load_weslaw_yaml(&law_source).expect("law fixture should lower");
    let law_ir_json =
        serde_json::from_str(&to_canonical_law_ir_json(&law_ir).expect("Law IR should serialize"))
            .expect("Law IR JSON should parse");
    assert_schema_valid(
        "schemas/wesley-law-ir-v1.schema.json",
        "generated Law IR",
        &law_ir_json,
    );

    let (ir, operations, _) = contract_bundle_shape();
    let manifest = build_contract_bundle_manifest_v1(&law_ir, &ir, &operations)
        .expect("contract bundle manifest should build");
    let manifest_json =
        serde_json::to_value(&manifest).expect("contract bundle manifest should serialize");
    assert_schema_valid(
        "schemas/wesley-contract-bundle-manifest-v1.schema.json",
        "generated contract bundle manifest",
        &manifest_json,
    );

    for fixture in [
        "test/fixtures/weslaw/diff/ci-semantic-diff.json",
        "test/fixtures/weslaw/diff/holmes-blade-binding-broken.json",
    ] {
        assert_schema_valid(
            "schemas/wesley-law-diff-v1.schema.json",
            fixture,
            &read_json(fixture),
        );
    }

    let old_law = load_weslaw_yaml(&read_text("test/fixtures/weslaw/diff/old.weslaw.yaml"))
        .expect("old law should lower");
    let new_law = load_weslaw_yaml(&read_text("test/fixtures/weslaw/diff/new.weslaw.yaml"))
        .expect("new law should lower");
    let generated_diff =
        serde_json::to_value(diff_law_ir_v1(&old_law, &new_law).expect("diff should compute"))
            .expect("diff should serialize");
    assert_schema_valid(
        "schemas/wesley-law-diff-v1.schema.json",
        "generated law diff",
        &generated_diff,
    );
}

#[test]
fn holmes_and_shipme_artifacts_satisfy_declared_schemas() {
    let sha = "abcdef1234567890abcdef1234567890abcdef12";
    let timestamp = "2026-01-01T00:00:00.000Z";
    let scores = json!({
        "version": "2.0.0",
        "commit": sha,
        "timestamp": timestamp,
        "scores": {
            "scs": 0.95,
            "tci": 0.9,
            "mri": 0.1
        },
        "breakdown": {
            "scs": {
                "sql": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
                "types": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
                "validation": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
                "tests": { "score": 1, "earnedWeight": 1, "totalWeight": 1 }
            },
            "tci": {
                "unit_constraints": { "score": 1, "covered": 1, "total": 1 },
                "unit_rls": { "score": 1, "covered": 1, "total": 1 },
                "integration_relations": { "score": 1, "covered": 1, "total": 1 },
                "e2e_ops": { "score": 0.9, "covered": 9, "total": 10 }
            },
            "mri": {
                "drops": { "score": 0, "points": 0, "count": 0 },
                "renames_without_uid": { "score": 0, "points": 0, "count": 0 },
                "add_not_null_without_default": { "score": 0.1, "points": 1, "count": 1 },
                "non_concurrent_indexes": { "score": 0, "points": 0, "count": 0 },
                "totalPoints": 1
            }
        },
        "readiness": {
            "ready": true,
            "verdict": "ELEMENTARY",
            "scs": { "score": 0.95, "threshold": 0.8, "pass": true },
            "tci": { "score": 0.9, "threshold": 0.8, "pass": true },
            "mri": { "score": 0.1, "threshold": 0.2, "pass": true }
        },
        "metadata": {
            "tables": 1,
            "migrationSteps": 1,
            "testsRun": 1
        }
    });
    assert_schema_valid(
        "schemas/scores.schema.json",
        "representative scores.json",
        &scores,
    );

    let evidence_map = json!({
        "version": "1.0.0",
        "commit": sha,
        "timestamp": timestamp,
        "artifacts": {
            "schema.User": {
                "sql": [{ "file": "out/schema.sql", "lines": "1-2", "sha": sha }],
                "tests": [{ "file": "out/tests.sql", "lines": "1-1", "sha": sha }]
            }
        }
    });
    assert_schema_valid(
        "schemas/evidence-map.schema.json",
        "representative evidence map",
        &evidence_map,
    );

    let runtime_run = json!({
        "runId": "run-shipme-cert-fixture",
        "transmutation": "null-generator",
        "streamId": "stream-shipme-cert-fixture",
        "status": "completed",
        "eventCount": 1,
        "artifactCount": 3,
        "taskCounts": {
            "started": 1,
            "completed": 1,
            "failed": 0,
            "skipped": 0
        }
    });
    assert_schema_valid(
        "schemas/runtime-run.schema.json",
        "representative runtime run",
        &runtime_run,
    );

    let runtime_event = json!({
        "eventId": "event-shipme-cert-fixture",
        "type": "artifact.generated",
        "streamId": "stream-shipme-cert-fixture",
        "sequence": 1,
        "schemaVersion": "runtime-event/v1",
        "timestamp": timestamp,
        "correlationId": null,
        "idempotencyKey": "stream-shipme-cert-fixture:artifact.generated:1",
        "runId": "run-shipme-cert-fixture",
        "transmutation": "null-generator",
        "payload": {}
    });
    assert_schema_valid(
        "schemas/runtime-event.schema.json",
        "representative runtime event",
        &runtime_event,
    );

    let realm = json!({
        "transmutation": "null-generator",
        "runId": "run-shipme-cert-fixture",
        "run": runtime_run,
        "events": [runtime_event],
        "provider": "fixture",
        "verdict": "PASS",
        "duration_ms": 1,
        "steps": 1,
        "timestamp": timestamp
    });
    assert_schema_valid(
        "schemas/realm.schema.json",
        "representative realm.json",
        &realm,
    );

    let shipme = json!({
        "sha": sha,
        "timestamp": timestamp,
        "realm": realm,
        "scores": scores,
        "evidence": {
            "totalCitations": 2,
            "exact": 2,
            "wholeFile": 0,
            "coarse": 0,
            "strongestCitation": "exact",
            "trust": "strong",
            "reasons": []
        }
    });
    assert_schema_valid(
        "schemas/shipme.schema.json",
        "representative SHIPME certificate",
        &shipme,
    );
}

#[test]
fn external_target_protocol_artifacts_satisfy_declared_schemas() {
    let artifact_hash = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    let descriptor = json!({
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
    });
    assert_schema_valid(
        "schemas/wesley-target-descriptor-v1.schema.json",
        "representative target descriptor",
        &descriptor,
    );

    let unsafe_descriptor = json!({
        "apiVersion": "wesley.target-descriptor/v1",
        "name": "hello-wesley-target",
        "protocol": {
            "kind": "external-process",
            "version": "wesley.target-process/v1"
        },
        "command": {
            "program": "C:/tools/hello-wesley-target",
            "args": []
        },
        "execution": {
            "timeoutMs": 30000
        },
        "capabilities": {
            "inputs": ["wesley.l1-ir/v1"],
            "outputs": ["wesley.target-artifact-manifest/v1"],
            "requiresNetwork": false,
            "requiresAmbientFilesystem": false
        },
        "outputs": {
            "defaultOutDir": "generated/hello"
        }
    });
    assert_schema_invalid(
        "schemas/wesley-target-descriptor-v1.schema.json",
        "drive-like target descriptor",
        &unsafe_descriptor,
    );

    let dot_only_descriptor = json!({
        "apiVersion": "wesley.target-descriptor/v1",
        "name": "hello-wesley-target",
        "protocol": {
            "kind": "external-process",
            "version": "wesley.target-process/v1"
        },
        "command": {
            "program": "./",
            "args": []
        },
        "execution": {
            "timeoutMs": 30000
        },
        "capabilities": {
            "inputs": ["wesley.l1-ir/v1"],
            "outputs": ["wesley.target-artifact-manifest/v1"],
            "requiresNetwork": false,
            "requiresAmbientFilesystem": false
        },
        "outputs": {
            "defaultOutDir": "."
        }
    });
    assert_schema_invalid(
        "schemas/wesley-target-descriptor-v1.schema.json",
        "dot-only target descriptor paths",
        &dot_only_descriptor,
    );

    let target_request = json!({
        "apiVersion": "wesley.target-request/v1",
        "requestId": "request-hello-0001",
        "workspaceRoot": "/workspace",
        "schema": {
            "id": "app",
            "path": "schema.graphql",
            "hash": artifact_hash
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
            "stagingOutputRoot": "/tmp/wesley-target-runs/request-hello-0001/out"
        }
    });
    assert_schema_valid(
        "schemas/wesley-target-request-v1.schema.json",
        "representative target request",
        &target_request,
    );

    let diagnostic = json!({
        "severity": "error",
        "code": "target.output.path_escape",
        "message": "artifact path escapes the allowed output directory",
        "subject": "generated/../escape.txt"
    });
    assert_schema_valid(
        "schemas/wesley-target-diagnostic-v1.schema.json",
        "representative target diagnostic",
        &diagnostic,
    );

    let artifact_manifest = json!({
        "apiVersion": "wesley.target-artifact-manifest/v1",
        "items": [
            {
                "path": "generated/hello/model.txt",
                "kind": "text",
                "sha256": artifact_hash
            }
        ]
    });
    assert_schema_valid(
        "schemas/wesley-target-artifact-manifest-v1.schema.json",
        "representative target artifact manifest",
        &artifact_manifest,
    );

    let duplicate_artifact_manifest = json!({
        "apiVersion": "wesley.target-artifact-manifest/v1",
        "items": [
            {
                "path": "generated/hello/model.txt",
                "kind": "text",
                "sha256": artifact_hash
            },
            {
                "path": "generated/hello/model.txt",
                "kind": "text",
                "sha256": artifact_hash
            }
        ]
    });
    assert_schema_invalid(
        "schemas/wesley-target-artifact-manifest-v1.schema.json",
        "exact duplicate artifact manifest entries",
        &duplicate_artifact_manifest,
    );

    let duplicate_path_distinct_artifact_manifest = json!({
        "apiVersion": "wesley.target-artifact-manifest/v1",
        "items": [
            {
                "path": "generated/hello/model.txt",
                "kind": "text",
                "sha256": artifact_hash
            },
            {
                "path": "generated/hello/model.txt",
                "kind": "binary",
                "sha256": "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
            }
        ]
    });
    assert_schema_valid(
        "schemas/wesley-target-artifact-manifest-v1.schema.json",
        "duplicate artifact paths with distinct metadata require host validation",
        &duplicate_path_distinct_artifact_manifest,
    );

    let external_target_protocol_reference =
        include_str!("../../../docs/reference/external-target-protocol.md")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
    assert!(
        external_target_protocol_reference.contains("same path with different metadata"),
        "external target protocol docs must spell out duplicate path validation beyond JSON Schema"
    );

    let dot_only_artifact_manifest = json!({
        "apiVersion": "wesley.target-artifact-manifest/v1",
        "items": [
            {
                "path": ".",
                "kind": "text",
                "sha256": artifact_hash
            }
        ]
    });
    assert_schema_invalid(
        "schemas/wesley-target-artifact-manifest-v1.schema.json",
        "dot-only artifact manifest path",
        &dot_only_artifact_manifest,
    );

    let target_response = json!({
        "apiVersion": "wesley.target-response/v1",
        "requestId": "request-hello-0001",
        "status": "ok",
        "diagnostics": [],
        "artifacts": artifact_manifest
    });
    assert_schema_valid(
        "schemas/wesley-target-response-v1.schema.json",
        "representative target response",
        &target_response,
    );
}
