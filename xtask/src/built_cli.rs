//! Builds the `wesley` binary and reports where Cargo put it.
//!
//! The path is not guessable. `CARGO_TARGET_DIR`, `CARGO_BUILD_TARGET_DIR` and
//! `build.target-dir` move the target directory; `CARGO_BUILD_TARGET` and
//! `build.target` add a `<triple>/` level that `cargo metadata` does not report;
//! Windows adds a suffix. Guessing wrong means running a stale binary, or none.
//! So the build is asked: with `--message-format=json` Cargo prints the
//! `executable` of every artifact it produced.

use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::{command_label, Error, EXIT_FAILURE};

const BUILD_ARGS: [&str; 5] = [
    "build",
    "--quiet",
    "--bin",
    "wesley",
    "--message-format=json-render-diagnostics",
];

/// Whether the build writes its `xtask: <command>` line to stdout.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Stdout {
    /// Print the command, as every other xtask step does.
    Announce,
    /// Print nothing: the caller's stdout is a path or a JSON report.
    Silent,
}

/// Builds the CLI and returns the executable Cargo says it produced.
pub(crate) fn build_wesley(stdout: Stdout) -> Result<PathBuf, Error> {
    let label = command_label("cargo", &BUILD_ARGS);
    if stdout == Stdout::Announce {
        println!("xtask: {label}");
    }
    let output = Command::new("cargo")
        .args(BUILD_ARGS)
        .stderr(Stdio::inherit())
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(i32::from(EXIT_FAILURE)),
        });
    }
    executable_from_build_messages(&output.stdout)
}

/// `cargo xtask built-cli`: builds the CLI and prints its path and nothing else,
/// so that shell callers such as the bats suites ask the same question.
pub(crate) fn print_path() -> Result<(), Error> {
    println!("{}", build_wesley(Stdout::Silent)?.display());
    Ok(())
}

/// The `executable` of the `wesley` binary among Cargo's build messages.
fn executable_from_build_messages(stdout: &[u8]) -> Result<PathBuf, Error> {
    // Checked access throughout: a message without one of these fields is some
    // other kind of message, not an error and not a reason to index blindly.
    let text = |message: &serde_json::Value, pointer: &str| {
        message
            .pointer(pointer)
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
    };
    String::from_utf8_lossy(stdout)
        .lines()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .filter(|message| text(message, "/reason").as_deref() == Some("compiler-artifact"))
        .filter(|message| text(message, "/target/name").as_deref() == Some("wesley"))
        .filter_map(|message| text(&message, "/executable").map(PathBuf::from))
        .next_back()
        .ok_or_else(|| Error::Usage("`cargo build` reported no `wesley` executable".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Oracle: specified. These are the message shapes `cargo build
    // --message-format=json` prints; the library artifact has no executable.
    const LIBRARY: &str = r#"{"reason":"compiler-artifact","target":{"kind":["lib"],"name":"wesley_core"},"executable":null}"#;
    const OTHER_BINARY: &str = r#"{"reason":"compiler-artifact","target":{"kind":["bin"],"name":"xtask"},"executable":"/build/debug/xtask"}"#;
    const FINISHED: &str = r#"{"reason":"build-finished","success":true}"#;

    #[test]
    fn the_executable_cargo_reports_is_used_even_under_a_target_triple() {
        let wesley = r#"{"reason":"compiler-artifact","target":{"kind":["bin"],"name":"wesley"},"executable":"/build/aarch64-apple-darwin/debug/wesley"}"#;
        let stdout = [LIBRARY, OTHER_BINARY, wesley, FINISHED].join("\n");

        assert_eq!(
            executable_from_build_messages(stdout.as_bytes()).ok(),
            Some(PathBuf::from("/build/aarch64-apple-darwin/debug/wesley"))
        );
    }

    #[test]
    fn build_output_that_names_no_wesley_executable_is_refused() {
        let wesley_library = r#"{"reason":"compiler-artifact","target":{"kind":["lib"],"name":"wesley"},"executable":null}"#;
        for stdout in [
            [LIBRARY, OTHER_BINARY, FINISHED].join("\n"),
            wesley_library.to_string(),
            "not json".to_string(),
            String::new(),
        ] {
            // The whole error, not only its variant: a refusal for some other
            // reason would be a different defect and must not pass here.
            let refusal = executable_from_build_messages(stdout.as_bytes());
            assert!(
                matches!(
                    &refusal,
                    Err(Error::Usage(message))
                        if message == "`cargo build` reported no `wesley` executable"
                ),
                "for {stdout:?} got {refusal:?}"
            );
        }
    }
}
