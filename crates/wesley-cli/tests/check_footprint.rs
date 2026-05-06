use std::fs;
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn exits_zero_for_honest_footprint() {
    let operation = write_operation(
        "honest",
        r#"
        query Honest @wes_footprint(reads: ["viewer", "viewer.id"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args(["check-footprint", "--operation"])
        .arg(&operation)
        .output()
        .expect("wesley should run");

    assert_success(output, "Footprint honest");
}

#[test]
fn exits_non_zero_for_undeclared_selection() {
    let operation = write_operation(
        "dishonest",
        r#"
        query Dishonest @wes_footprint(reads: ["viewer"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args(["check-footprint", "--operation"])
        .arg(&operation)
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("Dishonest footprint"));
    assert!(stdout.contains("- viewer.id"));
}

#[test]
fn emits_json_for_machine_consumers() {
    let operation = write_operation(
        "json",
        r#"
        query JsonCheck @wes_footprint(reads: ["viewer", "viewer.id"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args(["check-footprint", "--operation"])
        .arg(&operation)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let json: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(json["honest"], true);
    assert_eq!(json["undeclaredSelections"], serde_json::json!([]));
    assert_eq!(json["spec"]["actualSelections"][0], "viewer");
}

#[test]
fn uses_schema_coordinates_when_schema_is_provided() {
    let schema = write_document(
        "schema-aware",
        "schema.graphql",
        r#"
        type Query {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
        }
        "#,
    );
    let operation = write_document(
        "schema-aware",
        "operation.graphql",
        r#"
        query SchemaAware @wes_footprint(reads: ["Query.viewer", "Viewer.id"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args(["check-footprint", "--schema"])
        .arg(&schema)
        .args(["--operation"])
        .arg(&operation)
        .arg("--json")
        .output()
        .expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let json: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(json["honest"], true);
    assert_eq!(json["spec"]["actualSelections"][0], "Query.viewer");
    assert_eq!(json["spec"]["actualSelections"][1], "Viewer.id");
}

#[test]
fn exits_non_zero_for_undeclared_schema_coordinate() {
    let schema = write_document(
        "schema-dishonest",
        "schema.graphql",
        r#"
        type Query {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
        }
        "#,
    );
    let operation = write_document(
        "schema-dishonest",
        "operation.graphql",
        r#"
        query SchemaDishonest @wes_footprint(reads: ["Query.viewer"], writes: []) {
          viewer {
            id
          }
        }
        "#,
    );

    let output = wesley()
        .args(["check-footprint", "--schema"])
        .arg(&schema)
        .args(["--operation"])
        .arg(&operation)
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(1));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("- Viewer.id"));
}

#[test]
fn rejects_missing_operation_argument() {
    let output = wesley()
        .arg("check-footprint")
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stderr.contains("--operation is required"));
}

#[test]
fn check_footprint_help_exits_zero() {
    let output = wesley()
        .args(["check-footprint", "--help"])
        .output()
        .expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("wesley check-footprint --operation <path>"));
}

fn wesley() -> Command {
    Command::new(env!("CARGO_BIN_EXE_wesley"))
}

fn write_operation(name: &str, content: &str) -> std::path::PathBuf {
    write_document(name, "operation.graphql", content)
}

fn write_document(name: &str, file_name: &str, content: &str) -> std::path::PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("wesley-cli-test-{name}-{unique}"));
    fs::create_dir_all(&dir).expect("temp dir should be created");
    let path = dir.join(file_name);
    fs::write(&path, content).expect("document should be written");
    path
}

fn assert_success(output: Output, expected_stdout: &str) {
    assert!(
        output.status.success(),
        "expected success, got status {:?}, stdout: {}, stderr: {}",
        output.status.code(),
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains(expected_stdout));
}
