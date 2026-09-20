//! `cargo xtask docs-replay`: replays the CLI sessions the documentation shows
//! against the built binary, and checks the generated CLI reference.

use crate::{built_cli, run_command, Error};

/// The documents whose shell sessions are replayed against the built CLI.
const REPLAYED_DOCUMENTS: [&str; 2] = ["README.md", "docs/getting-started.md"];

/// Builds the CLI, replays the sessions the documentation shows, and checks
/// that the generated CLI reference still matches the binary.
pub(crate) fn run() -> Result<(), Error> {
    let built_cli = built_cli::build_wesley(true)?;
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
