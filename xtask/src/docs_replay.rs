//! `cargo xtask docs-replay`: replays the CLI sessions the documentation shows
//! against the built binary, and checks the generated CLI reference.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::{command_label, run_command, Error, EXIT_FAILURE};

/// The documents whose shell sessions are replayed against the built CLI.
const REPLAYED_DOCUMENTS: [&str; 2] = ["README.md", "docs/getting-started.md"];
/// Builds the CLI, replays the sessions the documentation shows, and checks
/// that the generated CLI reference still matches the binary.
pub(crate) fn run() -> Result<(), Error> {
    run_command("cargo", &["build", "--quiet", "--bin", "wesley"])?;

    // Where Cargo put it. The target directory can be moved by `CARGO_TARGET_DIR`,
    // by `CARGO_BUILD_TARGET_DIR`, or by `build.target-dir` in any Cargo config
    // file, so ask Cargo instead of guessing: a fixed `target/debug/wesley`
    // could be missing, or stale.
    let built_cli = built_wesley_path(&cargo_target_directory()?);
    let built_cli = built_cli.to_string_lossy();

    let mut replay = vec![
        "scripts/run-doc-examples.mjs",
        "--wesley",
        built_cli.as_ref(),
    ];
    replay.extend(REPLAYED_DOCUMENTS);
    run_command("node", &replay)?;

    run_command(
        "node",
        &[
            "scripts/generate-cli-reference.mjs",
            "--wesley",
            built_cli.as_ref(),
            "--check",
        ],
    )
}

/// The target directory Cargo resolved for this workspace.
fn cargo_target_directory() -> Result<PathBuf, Error> {
    let args = ["metadata", "--format-version", "1", "--no-deps"];
    let label = command_label("cargo", &args);
    let output = Command::new("cargo")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(i32::from(EXIT_FAILURE)),
        });
    }
    target_directory_from_metadata(&output.stdout)
}

fn target_directory_from_metadata(metadata: &[u8]) -> Result<PathBuf, Error> {
    let metadata: serde_json::Value = serde_json::from_slice(metadata)
        .map_err(|source| Error::Usage(format!("`cargo metadata` did not print JSON: {source}")))?;
    metadata
        .get("target_directory")
        .and_then(serde_json::Value::as_str)
        .filter(|directory| !directory.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| Error::Usage("`cargo metadata` named no `target_directory`".to_string()))
}

pub(crate) fn built_wesley_path(target_dir: &Path) -> PathBuf {
    target_dir
        .join("debug")
        .join(format!("wesley{}", env::consts::EXE_SUFFIX))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docs_replay_runs_the_binary_in_the_target_directory_cargo_reports() {
        let metadata = br#"{"packages":[],"target_directory":"/elsewhere/build","version":1}"#;
        let target_dir = target_directory_from_metadata(metadata).expect("target directory");

        assert_eq!(
            built_wesley_path(&target_dir),
            PathBuf::from("/elsewhere/build")
                .join("debug")
                .join(format!("wesley{}", env::consts::EXE_SUFFIX))
        );
    }

    #[test]
    fn docs_replay_refuses_cargo_metadata_without_a_target_directory() {
        for metadata in [
            &br#"{"version":1}"#[..],
            br#"{"target_directory":""}"#,
            b"not json",
        ] {
            assert!(
                matches!(
                    target_directory_from_metadata(metadata),
                    Err(Error::Usage(_))
                ),
                "accepted {}",
                String::from_utf8_lossy(metadata)
            );
        }
    }
}
