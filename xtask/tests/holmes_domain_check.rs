//! `cargo xtask holmes-domain-check`, through the binary: its exit status and
//! what it prints, which is the contract the workflows consume.
//!
//! Seams: `PATH` decides which `rustup` and `cargo` the command finds, and `CI`
//! decides whether a check that cannot run is a failure. The stubs are shell
//! scripts, so these tests are Unix only, as CI is.
//!
//! Size: small. Nothing is compiled and nothing outside a scratch directory is
//! touched. Oracle: specified, from the module docs of `holmes_boundary`.
#![cfg(unix)]

use std::error::Error;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const TARGET: &str = "thumbv7em-none-eabihf";

/// A scratch directory to use as the whole of `PATH`.
fn scratch(name: &str) -> Result<PathBuf, Box<dyn Error>> {
    let dir = std::env::temp_dir().join(format!("xtask-holmes-{name}-{}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir)?;
    }
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn stub(dir: &Path, name: &str, script: &str) -> Result<(), Box<dyn Error>> {
    let path = dir.join(name);
    fs::write(&path, format!("#!/bin/sh\n{script}\n"))?;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755))?;
    Ok(())
}

fn run(path: &Path, ci: Option<&str>) -> Result<Output, Box<dyn Error>> {
    let mut command = Command::new(env!("CARGO_BIN_EXE_xtask"));
    command
        .arg("holmes-domain-check")
        .env("PATH", path)
        .env_remove("CI");
    if let Some(value) = ci {
        command.env("CI", value);
    }
    Ok(command.output()?)
}

#[test]
fn in_ci_a_check_that_cannot_run_is_a_failure() -> Result<(), Box<dyn Error>> {
    let dir = scratch("ci-no-rustup")?;
    let output = run(&dir, Some("true"))?;
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert_eq!(output.status.code(), Some(2), "{stderr}");
    assert!(stderr.contains("was not checked"), "{stderr}");
    assert!(
        stderr.contains(&format!("rustup target add {TARGET}")),
        "{stderr}"
    );
    Ok(())
}

#[test]
fn locally_a_check_that_cannot_run_says_so_and_succeeds() -> Result<(), Box<dyn Error>> {
    let dir = scratch("local-no-rustup")?;
    for ci in [None, Some("false")] {
        let output = run(&dir, ci)?;
        let stderr = String::from_utf8_lossy(&output.stderr);

        assert_eq!(output.status.code(), Some(0), "CI={ci:?}: {stderr}");
        assert!(
            stderr.contains("was NOT checked here"),
            "CI={ci:?}: {stderr}"
        );
    }
    Ok(())
}

#[test]
fn a_rustup_that_lacks_the_target_counts_as_not_installed() -> Result<(), Box<dyn Error>> {
    let dir = scratch("other-targets")?;
    let record = dir.join("cargo-was-run.txt");
    // A listed target that is only a prefix of the one required must not count.
    stub(
        &dir,
        "rustup",
        "echo aarch64-apple-darwin; echo thumbv7em-none-eabi",
    )?;
    // A cargo is present, so exiting 2 cannot be the accident of not finding one.
    stub(&dir, "cargo", &format!("echo ran > '{}'", record.display()))?;
    let output = run(&dir, Some("true"))?;
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert_eq!(output.status.code(), Some(2), "{stderr}");
    assert!(stderr.contains("was not checked"), "{stderr}");
    assert!(!record.exists(), "a build was attempted: {stderr}");
    Ok(())
}

#[test]
fn with_the_target_installed_it_checks_the_domain_crate_for_that_target(
) -> Result<(), Box<dyn Error>> {
    let dir = scratch("installed")?;
    let record = dir.join("cargo-args.txt");
    stub(
        &dir,
        "rustup",
        &format!("echo aarch64-apple-darwin; echo {TARGET}"),
    )?;
    stub(
        &dir,
        "cargo",
        &format!("printf '%s\\n' \"$@\" > '{}'", record.display()),
    )?;

    let output = run(&dir, Some("true"))?;
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let asked: Vec<String> = fs::read_to_string(&record)?
        .lines()
        .map(str::to_owned)
        .collect();
    assert_eq!(
        asked,
        [
            "check",
            "--quiet",
            "--package",
            "wesley-holmes-domain",
            "--target",
            TARGET
        ]
    );
    Ok(())
}

#[test]
fn a_failing_build_fails_the_check() -> Result<(), Box<dyn Error>> {
    let dir = scratch("build-fails")?;
    stub(&dir, "rustup", &format!("echo {TARGET}"))?;
    stub(&dir, "cargo", "exit 101")?;

    let output = run(&dir, None)?;
    assert_ne!(output.status.code(), Some(0));
    Ok(())
}
