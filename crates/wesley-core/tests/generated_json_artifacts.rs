use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;
use sha2::{Digest, Sha256};

use wesley_core::{compute_registry_hash, list_schema_operations_sdl, lower_schema_sdl};

const JSON_SCHEMA_DRAFT_07: &str = "http://json-schema.org/draft-07/schema#";
const JSON_SCHEMA_DRAFT_2020_12: &str = "https://json-schema.org/draft/2020-12/schema";

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

fn read_bytes(path: &str) -> Vec<u8> {
    fs::read(repo_path(path)).expect("fixture should be readable")
}

fn sha256_prefixed(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn schema_json(path: &str) -> serde_json::Value {
    let mut schema = read_json(path);
    inline_local_schema_refs(&mut schema);
    schema
}

fn schema_file_paths() -> Vec<PathBuf> {
    let mut paths = fs::read_dir(repo_path("schemas"))
        .expect("schema directory should be readable")
        .map(|entry| entry.expect("schema entry should be readable").path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".schema.json"))
        })
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn repo_relative_path(path: &Path) -> String {
    path.strip_prefix(repo_path(""))
        .expect("path should live under repo")
        .to_string_lossy()
        .replace('\\', "/")
}

fn schema_draft(schema_path: &str, schema: &serde_json::Value) -> String {
    schema
        .get("$schema")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_else(|| panic!("{schema_path} must declare $schema"))
        .to_string()
}

fn collect_refs(value: &serde_json::Value, refs: &mut Vec<String>) {
    match value {
        serde_json::Value::Object(object) => {
            if let Some(serde_json::Value::String(reference)) = object.get("$ref") {
                refs.push(reference.clone());
            }
            for child in object.values() {
                collect_refs(child, refs);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                collect_refs(child, refs);
            }
        }
        serde_json::Value::Null
        | serde_json::Value::Bool(_)
        | serde_json::Value::Number(_)
        | serde_json::Value::String(_) => {}
    }
}

fn local_schema_reference_target(reference: &str) -> Option<String> {
    if reference.starts_with('#') {
        return None;
    }

    let path = reference
        .split_once('#')
        .map_or(reference, |(path, _fragment)| path);
    if path.is_empty() {
        return None;
    }

    assert!(
        !path.contains("://"),
        "schema $ref must not use remote schemas: {reference}"
    );
    assert!(
        path.ends_with(".schema.json"),
        "schema $ref must target a local schema file: {reference}"
    );

    Some(format!("schemas/{path}"))
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

#[test]
fn schema_family_declares_supported_draft_boundary() {
    let readme = read_text("schemas/README.md");
    assert!(
        readme.contains("## JSON Schema Draft Policy"),
        "schemas/README.md must document the supported draft boundary"
    );

    let mut drafts = BTreeMap::new();
    for schema_path in schema_file_paths() {
        let repo_path = repo_relative_path(&schema_path);
        let schema = read_json(&repo_path);
        let draft = schema_draft(&repo_path, &schema);
        assert!(
            matches!(
                draft.as_str(),
                JSON_SCHEMA_DRAFT_07 | JSON_SCHEMA_DRAFT_2020_12
            ),
            "{repo_path} uses unsupported JSON Schema draft {draft}"
        );
        drafts.insert(repo_path, draft);
    }

    for (schema_path, source_draft) in &drafts {
        let schema = read_json(schema_path);
        let mut refs = Vec::new();
        collect_refs(&schema, &mut refs);
        for reference in refs {
            let Some(target_path) = local_schema_reference_target(&reference) else {
                continue;
            };
            let Some(target_draft) = drafts.get(&target_path) else {
                panic!("{schema_path} references missing local schema {reference}");
            };
            assert_eq!(
                source_draft, target_draft,
                "{schema_path} must not $ref {target_path} across JSON Schema drafts"
            );
        }
    }
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

#[test]
fn hello_external_target_fixture_satisfies_protocol_schemas() {
    let fixture = "test/fixtures/external-targets/hello-wesley-target";
    let descriptor = read_json(&format!("{fixture}/target-descriptor.json"));
    assert_schema_valid(
        "schemas/wesley-target-descriptor-v1.schema.json",
        "hello target descriptor fixture",
        &descriptor,
    );

    let schema_sdl = read_text(&format!("{fixture}/schema.graphql"));
    let ir = lower_schema_sdl(&schema_sdl).expect("hello schema should lower");
    let ir_json = serde_json::to_value(&ir).expect("hello IR should serialize");
    let operations =
        list_schema_operations_sdl(&schema_sdl).expect("hello schema operations should list");
    let operations_json =
        serde_json::to_value(&operations).expect("hello operations should serialize");
    let schema_hash = format!(
        "sha256:{}",
        compute_registry_hash(&ir).expect("hello schema hash should compute")
    );

    let request = read_json(&format!("{fixture}/request.json"));
    assert_schema_valid(
        "schemas/wesley-target-request-v1.schema.json",
        "hello target request fixture",
        &request,
    );
    assert_eq!(request.pointer("/schema/hash"), Some(&json!(schema_hash)));
    assert_eq!(request.pointer("/ir/json"), Some(&ir_json));
    assert_eq!(request.pointer("/operations/items"), Some(&operations_json));
    assert_eq!(request.pointer("/target/name"), descriptor.pointer("/name"));
    assert_eq!(
        request.pointer("/target/outputDir"),
        descriptor.pointer("/outputs/defaultOutDir")
    );

    let diagnostic = read_json(&format!("{fixture}/diagnostic.json"));
    assert_schema_valid(
        "schemas/wesley-target-diagnostic-v1.schema.json",
        "hello target diagnostic fixture",
        &diagnostic,
    );

    let artifact_manifest = read_json(&format!("{fixture}/artifact-manifest.json"));
    assert_schema_valid(
        "schemas/wesley-target-artifact-manifest-v1.schema.json",
        "hello target artifact manifest fixture",
        &artifact_manifest,
    );

    let artifact_path = artifact_manifest
        .pointer("/items/0/path")
        .and_then(serde_json::Value::as_str)
        .expect("hello artifact path should be present");
    let artifact_bytes = read_bytes(&format!("{fixture}/artifacts/{artifact_path}"));
    assert_eq!(
        artifact_manifest.pointer("/items/0/sha256"),
        Some(&json!(sha256_prefixed(&artifact_bytes)))
    );

    let response = read_json(&format!("{fixture}/response.json"));
    assert_schema_valid(
        "schemas/wesley-target-response-v1.schema.json",
        "hello target response fixture",
        &response,
    );
    assert_eq!(
        response.pointer("/requestId"),
        request.pointer("/requestId")
    );
    assert_eq!(response.pointer("/diagnostics/0"), Some(&diagnostic));
    assert_eq!(response.pointer("/artifacts"), Some(&artifact_manifest));
}
