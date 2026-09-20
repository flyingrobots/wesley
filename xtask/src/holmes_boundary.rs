//! `cargo xtask holmes-domain-check`: holds the Holmes domain's purity boundary.
//!
//! `wesley-holmes-domain` is `no_std`, so `std::fs`, `std::net`, `std::process`,
//! `std::env` and the clocks are not in scope for it. On a host build an
//! `extern crate std;` would bring them back. Building the crate for a target
//! that has no `std` at all rejects that line, and anything else that needs
//! `std`, in every configuration that target compiles.
//!
//! What this does not catch, and nothing on stable Rust can: code gated to the
//! host alone, such as `#[cfg(not(target_os = "none"))] extern crate std;`. The
//! bare-metal build omits it, and the host has a `std` for it to find. That is
//! not drift; it is someone going around the boundary on purpose, and it shows
//! in review as a second `extern crate` in a crate that should have one. The
//! same holds for a new dependency that does I/O.

use std::env;
use std::process::Command;

use crate::{run_command, Error};

/// A bare-metal target: it has `core` and `alloc`, and no `std`.
const TARGET_WITHOUT_STD: &str = "thumbv7em-none-eabihf";

pub(crate) fn run() -> Result<(), Error> {
    if !target_is_installed() {
        let how = format!("rustup target add {TARGET_WITHOUT_STD}");
        // In CI a skipped check is a failure. `CI=true` only, as the hooks read it.
        if env::var("CI").as_deref() == Ok("true") {
            return Err(Error::Usage(format!(
                "the `{TARGET_WITHOUT_STD}` target is not installed, so the Holmes domain boundary was not checked; run `{how}`"
            )));
        }
        eprintln!(
            "xtask: the Holmes domain boundary was NOT checked here: `{TARGET_WITHOUT_STD}` is not installed (`{how}`)"
        );
        return Ok(());
    }
    run_command(
        "cargo",
        &[
            "check",
            "--quiet",
            "--package",
            "wesley-holmes-domain",
            "--target",
            TARGET_WITHOUT_STD,
        ],
    )
}

/// Whether rustup reports the bare-metal target. No rustup counts as not installed.
fn target_is_installed() -> bool {
    Command::new("rustup")
        .args(["target", "list", "--installed"])
        .output()
        .is_ok_and(|output| {
            output.status.success()
                && lists_target(&String::from_utf8_lossy(&output.stdout), TARGET_WITHOUT_STD)
        })
}

/// Whether `rustup target list --installed` names `target` on a line of its own.
fn lists_target(installed: &str, target: &str) -> bool {
    installed.lines().any(|line| line.trim() == target)
}

#[cfg(test)]
mod tests {
    use super::lists_target;

    // Oracle: specified. One target per line is what rustup prints.
    const INSTALLED: &str = "aarch64-apple-darwin\nthumbv7em-none-eabihf\nwasm32-unknown-unknown\n";

    #[test]
    fn a_target_rustup_lists_is_installed() {
        assert!(lists_target(INSTALLED, "thumbv7em-none-eabihf"));
    }

    #[test]
    fn a_target_that_is_only_a_prefix_of_a_listed_one_is_not_installed() {
        assert!(!lists_target(INSTALLED, "thumbv7em-none-eabi"));
        assert!(!lists_target(INSTALLED, "wasm32"));
        assert!(!lists_target("", "thumbv7em-none-eabihf"));
    }
}
