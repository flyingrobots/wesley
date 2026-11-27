//! Project-manifest discovery: which files `wesley` finds when `--schema` and
//! `--config` are omitted.

use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn schema_commands_discover_single_schema_manifest_when_schema_flag_is_omitted() {
    let dir = temp_dir("config-discovery");
    std::fs::create_dir_all(dir.join("schema")).expect("schema dir should create");
    std::fs::write(
        dir.join("schema/schema.graphql"),
        "type Query { health: Boolean }\n",
    )
    .expect("schema should write");
    std::fs::write(
        dir.join("wesley.config.json"),
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": ["schema/schema.graphql"]
        }
        "#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["schema", "hash", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert!(report["schemaHash"].as_str().unwrap().len() == 64);
}

#[test]
fn schema_commands_discover_manifest_inside_dot_wesley() {
    // `pnpm clean` keeps `.wesley/config.json` because this discovery accepts it.
    let dir = temp_dir("dot-wesley-config-discovery");
    std::fs::create_dir_all(dir.join(".wesley")).expect(".wesley dir should create");
    std::fs::create_dir_all(dir.join("schema")).expect("schema dir should create");
    std::fs::write(
        dir.join("schema/schema.graphql"),
        "type Query { health: Boolean }\n",
    )
    .expect("schema should write");
    std::fs::write(
        dir.join(".wesley/config.json"),
        r#"
        {
          "apiVersion": "wesley.project-manifest/v1",
          "schemaPaths": ["../schema/schema.graphql"]
        }
        "#,
    )
    .expect("config should write");

    let output = wesley()
        .current_dir(&dir)
        .args(["schema", "hash", "--json"])
        .output()
        .expect("wesley should run");

    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let report: serde_json::Value = serde_json::from_str(&stdout).expect("stdout should be json");
    assert_eq!(report["schemaHash"].as_str().map(str::len), Some(64));
}

fn wesley() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_wesley"));
    // Git hooks export their repository context; fixture directories must be
    // read from their own current directory.
    for variable in [
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_PREFIX",
        "GIT_WORK_TREE",
    ] {
        command.env_remove(variable);
    }
    command
}

fn assert_success(output: &std::process::Output) {
    assert!(
        output.status.success(),
        "expected success, got {:?}\nstdout:\n{}\nstderr:\n{}",
        output.status.code(),
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "wesley-manifest-discovery-{}-{nanos}-{name}",
        std::process::id()
    ));
    std::fs::create_dir_all(&path).expect("temp directory should create");
    path
}
