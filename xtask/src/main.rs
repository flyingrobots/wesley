//! Repository automation for Wesley.

use ninelives::{Backoff, Jitter, ResilienceError, RetryPolicy};
use semver::Version;
use std::collections::BTreeMap;
use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::Duration;

const EXIT_OK: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const EXIT_USAGE: u8 = 2;
const ALPHA_VERSION: &str = "0.0.1";
const FORBIDDEN_GIT_IDENTITIES: &[&str] = &[
    "Wesley Tests",
    "wesley-tests@example.com",
    "Wesley CLI Test",
    "wesley@example.test",
    "Local Test",
    "test@local.dev",
    "CI Test",
    "test@ci.com",
];
const NODE_RETIREMENT_LEDGER: &str =
    "docs/design/0017-rust-native-front-door-and-node-retirement/node-retirement-ledger.json";
const PUBLISH_CRATES: &[PublishCrate] = &[
    PublishCrate {
        name: "wesley-core",
        path: "crates/wesley-core",
        dependencies: &[],
    },
    PublishCrate {
        name: "wesley-emit-codec",
        path: "crates/wesley-emit-codec",
        dependencies: &["wesley-core"],
    },
    PublishCrate {
        name: "wesley-emit-rust",
        path: "crates/wesley-emit-rust",
        dependencies: &["wesley-core", "wesley-emit-codec"],
    },
    PublishCrate {
        name: "wesley-emit-typescript",
        path: "crates/wesley-emit-typescript",
        dependencies: &["wesley-core", "wesley-emit-codec"],
    },
    PublishCrate {
        name: "wesley-cli",
        path: "crates/wesley-cli",
        dependencies: &["wesley-core", "wesley-emit-rust", "wesley-emit-typescript"],
    },
];

fn main() -> ExitCode {
    match run(env::args_os().skip(1).collect()) {
        Ok(()) => ExitCode::from(EXIT_OK),
        Err(Error::Usage(message)) => {
            eprintln!("{message}");
            eprintln!("Run `cargo xtask --help` for usage.");
            ExitCode::from(EXIT_USAGE)
        }
        Err(Error::CommandFailed { command, code }) => {
            eprintln!("xtask: `{command}` failed with exit code {code}");
            ExitCode::from(EXIT_FAILURE)
        }
        Err(Error::CheckFailed { check, failures }) => {
            eprintln!("xtask: {check} failed");
            for failure in failures {
                eprintln!(" - {failure}");
            }
            ExitCode::from(EXIT_FAILURE)
        }
    }
}

fn run(args: Vec<OsString>) -> Result<(), Error> {
    let Some(command) = args.first().and_then(|arg| arg.to_str()) else {
        print_help();
        return Ok(());
    };

    match command {
        "--help" | "-h" | "help" => {
            print_help();
            Ok(())
        }
        "test" => run_command("cargo", &["test", "--workspace"]),
        "preflight" | "strict-preflight" => run_preflight(),
        "docs-check" => run_docs_check(),
        "package-crates" => run_package_crates(&args[1..]),
        "publish-alpha" => {
            run_publish_crates(&args[1..], Some(ALPHA_VERSION), "publish-alpha", true)
        }
        "publish-crates" => run_publish_crates(&args[1..], None, "publish-crates", false),
        "release-prep-guard" => run_release_prep_guard(&args[1..]),
        "release-guard" => run_release_guard(&args[1..]),
        "release-check" => {
            run_preflight()?;
            run_release_artifact_check()
        }
        "legacy-preflight" => run_command("pnpm", &["run", "legacy-preflight"]),
        other => Err(Error::Usage(format!("unknown xtask command `{other}`"))),
    }
}

fn run_preflight() -> Result<(), Error> {
    check_git_identity_guard()?;
    run_command("cargo", &["fmt", "--check"])?;
    run_command(
        "cargo",
        &[
            "clippy",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ],
    )?;
    run_command("pnpm", &["audit", "--prod=false", "--json"])?;
    run_docs_check()?;
    run_command("cargo", &["test", "--workspace"])?;
    run_command("cargo", &["run", "--bin", "wesley", "--", "--help"])
}

fn run_release_artifact_check() -> Result<(), Error> {
    run_command("cargo", &["build", "--release", "--bin", "wesley"])?;
    run_command(
        "cargo",
        &["run", "--release", "--bin", "wesley", "--", "--help"],
    )?;
    run_command(
        "cargo",
        &[
            "package",
            "--manifest-path",
            "crates/wesley-core/Cargo.toml",
            "--allow-dirty",
            "--no-verify",
        ],
    )
}

fn run_package_crates(args: &[OsString]) -> Result<(), Error> {
    let options = PublishOptions::parse(args, None, "package-crates")?;
    check_publish_manifest_versions(&options.version)?;
    check_package_file_sets()
}

fn check_package_file_sets() -> Result<(), Error> {
    let mut failures = Vec::new();
    for publish_crate in PUBLISH_CRATES {
        let files = cargo_package_file_list(publish_crate.name)?;
        for required_file in required_package_files(publish_crate) {
            if !files.iter().any(|file| file == required_file) {
                failures.push(format!(
                    "{} package is missing {required_file}",
                    publish_crate.name
                ));
            }
        }
    }

    finish_check("crate package file sets", failures)
}

fn cargo_package_file_list(crate_name: &str) -> Result<Vec<String>, Error> {
    let args = ["package", "--allow-dirty", "--list", "-p", crate_name];
    let label = command_label("cargo", &args);
    println!("xtask: {label}");
    let output = Command::new("cargo")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

fn required_package_files(publish_crate: &PublishCrate) -> Vec<&'static str> {
    let mut files = vec!["Cargo.toml", "README.md"];
    if publish_crate.name == "wesley-cli" {
        files.push("src/main.rs");
    } else {
        files.push("src/lib.rs");
    }
    files
}

fn run_publish_crates(
    args: &[OsString],
    default_version: Option<&str>,
    command_name: &str,
    allow_dependency_skips: bool,
) -> Result<(), Error> {
    let options = PublishOptions::parse(args, default_version, command_name)?;
    check_publish_manifest_versions(&options.version)?;

    if options.execute {
        assert_github_actions_release_environment(options.tag.as_deref())?;
        assert_clean_worktree()?;
        if !options.skip_checks {
            if let Some(tag) = &options.tag {
                run_release_guard_for_tag(tag)?;
            }
            // The release guard runs the strict preflight. Only run the artifact checks here.
            run_release_artifact_check()?;
        }
        for publish_crate in PUBLISH_CRATES {
            if publish_decision(crate_version_is_indexed(
                publish_crate.name,
                &options.version,
            )) == PublishDecision::SkipAlreadyIndexed
            {
                println!(
                    "xtask: skipping {} {}; already visible in crates.io index",
                    publish_crate.name, options.version
                );
                continue;
            }
            run_publish_dry_run_for_crate(publish_crate.name, false)?;
            publish_crate_to_crates_io(publish_crate.name)?;
            wait_for_crate_version(publish_crate.name, &options.version)?;
        }
        println!("xtask: published Wesley crates {}", options.version);
        Ok(())
    } else {
        print_publish_crates_plan(&options.version);
        run_publish_crates_dry_run(&options.version, allow_dependency_skips)
    }
}

fn print_publish_crates_plan(version: &str) {
    println!("Wesley crates.io publish plan");
    println!();
    println!("Version: {version}");
    println!("Mode: dry-run/plan. Pass --execute for real crates.io uploads.");
    println!();
    println!("Publish order:");
    for publish_crate in PUBLISH_CRATES {
        println!(" - {}", publish_crate.name);
    }
    println!();
}

fn run_publish_crates_dry_run(version: &str, allow_dependency_skips: bool) -> Result<(), Error> {
    let mut failures = Vec::new();
    for publish_crate in PUBLISH_CRATES {
        let missing_dependencies = publish_crate
            .dependencies
            .iter()
            .filter(|dependency| !crate_version_is_indexed(dependency, version))
            .copied()
            .collect::<Vec<_>>();

        if missing_dependencies.is_empty() {
            run_publish_dry_run_for_crate(publish_crate.name, true)?;
        } else if allow_dependency_skips {
            println!(
                "xtask: skipping dry-run for {} until crates.io indexes {}",
                publish_crate.name,
                missing_dependencies.join(", ")
            );
        } else {
            failures.push(dry_run_dependency_failure(
                publish_crate.name,
                &missing_dependencies,
            ));
        }
    }

    finish_check("publish dry-run", failures)
}

#[derive(Debug, PartialEq, Eq)]
enum PublishDecision {
    SkipAlreadyIndexed,
    Publish,
}

fn publish_decision(crate_version_is_indexed: bool) -> PublishDecision {
    if crate_version_is_indexed {
        PublishDecision::SkipAlreadyIndexed
    } else {
        PublishDecision::Publish
    }
}

fn dry_run_dependency_failure(crate_name: &str, missing_dependencies: &[&str]) -> String {
    format!(
        "{crate_name} dry-run cannot run until crates.io indexes {}",
        missing_dependencies.join(", ")
    )
}

fn assert_github_actions_release_environment(tag: Option<&str>) -> Result<(), Error> {
    let mut failures = Vec::new();
    if env::var("GITHUB_ACTIONS").ok().as_deref() != Some("true") {
        failures.push("real crates.io publish must run inside GitHub Actions".to_string());
    }
    if env::var("GITHUB_REF_TYPE").ok().as_deref() != Some("tag") {
        failures.push("real crates.io publish must run from a GitHub tag ref".to_string());
    }

    let Some(tag) = tag else {
        failures.push("real crates.io publish requires --tag vX.Y.Z".to_string());
        return finish_check("release authority", failures);
    };

    match env::var("GITHUB_REF_NAME") {
        Ok(ref_name) if ref_name == tag => {}
        Ok(ref_name) => failures.push(format!(
            "requested tag `{tag}` does not match GITHUB_REF_NAME `{ref_name}`"
        )),
        Err(_) => failures.push("GITHUB_REF_NAME is missing".to_string()),
    }

    finish_check("release authority", failures)
}

fn run_publish_dry_run_for_crate(crate_name: &str, allow_dirty: bool) -> Result<(), Error> {
    if allow_dirty {
        run_command(
            "cargo",
            &["publish", "--dry-run", "--allow-dirty", "-p", crate_name],
        )
    } else {
        run_command("cargo", &["publish", "--dry-run", "-p", crate_name])
    }
}

fn publish_crate_to_crates_io(crate_name: &str) -> Result<(), Error> {
    run_command("cargo", &["publish", "-p", crate_name])
}

fn wait_for_crate_version(crate_name: &str, version: &str) -> Result<(), Error> {
    println!("xtask: waiting for {crate_name} {version} in crates.io index");
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .build()
        .map_err(|source| Error::Usage(format!("failed to build retry runtime: {source}")))?;

    runtime.block_on(wait_for_crate_version_async(
        crate_name.to_string(),
        version.to_string(),
    ))
}

async fn wait_for_crate_version_async(crate_name: String, version: String) -> Result<(), Error> {
    let policy = RetryPolicy::<IndexPollError>::builder()
        .max_attempts(30)
        .backoff(Backoff::constant(Duration::from_secs(10)))
        .with_jitter(Jitter::None)
        .should_retry(|_| true)
        .build()
        .map_err(|source| {
            Error::Usage(format!(
                "failed to build crates.io index retry policy: {source}"
            ))
        })?;

    policy
        .execute(|| {
            let crate_name = crate_name.clone();
            let version = version.clone();
            async move {
                if crate_version_is_indexed(&crate_name, &version) {
                    Ok(())
                } else {
                    Err(ResilienceError::Inner(IndexPollError {
                        crate_name,
                        version,
                    }))
                }
            }
        })
        .await
        .map_err(|source| Error::CheckFailed {
            check: "crates.io index propagation".to_string(),
            failures: vec![source.to_string()],
        })
}

fn crate_version_is_indexed(crate_name: &str, version: &str) -> bool {
    let spec = format!("{crate_name}@{version}");
    Command::new("cargo")
        .args(["info", &spec])
        .current_dir(env::temp_dir())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn assert_clean_worktree() -> Result<(), Error> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .map_err(|source| Error::Usage(format!("failed to run `git status`: {source}")))?;
    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: "git status --porcelain".to_string(),
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }
    if output.stdout.is_empty() {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "clean worktree".to_string(),
            failures: vec![
                "real crates.io publish requires a clean worktree; commit or stash changes first"
                    .to_string(),
            ],
        })
    }
}

fn run_release_guard(args: &[OsString]) -> Result<(), Error> {
    let options = ReleaseGuardOptions::parse(args)?;
    run_release_guard_for_tag(&options.tag)
}

fn run_release_prep_guard(args: &[OsString]) -> Result<(), Error> {
    let options = ReleasePrepOptions::parse(args)?;
    let tag = format!("v{}", options.version);
    check_git_identity_guard()?;
    check_publish_manifest_versions(&options.version)?;
    check_release_required_files(&options.version)?;
    check_release_tracker_clear(&tag, &options.version)?;
    check_package_file_sets()?;
    println!("xtask: release prep guard passed for {}", options.version);
    Ok(())
}

fn run_release_guard_for_tag(tag: &str) -> Result<(), Error> {
    let version = version_from_tag(tag)?;
    check_git_identity_guard()?;
    check_release_tag_points_to_head(tag)?;
    check_release_tag_is_on_main(tag)?;
    assert_clean_worktree()?;
    check_publish_manifest_versions(&version)?;
    check_release_required_files(&version)?;
    check_release_tracker_clear(tag, &version)?;
    check_readme_version_headline(&version)?;
    check_technical_teardown_version(&version)?;
    check_no_wip_fixup_commits(tag)?;
    check_breaking_change_version_bump(tag, &version)?;
    check_guide_file_paths_resolve()?;
    check_guide_cited_shas_exist()?;
    run_preflight()?;
    check_ci_green_on_head()?;
    check_cargo_audit_clean()?;
    check_cargo_doc_clean()?;
    println!("xtask: release guard passed for {tag}");
    Ok(())
}

fn version_from_tag(tag: &str) -> Result<String, Error> {
    let Some(version) = tag.strip_prefix('v') else {
        return Err(Error::CheckFailed {
            check: "release tag".to_string(),
            failures: vec![format!("tag `{tag}` must start with `v`")],
        });
    };

    version_from_release_arg(version)
}

fn version_from_release_arg(version: &str) -> Result<String, Error> {
    let parsed = Version::parse(version).map_err(|source| Error::CheckFailed {
        check: "release version".to_string(),
        failures: vec![format!(
            "version `{version}` must be valid SemVer without build metadata: {source}"
        )],
    })?;
    if !parsed.build.is_empty() {
        return Err(Error::CheckFailed {
            check: "release version".to_string(),
            failures: vec![format!(
                "version `{version}` must not include build metadata"
            )],
        });
    }
    Ok(parsed.to_string())
}

fn check_git_identity_guard() -> Result<(), Error> {
    let local_name = git_local_config_value("user.name")?;
    let local_email = git_local_config_value("user.email")?;
    let head_identity = git_head_identity()?;
    let failures = git_identity_failures(GitIdentityInput {
        local_name: local_name.as_deref(),
        local_email: local_email.as_deref(),
        head_author_name: head_identity.author_name.as_deref(),
        head_author_email: head_identity.author_email.as_deref(),
        head_committer_name: head_identity.committer_name.as_deref(),
        head_committer_email: head_identity.committer_email.as_deref(),
    });
    finish_check("git identity", failures)
}

#[derive(Default)]
struct GitIdentityInput<'a> {
    local_name: Option<&'a str>,
    local_email: Option<&'a str>,
    head_author_name: Option<&'a str>,
    head_author_email: Option<&'a str>,
    head_committer_name: Option<&'a str>,
    head_committer_email: Option<&'a str>,
}

#[derive(Default)]
struct HeadGitIdentity {
    author_name: Option<String>,
    author_email: Option<String>,
    committer_name: Option<String>,
    committer_email: Option<String>,
}

fn git_identity_failures(input: GitIdentityInput<'_>) -> Vec<String> {
    let mut failures = Vec::new();
    if let Some(name) = input.local_name {
        if is_forbidden_git_identity(name) {
            failures.push(format!("local git user.name is a test identity: {name}"));
        }
    }
    if let Some(email) = input.local_email {
        if is_forbidden_git_identity(email) {
            failures.push(format!("local git user.email is a test identity: {email}"));
        }
    }
    if let Some(name) = input.head_author_name {
        if is_forbidden_git_identity(name) {
            failures.push(format!("HEAD author name is a test identity: {name}"));
        }
    }
    if let Some(email) = input.head_author_email {
        if is_forbidden_git_identity(email) {
            failures.push(format!("HEAD author email is a test identity: {email}"));
        }
    }
    if let Some(name) = input.head_committer_name {
        if is_forbidden_git_identity(name) {
            failures.push(format!("HEAD committer name is a test identity: {name}"));
        }
    }
    if let Some(email) = input.head_committer_email {
        if is_forbidden_git_identity(email) {
            failures.push(format!("HEAD committer email is a test identity: {email}"));
        }
    }
    failures
}

fn is_forbidden_git_identity(value: &str) -> bool {
    FORBIDDEN_GIT_IDENTITIES.contains(&value)
}

fn git_local_config_value(key: &str) -> Result<Option<String>, Error> {
    let label = command_label("git", &["config", "--local", "--get", key]);
    let output = Command::new("git")
        .args(["config", "--local", "--get", key])
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok((!value.is_empty()).then_some(value))
    } else if output.status.code() == Some(1) {
        Ok(None)
    } else {
        Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        })
    }
}

fn git_head_identity() -> Result<HeadGitIdentity, Error> {
    let label = command_label(
        "git",
        &["log", "-1", "--format=%an%x00%ae%x00%cn%x00%ce", "HEAD"],
    );
    let output = Command::new("git")
        .args(["log", "-1", "--format=%an%x00%ae%x00%cn%x00%ce", "HEAD"])
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        if output.status.code() == Some(128) {
            return Ok(HeadGitIdentity::default());
        }
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parts = stdout
        .trim_end_matches('\n')
        .split('\0')
        .collect::<Vec<_>>();
    Ok(HeadGitIdentity {
        author_name: parts.first().and_then(|value| non_empty_string(value)),
        author_email: parts.get(1).and_then(|value| non_empty_string(value)),
        committer_name: parts.get(2).and_then(|value| non_empty_string(value)),
        committer_email: parts.get(3).and_then(|value| non_empty_string(value)),
    })
}

fn non_empty_string(value: &str) -> Option<String> {
    (!value.is_empty()).then(|| value.to_string())
}

fn check_release_tag_points_to_head(tag: &str) -> Result<(), Error> {
    let tag_ref = format!("{tag}^{{commit}}");
    let tag_commit = git_output(&["rev-parse", "--verify", &tag_ref])?;
    let head = git_output(&["rev-parse", "HEAD"])?;
    if tag_commit == head {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "release tag".to_string(),
            failures: vec![format!(
                "tag `{tag}` points at {tag_commit}, but workflow HEAD is {head}"
            )],
        })
    }
}

fn check_release_tag_is_on_main(tag: &str) -> Result<(), Error> {
    let tag_ref = format!("{tag}^{{commit}}");
    let tag_commit = git_output(&["rev-parse", "--verify", &tag_ref])?;
    if git_status_success(&["merge-base", "--is-ancestor", &tag_commit, "origin/main"])? {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "release tag".to_string(),
            failures: vec![format!(
                "tag `{tag}` points at {tag_commit}, which is not reachable from origin/main"
            )],
        })
    }
}

fn check_publish_manifest_versions(version: &str) -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let publish_crate_names = PUBLISH_CRATES
        .iter()
        .map(|publish_crate| publish_crate.name)
        .collect::<Vec<_>>();
    let mut failures = Vec::new();

    for publish_crate in PUBLISH_CRATES {
        let manifest_path = root.join(publish_crate.path).join("Cargo.toml");
        let manifest = match read_toml_manifest(&manifest_path) {
            Ok(manifest) => manifest,
            Err(failure) => {
                failures.push(failure);
                continue;
            }
        };

        let Some(package) = manifest.get("package").and_then(toml::Value::as_table) else {
            failures.push(format!("{} is missing [package]", publish_crate.path));
            continue;
        };

        let name = package
            .get("name")
            .and_then(toml::Value::as_str)
            .unwrap_or_default();
        if name != publish_crate.name {
            failures.push(format!(
                "{} package.name is `{name}`, expected `{}`",
                publish_crate.path, publish_crate.name
            ));
        }

        let manifest_version = package
            .get("version")
            .and_then(toml::Value::as_str)
            .unwrap_or_default();
        if manifest_version != version {
            failures.push(format!(
                "{} version is `{manifest_version}`, expected `{version}`",
                publish_crate.path
            ));
        }

        if package
            .get("publish")
            .and_then(toml::Value::as_bool)
            .is_some_and(|publish| !publish)
        {
            failures.push(format!("{} has publish = false", publish_crate.path));
        }

        check_dependency_hygiene(
            publish_crate,
            &manifest,
            version,
            &publish_crate_names,
            &mut failures,
        );
    }

    finish_check("release manifest versions", failures)
}

fn check_dependency_hygiene(
    publish_crate: &PublishCrate,
    manifest: &toml::Value,
    version: &str,
    publish_crate_names: &[&str],
    failures: &mut Vec<String>,
) {
    for section_name in ["dependencies", "dev-dependencies", "build-dependencies"] {
        let Some(dependencies) = manifest.get(section_name).and_then(toml::Value::as_table) else {
            continue;
        };

        for (dependency_name, dependency) in dependencies {
            let Some(dependency_table) = dependency.as_table() else {
                continue;
            };

            if dependency_table.contains_key("git") {
                failures.push(format!(
                    "{} {section_name}.{dependency_name} uses a git dependency",
                    publish_crate.path
                ));
            }
            if dependency_table.contains_key("workspace") {
                failures.push(format!(
                    "{} {section_name}.{dependency_name} uses a workspace dependency",
                    publish_crate.path
                ));
            }

            if dependency_table.contains_key("path") {
                let dependency_version = dependency_table
                    .get("version")
                    .and_then(toml::Value::as_str)
                    .unwrap_or_default();
                if !publish_crate_names.contains(&dependency_name.as_str())
                    || dependency_version != version
                {
                    failures.push(format!(
                        "{} {section_name}.{dependency_name} has registry-incompatible path dependency",
                        publish_crate.path
                    ));
                }
            }

            if publish_crate_names.contains(&dependency_name.as_str()) {
                let dependency_version = dependency_table
                    .get("version")
                    .and_then(toml::Value::as_str)
                    .unwrap_or_default();
                if dependency_version != version {
                    failures.push(format!(
                        "{} {section_name}.{dependency_name} version is `{dependency_version}`, expected `{version}`",
                        publish_crate.path
                    ));
                }
            }
        }
    }
}

fn check_release_required_files(version: &str) -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let mut failures = Vec::new();

    for required in ["README.md", "CHANGELOG.md"] {
        if !root.join(required).is_file() {
            failures.push(format!("missing root {required}"));
        }
    }

    if let Ok(changelog) = fs::read_to_string(root.join("CHANGELOG.md")) {
        match changelog_release_heading_status(&changelog, version) {
            ChangelogReleaseHeadingStatus::Dated => {}
            ChangelogReleaseHeadingStatus::Undated => {
                failures.push(format!(
                    "CHANGELOG.md has a section for {version} but it is missing a date; expected format: `## [{version}] - YYYY-MM-DD`"
                ));
            }
            ChangelogReleaseHeadingStatus::MalformedDate => {
                failures.push(format!(
                    "CHANGELOG.md has a section for {version} but its date is malformed; expected format: `## [{version}] - YYYY-MM-DD`"
                ));
            }
            ChangelogReleaseHeadingStatus::Missing => {
                failures.push(format!(
                    "CHANGELOG.md has no release notes section for {version}"
                ));
            }
        }
    }

    for publish_crate in PUBLISH_CRATES {
        let crate_root = root.join(publish_crate.path);
        let manifest_path = crate_root.join("Cargo.toml");
        if !manifest_path.is_file() {
            failures.push(format!("{}/Cargo.toml is missing", publish_crate.path));
        }
        if !crate_root.join("README.md").is_file() {
            failures.push(format!("{}/README.md is missing", publish_crate.path));
        }
        if !crate_root.join("src/lib.rs").is_file() && !crate_root.join("src/main.rs").is_file() {
            failures.push(format!(
                "{} must contain src/lib.rs or src/main.rs",
                publish_crate.path
            ));
        }

        let Ok(manifest) = read_toml_manifest(&manifest_path) else {
            continue;
        };
        let readme = manifest
            .get("package")
            .and_then(toml::Value::as_table)
            .and_then(|package| package.get("readme"))
            .and_then(toml::Value::as_str)
            .unwrap_or_default();
        if readme.is_empty() {
            failures.push(format!("{} package.readme is missing", publish_crate.path));
        } else if !crate_root.join(readme).is_file() {
            failures.push(format!(
                "{} package.readme points at missing `{readme}`",
                publish_crate.path
            ));
        }
    }

    finish_check("release required files", failures)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChangelogReleaseHeadingStatus {
    Dated,
    Undated,
    MalformedDate,
    Missing,
}

fn changelog_release_heading_status(
    changelog: &str,
    version: &str,
) -> ChangelogReleaseHeadingStatus {
    let plain = format!("## [{version}]");
    let with_v = format!("## [v{version}]");
    let plain_prefix = format!("{plain} - ");
    let with_v_prefix = format!("{with_v} - ");

    for line in changelog.lines().map(str::trim_end) {
        if line == plain || line == with_v {
            return ChangelogReleaseHeadingStatus::Undated;
        }
        if let Some(rest) = line
            .strip_prefix(&plain_prefix)
            .or_else(|| line.strip_prefix(&with_v_prefix))
        {
            let date = rest.trim();
            return if looks_like_yyyy_mm_dd(date) {
                ChangelogReleaseHeadingStatus::Dated
            } else {
                ChangelogReleaseHeadingStatus::MalformedDate
            };
        }
    }

    ChangelogReleaseHeadingStatus::Missing
}

fn looks_like_yyyy_mm_dd(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !(bytes.len() == 10
        && bytes[0..4].iter().all(u8::is_ascii_digit)
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(u8::is_ascii_digit))
    {
        return false;
    }

    let Ok(year) = value[0..4].parse::<u16>() else {
        return false;
    };
    let Ok(month) = value[5..7].parse::<u8>() else {
        return false;
    };
    let Ok(day) = value[8..10].parse::<u8>() else {
        return false;
    };

    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => return false,
    };
    day >= 1 && day <= max_day
}

fn is_leap_year(year: u16) -> bool {
    let year = u32::from(year);
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn check_release_backlog_clear(tag: &str, version: &str) -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let backlog_root = root.join("docs/method/backlog");
    let mut files = Vec::new();
    collect_markdown_files(&backlog_root, &mut files)?;

    let mut failures = Vec::new();
    for file in files {
        let relative = display_path(&root, &file);
        let content = fs::read_to_string(&file).map_err(|source| {
            Error::Usage(format!("failed to read `{}`: {source}", file.display()))
        })?;
        if relative.contains(tag)
            || relative.contains(version)
            || content.contains(tag)
            || content.contains(version)
        {
            failures.push(relative);
        }
    }

    finish_check("release backlog", failures)
}

fn check_release_tracker_clear(tag: &str, version: &str) -> Result<(), Error> {
    check_release_backlog_clear(tag, version)?;
    check_release_issue_tracker_clear(tag, version)
}

fn check_readme_version_headline(version: &str) -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let readme_path = root.join("README.md");
    let readme = fs::read_to_string(&readme_path).map_err(|source| Error::CheckFailed {
        check: "README version headline".to_string(),
        failures: vec![format!("README.md is missing or unreadable: {source}")],
    })?;

    let expected = format!("## What's New in v{version}");
    if readme_has_exact_version_headline(&readme, version) {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "README version headline".to_string(),
            failures: vec![format!(
                "README.md does not contain `{expected}`; update the What's New section to v{version}"
            )],
        })
    }
}

fn readme_has_exact_version_headline(readme: &str, version: &str) -> bool {
    let expected = format!("## What's New in v{version}");
    readme.lines().any(|line| line.trim_end() == expected)
}

fn teardown_contains_version(content: &str, version: &str) -> bool {
    let needle = format!("v{version}");
    let mut search = content;
    while let Some(pos) = search.find(&needle) {
        let before = search[..pos].chars().next_back();
        let after = &search[pos + needle.len()..];
        if is_release_version_boundary(before) && is_release_version_boundary(after.chars().next())
        {
            return true;
        }
        search = &search[pos + 1..];
    }
    false
}

fn is_release_version_boundary(ch: Option<char>) -> bool {
    match ch {
        None => true,
        Some(c) => !c.is_ascii_alphanumeric() && c != '.' && c != '-' && c != '+' && c != '_',
    }
}

fn check_technical_teardown_version(version: &str) -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let teardown_path = root.join("docs/TECHNICAL_TEARDOWN.md");
    let content = fs::read_to_string(&teardown_path).map_err(|source| Error::CheckFailed {
        check: "TECHNICAL_TEARDOWN version".to_string(),
        failures: vec![format!(
            "docs/TECHNICAL_TEARDOWN.md is missing or unreadable: {source}"
        )],
    })?;

    let v_version = format!("v{version}");
    if teardown_contains_version(&content, version) {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "TECHNICAL_TEARDOWN version".to_string(),
            failures: vec![format!(
                "docs/TECHNICAL_TEARDOWN.md does not reference {v_version}; update it to describe the {v_version} release state"
            )],
        })
    }
}

fn previous_tag_from_sorted_list<'a>(tags: &[&'a str], current_tag: &str) -> Option<&'a str> {
    let pos = tags.iter().position(|t| *t == current_tag)?;
    tags.get(pos + 1).copied()
}

fn find_previous_release_tag(current_tag: &str) -> Result<Option<String>, Error> {
    let output = Command::new("git")
        .args(["tag", "--sort=-version:refname"])
        .output()
        .map_err(|source| {
            Error::Usage(format!(
                "failed to spawn `git tag --sort=-version:refname`: {source}"
            ))
        })?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let tags: Vec<&str> = stdout
        .lines()
        .map(str::trim)
        .filter(|t| !t.is_empty() && version_from_tag(t).is_ok())
        .collect();
    Ok(previous_tag_from_sorted_list(&tags, current_tag).map(ToOwned::to_owned))
}

fn check_no_wip_fixup_commits(tag: &str) -> Result<(), Error> {
    let prev = find_previous_release_tag(tag)?;
    let range = match prev.as_deref() {
        Some(prev_tag) => format!("{prev_tag}..{tag}"),
        None => tag.to_string(),
    };

    let label = format!("git log {range} --format=%s");
    let output = Command::new("git")
        .args(["log", &range, "--format=%s"])
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let failures: Vec<String> = stdout
        .lines()
        .map(str::trim)
        .filter(|subject| subject.starts_with("WIP") || subject.starts_with("fixup!"))
        .map(|subject| format!("release range {range} contains WIP/fixup commit: {subject}"))
        .collect();

    finish_check("no WIP or fixup commits", failures)
}

fn check_breaking_change_version_bump(tag: &str, version: &str) -> Result<(), Error> {
    let Some(prev_tag) = find_previous_release_tag(tag)? else {
        return Ok(());
    };

    let range = format!("{prev_tag}..{tag}");
    let label = format!("git log {range} --format=%B");
    let output = Command::new("git")
        .args(["log", &range, "--format=%B"])
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    let full_log = String::from_utf8_lossy(&output.stdout);
    if !full_log.contains("BREAKING CHANGE") {
        return Ok(());
    }

    let prev_version = match version_from_tag(&prev_tag) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    let prev_parsed = match Version::parse(&prev_version) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    let curr_parsed = match Version::parse(version) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    let is_major_bump = curr_parsed.major > prev_parsed.major;
    let is_minor_bump =
        curr_parsed.major == prev_parsed.major && curr_parsed.minor > prev_parsed.minor;

    if is_major_bump || is_minor_bump {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "BREAKING CHANGE version bump".to_string(),
            failures: vec![format!(
                "release range {range} contains BREAKING CHANGE commits but version bumped from {prev_version} to {version} without a major or minor increment"
            )],
        })
    }
}

fn check_guide_file_paths_resolve() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let guides_dir = root.join("docs/guides");
    let mut guide_files = Vec::new();
    collect_markdown_files(&guides_dir, &mut guide_files)?;

    let mut failures = Vec::new();
    for guide in &guide_files {
        let content = fs::read_to_string(guide).map_err(|source| {
            Error::Usage(format!("failed to read `{}`: {source}", guide.display()))
        })?;
        for path_ref in extract_backtick_file_paths(&content) {
            let resolved = root.join(&path_ref);
            if !resolved.exists() {
                failures.push(format!(
                    "{}: `{path_ref}` does not exist",
                    display_path(&root, guide)
                ));
            }
        }
    }

    finish_check("guide file paths", failures)
}

fn check_guide_cited_shas_exist() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let guides_dir = root.join("docs/guides");
    let mut guide_files = Vec::new();
    collect_markdown_files(&guides_dir, &mut guide_files)?;

    let mut failures = Vec::new();
    for guide in &guide_files {
        let content = fs::read_to_string(guide).map_err(|source| {
            Error::Usage(format!("failed to read `{}`: {source}", guide.display()))
        })?;
        for sha in extract_backtick_commit_shas(&content) {
            if !git_revision_exists(&sha)? {
                failures.push(format!(
                    "{}: cited commit `{sha}` does not exist in git history",
                    display_path(&root, guide)
                ));
            }
        }
    }

    finish_check("guide cited commits", failures)
}

fn extract_backtick_file_paths(content: &str) -> Vec<String> {
    extract_backtick_content(content)
        .into_iter()
        .filter(|s| looks_like_file_path(s))
        .collect()
}

fn extract_backtick_commit_shas(content: &str) -> Vec<String> {
    extract_backtick_content(content)
        .into_iter()
        .filter(|s| looks_like_commit_sha(s))
        .collect()
}

fn extract_backtick_content(content: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut remaining = content;
    while let Some(open) = remaining.find('`') {
        remaining = &remaining[open + 1..];
        if let Some(close) = remaining.find('`') {
            let inner = &remaining[..close];
            if !inner.is_empty() && !inner.contains('\n') {
                result.push(inner.to_string());
            }
            remaining = &remaining[close + 1..];
        } else {
            break;
        }
    }
    result
}

fn looks_like_file_path(s: &str) -> bool {
    if s.starts_with("http://") || s.starts_with("https://") {
        return false;
    }
    if s.chars().any(char::is_whitespace) {
        return false;
    }
    if !s.contains('/') {
        return false;
    }
    let has_extension = s
        .split('/')
        .next_back()
        .is_some_and(|name| name.contains('.') && !name.starts_with('.'));
    let has_known_prefix = s.starts_with("src/")
        || s.starts_with("crates/")
        || s.starts_with("docs/")
        || s.starts_with("packages/")
        || s.starts_with("xtask/")
        || s.starts_with("scripts/")
        || s.starts_with("test/")
        || s.starts_with(".github/");
    has_extension || has_known_prefix
}

fn looks_like_commit_sha(s: &str) -> bool {
    s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn check_ci_green_on_head() -> Result<(), Error> {
    let head = git_output(&["rev-parse", "HEAD"])?;
    let args = [
        "run",
        "list",
        "--commit",
        &head,
        "--json",
        "conclusion,status,name,databaseId",
    ];
    let label = format!("gh {}", args.join(" "));
    let output = Command::new("gh")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::CheckFailed {
            check: "CI green on HEAD".to_string(),
            failures: vec![format!("`{label}` failed: {}", stderr.trim())],
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let runs = serde_json::from_str::<serde_json::Value>(&stdout)
        .map_err(|source| Error::Usage(format!("failed to parse `{label}` output: {source}")))?;
    let Some(runs) = runs.as_array() else {
        return Err(Error::Usage(format!("`{label}` returned non-array JSON")));
    };

    let current_run_id = env::var("GITHUB_RUN_ID")
        .ok()
        .and_then(|value| value.parse::<u64>().ok());
    let failures = ci_green_failures_for_runs(runs, current_run_id, &head);

    finish_check("CI green on HEAD", failures)
}

fn ci_green_failures_for_runs(
    runs: &[serde_json::Value],
    current_run_id: Option<u64>,
    head: &str,
) -> Vec<String> {
    if runs.is_empty() {
        return vec![format!(
            "no GitHub Actions runs found for HEAD commit {head}; CI must have run before tagging"
        )];
    }

    const PASSING_CONCLUSIONS: &[&str] = &["success", "skipped", "neutral"];
    let mut failures = Vec::new();
    let mut considered_runs = 0usize;

    for run in runs {
        if current_run_id.is_some()
            && run.get("databaseId").and_then(serde_json::Value::as_u64) == current_run_id
        {
            continue;
        }

        considered_runs += 1;
        let name = run
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("<unknown>");
        let status = run
            .get("status")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("");
        let conclusion = run.get("conclusion").and_then(serde_json::Value::as_str);

        if status != "completed" {
            failures.push(format!(
                "CI run `{name}` is not yet completed (status: {status})"
            ));
            continue;
        }
        match conclusion {
            Some(conclusion) if PASSING_CONCLUSIONS.contains(&conclusion) => {}
            Some(conclusion) => {
                failures.push(format!(
                    "CI run `{name}` did not pass (conclusion: {conclusion})"
                ));
            }
            None => {
                failures.push(format!(
                    "CI run `{name}` did not pass (conclusion: <missing>)"
                ));
            }
        }
    }

    if considered_runs == 0 {
        failures.push(format!(
            "no GitHub Actions runs other than the current release workflow were found for HEAD commit {head}; CI must have run before tagging"
        ));
    }

    failures
}

fn check_cargo_audit_clean() -> Result<(), Error> {
    run_command("cargo", &["audit"])
}

fn check_cargo_doc_clean() -> Result<(), Error> {
    println!("xtask: cargo doc --workspace --no-deps");
    let status = Command::new("cargo")
        .env("RUSTDOCFLAGS", "-D warnings")
        .args(["doc", "--workspace", "--no-deps"])
        .status()
        .map_err(|source| Error::Usage(format!("failed to spawn `cargo doc`: {source}")))?;

    if status.success() {
        Ok(())
    } else {
        Err(Error::CommandFailed {
            command: "cargo doc --workspace --no-deps".to_string(),
            code: status.code().unwrap_or(EXIT_FAILURE as i32),
        })
    }
}

fn check_release_issue_tracker_clear(tag: &str, version: &str) -> Result<(), Error> {
    let repo = release_github_repository()?;
    let queries = release_issue_query_specs(tag, version, &repo);
    let mut matches = BTreeMap::new();

    let text_query = release_issue_title_body_query(&repo);
    let text_output = Command::new("gh")
        .args(&text_query)
        .output()
        .map_err(|source| {
            Error::Usage(format!(
                "failed to spawn `gh {}` for release issue tracker check: {source}",
                text_query.join(" ")
            ))
        })?;

    if !text_output.status.success() {
        let stderr = String::from_utf8_lossy(&text_output.stderr);
        return Err(Error::CheckFailed {
            check: "release issue tracker".to_string(),
            failures: vec![format!(
                "`gh {}` failed: {}",
                text_query.join(" "),
                stderr.trim()
            )],
        });
    }

    let text_stdout = String::from_utf8_lossy(&text_output.stdout);
    for issue in parse_current_version_issue_text(&text_stdout, tag, version)? {
        matches.entry(issue.key).or_insert(issue.display);
    }

    for query in queries {
        let output = Command::new("gh")
            .args(&query.args)
            .output()
            .map_err(|source| {
                Error::Usage(format!(
                    "failed to spawn `gh {}` for release issue tracker check: {source}",
                    query.args.join(" ")
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if query.ignore_missing_selector && is_missing_issue_selector_error(&stderr) {
                continue;
            }
            return Err(Error::CheckFailed {
                check: "release issue tracker".to_string(),
                failures: vec![format!(
                    "`gh {}` failed: {}",
                    query.args.join(" "),
                    stderr.trim()
                )],
            });
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for issue in parse_release_issue_list(&stdout, &query.source)? {
            matches.entry(issue.key).or_insert(issue.display);
        }
    }

    let prior_output = Command::new("gh")
        .args([
            "issue",
            "list",
            "--repo",
            &repo,
            "--state",
            "open",
            "--limit",
            "1000",
            "--json",
            "number,title,url,labels,milestone",
        ])
        .output()
        .map_err(|source| {
            Error::Usage(format!(
                "failed to spawn `gh issue list --repo {repo}` for prior-version issue check: {source}"
            ))
        })?;

    if !prior_output.status.success() {
        let stderr = String::from_utf8_lossy(&prior_output.stderr);
        return Err(Error::CheckFailed {
            check: "release issue tracker".to_string(),
            failures: vec![format!(
                "`gh issue list --repo {repo}` failed: {}",
                stderr.trim()
            )],
        });
    }

    let prior_stdout = String::from_utf8_lossy(&prior_output.stdout);
    for issue in parse_prior_version_issue_lanes(&prior_stdout, version)? {
        matches.entry(issue.key).or_insert(issue.display);
    }

    finish_check(
        "release issue tracker",
        matches.into_values().collect::<Vec<_>>(),
    )
}

struct ReleaseIssueQuery {
    args: Vec<String>,
    source: String,
    ignore_missing_selector: bool,
}

struct ReleaseIssueMatch {
    key: String,
    display: String,
}

#[cfg(test)]
fn release_issue_queries(tag: &str, version: &str, repo: &str) -> Vec<Vec<String>> {
    std::iter::once(release_issue_title_body_query(repo))
        .chain(
            release_issue_query_specs(tag, version, repo)
                .into_iter()
                .map(|query| query.args),
        )
        .collect()
}

fn release_issue_query_specs(tag: &str, version: &str, _repo: &str) -> Vec<ReleaseIssueQuery> {
    vec![
        ReleaseIssueQuery {
            args: release_issue_selector_query("--label", tag),
            source: format!("release label `{tag}`"),
            ignore_missing_selector: true,
        },
        ReleaseIssueQuery {
            args: release_issue_selector_query("--milestone", tag),
            source: format!("milestone `{tag}`"),
            ignore_missing_selector: true,
        },
        ReleaseIssueQuery {
            args: release_issue_selector_query("--milestone", version),
            source: format!("milestone `{version}`"),
            ignore_missing_selector: true,
        },
        ReleaseIssueQuery {
            args: release_issue_selector_query("--label", tag),
            source: format!("label `{tag}`"),
            ignore_missing_selector: true,
        },
        ReleaseIssueQuery {
            args: release_issue_selector_query("--label", version),
            source: format!("label `{version}`"),
            ignore_missing_selector: true,
        },
    ]
}

fn release_issue_title_body_query(repo: &str) -> Vec<String> {
    vec![
        "issue".to_string(),
        "list".to_string(),
        "--repo".to_string(),
        repo.to_string(),
        "--state".to_string(),
        "open".to_string(),
        "--limit".to_string(),
        "1000".to_string(),
        "--json".to_string(),
        "number,title,url,body".to_string(),
    ]
}

fn release_issue_selector_query(selector: &str, value: &str) -> Vec<String> {
    vec![
        "issue".to_string(),
        "list".to_string(),
        "--state".to_string(),
        "open".to_string(),
        selector.to_string(),
        value.to_string(),
        "--json".to_string(),
        "number,title,url".to_string(),
    ]
}

fn parse_release_issue_list(content: &str, source: &str) -> Result<Vec<ReleaseIssueMatch>, Error> {
    let issues = serde_json::from_str::<serde_json::Value>(content).map_err(|source| {
        Error::Usage(format!(
            "failed to parse release issue tracker output as JSON: {source}"
        ))
    })?;
    let Some(issues) = issues.as_array() else {
        return Err(Error::Usage(
            "release issue tracker output must be a JSON array".to_string(),
        ));
    };

    let mut matches = Vec::new();
    for issue in issues {
        let number = issue
            .get("number")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| {
                Error::Usage("release issue tracker issue is missing numeric `number`".to_string())
            })?;
        let title = issue
            .get("title")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage("release issue tracker issue is missing string `title`".to_string())
            })?;
        let url = issue
            .get("url")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage("release issue tracker issue is missing string `url`".to_string())
            })?;
        matches.push(ReleaseIssueMatch {
            key: url.to_string(),
            display: format!("#{number} {title} {url} ({source})"),
        });
    }
    Ok(matches)
}

fn parse_current_version_issue_text(
    content: &str,
    tag: &str,
    version: &str,
) -> Result<Vec<ReleaseIssueMatch>, Error> {
    let issues = serde_json::from_str::<serde_json::Value>(content).map_err(|source| {
        Error::Usage(format!(
            "failed to parse release issue tracker title/body output as JSON: {source}"
        ))
    })?;
    let Some(issues) = issues.as_array() else {
        return Err(Error::Usage(
            "release issue tracker title/body output must be a JSON array".to_string(),
        ));
    };

    let mut matches = Vec::new();
    for issue in issues {
        let number = issue
            .get("number")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| {
                Error::Usage(
                    "release issue tracker title/body issue is missing numeric `number`"
                        .to_string(),
                )
            })?;
        let title = issue
            .get("title")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage(
                    "release issue tracker title/body issue is missing string `title`".to_string(),
                )
            })?;
        let url = issue
            .get("url")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage(
                    "release issue tracker title/body issue is missing string `url`".to_string(),
                )
            })?;
        let body = issue
            .get("body")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("");

        if contains_exact_release_reference(title, tag, version)
            || contains_exact_release_reference(body, tag, version)
        {
            matches.push(ReleaseIssueMatch {
                key: url.to_string(),
                display: format!("#{number} {title} {url} (title/body text)"),
            });
        }
    }
    Ok(matches)
}

fn contains_exact_release_reference(content: &str, tag: &str, version: &str) -> bool {
    contains_exact_release_token(content, tag) || contains_exact_release_token(content, version)
}

fn contains_exact_release_token(content: &str, needle: &str) -> bool {
    let mut search = content;
    while let Some(pos) = search.find(needle) {
        let before = search[..pos].chars().next_back();
        let after = &search[pos + needle.len()..];
        if is_release_version_boundary(before) && is_release_issue_token_end_boundary(after) {
            return true;
        }
        search = &search[pos + 1..];
    }
    false
}

fn is_release_issue_token_end_boundary(after: &str) -> bool {
    let mut chars = after.chars();
    match chars.next() {
        None => true,
        Some('.') => match chars.next() {
            None => true,
            Some(c) => c.is_whitespace(),
        },
        Some(c) => !c.is_ascii_alphanumeric() && c != '-' && c != '+' && c != '_',
    }
}

fn parse_prior_version_issue_lanes(
    content: &str,
    current_version: &str,
) -> Result<Vec<ReleaseIssueMatch>, Error> {
    let current = Version::parse(current_version).map_err(|source| {
        Error::Usage(format!(
            "failed to parse current release version `{current_version}` for prior-version issue check: {source}"
        ))
    })?;
    let issues = serde_json::from_str::<serde_json::Value>(content).map_err(|source| {
        Error::Usage(format!(
            "failed to parse prior-version issue tracker output as JSON: {source}"
        ))
    })?;
    let Some(issues) = issues.as_array() else {
        return Err(Error::Usage(
            "prior-version issue tracker output must be a JSON array".to_string(),
        ));
    };

    let mut matches = Vec::new();
    for issue in issues {
        let number = issue
            .get("number")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| {
                Error::Usage(
                    "prior-version issue tracker issue is missing numeric `number`".to_string(),
                )
            })?;
        let title = issue
            .get("title")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage(
                    "prior-version issue tracker issue is missing string `title`".to_string(),
                )
            })?;
        let url = issue
            .get("url")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                Error::Usage(
                    "prior-version issue tracker issue is missing string `url`".to_string(),
                )
            })?;

        let mut lanes = Vec::new();
        if let Some(title) = issue
            .get("milestone")
            .and_then(|milestone| milestone.get("title"))
            .and_then(serde_json::Value::as_str)
        {
            if version_lane_is_prior(title, &current) {
                lanes.push(format!("milestone `{title}`"));
            }
        }

        if let Some(labels) = issue.get("labels").and_then(serde_json::Value::as_array) {
            for label in labels {
                if let Some(name) = label.get("name").and_then(serde_json::Value::as_str) {
                    if version_lane_is_prior(name, &current) {
                        lanes.push(format!("label `{name}`"));
                    }
                }
            }
        }

        if !lanes.is_empty() {
            matches.push(ReleaseIssueMatch {
                key: url.to_string(),
                display: format!(
                    "#{number} {title} {url} (prior version {})",
                    lanes.join(", ")
                ),
            });
        }
    }

    Ok(matches)
}

fn version_lane_is_prior(lane: &str, current: &Version) -> bool {
    version_from_lane_name(lane).is_some_and(|version| version < *current)
}

fn version_from_lane_name(lane: &str) -> Option<Version> {
    let lane = lane.trim();
    let version = lane.strip_prefix('v').unwrap_or(lane);
    let parsed = Version::parse(version).ok()?;
    if parsed.build.is_empty() {
        Some(parsed)
    } else {
        None
    }
}

fn is_missing_issue_selector_error(stderr: &str) -> bool {
    let stderr = stderr.to_ascii_lowercase();
    stderr.contains("could not resolve")
        || stderr.contains("not found")
        || stderr.contains("no milestone")
        || stderr.contains("no label")
}

fn release_github_repository() -> Result<String, Error> {
    if let Ok(repository) = env::var("GITHUB_REPOSITORY") {
        if parse_github_repository_path(&repository).is_some() {
            return Ok(repository);
        }
    }

    let remote = git_output(&["remote", "get-url", "origin"])?;
    parse_github_repository_remote(&remote).ok_or_else(|| {
        Error::Usage(format!(
            "could not infer GitHub repository from origin remote `{remote}`"
        ))
    })
}

fn parse_github_repository_remote(remote: &str) -> Option<String> {
    let remote = remote.trim();
    let remote = remote.strip_suffix(".git").unwrap_or(remote);
    if let Some(path) = remote.strip_prefix("git@github.com:") {
        return parse_github_repository_path(path);
    }
    if let Some(path) = remote.strip_prefix("ssh://git@github.com/") {
        return parse_github_repository_path(path);
    }
    if let Some(path) = remote.strip_prefix("https://github.com/") {
        return parse_github_repository_path(path);
    }
    if let Some(path) = remote.strip_prefix("http://github.com/") {
        return parse_github_repository_path(path);
    }
    None
}

fn parse_github_repository_path(path: &str) -> Option<String> {
    let (owner, repo) = path.split_once('/')?;
    if owner.is_empty() || repo.is_empty() || repo.contains('/') {
        return None;
    }
    Some(format!("{owner}/{repo}"))
}

fn read_toml_manifest(path: &Path) -> Result<toml::Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|source| format!("failed to read `{}`: {source}", path.display()))?;
    toml::from_str(&content)
        .map_err(|source| format!("failed to parse `{}`: {source}", path.display()))
}

fn git_output(args: &[&str]) -> Result<String, Error> {
    let label = command_label("git", args);
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        })
    }
}

fn git_status_success(args: &[&str]) -> Result<bool, Error> {
    let label = command_label("git", args);
    Command::new("git")
        .args(args)
        .status()
        .map(|status| status.success())
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))
}

fn finish_check(check: &str, failures: Vec<String>) -> Result<(), Error> {
    if failures.is_empty() {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: check.to_string(),
            failures,
        })
    }
}

fn run_docs_check() -> Result<(), Error> {
    check_doc_links()?;
    check_docs_truth_manifest()?;
    check_forbidden_literals()?;
    check_node_retirement_ledger()?;
    Ok(())
}

fn check_node_retirement_ledger() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let ledger_path = root.join(NODE_RETIREMENT_LEDGER);
    let ledger_text = fs::read_to_string(&ledger_path).map_err(|source| Error::CheckFailed {
        check: "node retirement ledger".to_string(),
        failures: vec![format!(
            "missing or unreadable ledger `{}`: {source}",
            display_path(&root, &ledger_path)
        )],
    })?;
    let ledger: serde_json::Value =
        serde_json::from_str(&ledger_text).map_err(|source| Error::CheckFailed {
            check: "node retirement ledger".to_string(),
            failures: vec![format!("ledger is not valid JSON: {source}")],
        })?;

    let mut failures = Vec::new();
    check_node_package_dispositions(&root, &ledger, &mut failures)?;
    check_retired_node_packages_absent(&root, &ledger, &mut failures);
    check_legacy_package_metadata(&root, &ledger, &mut failures)?;
    check_pnpm_wesley_front_door_docs(&root, &ledger, &mut failures)?;
    check_legacy_core_authority_changes(&root, &ledger, &mut failures)?;

    if failures.is_empty() {
        println!("✅ Node retirement ledger guard passed");
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "node retirement ledger".to_string(),
            failures,
        })
    }
}

fn check_node_package_dispositions(
    root: &Path,
    ledger: &serde_json::Value,
    failures: &mut Vec<String>,
) -> Result<(), Error> {
    let package_entries = ledger_array(ledger, "packages", failures);
    let mut ledger_paths = package_entries
        .iter()
        .filter_map(|entry| entry.get("path").and_then(serde_json::Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    ledger_paths.sort();

    for package_dir in node_package_dirs(root)? {
        if !ledger_paths.iter().any(|path| path == &package_dir) {
            failures.push(format!(
                "{package_dir} has a package.json but no retirement ledger disposition"
            ));
        }
    }

    for entry in package_entries {
        let Some(path) = entry.get("path").and_then(serde_json::Value::as_str) else {
            failures.push("node retirement package entry is missing path".to_string());
            continue;
        };
        if entry
            .get("disposition")
            .and_then(serde_json::Value::as_str)
            .is_none_or(str::is_empty)
        {
            failures.push(format!("{path} is missing a non-empty disposition"));
        }
        if !root.join(path).join("package.json").is_file() {
            failures.push(format!(
                "{path} ledger entry does not point at a package.json"
            ));
        }
    }

    Ok(())
}

fn check_retired_node_packages_absent(
    root: &Path,
    ledger: &serde_json::Value,
    failures: &mut Vec<String>,
) {
    for entry in ledger_array(ledger, "retiredPackages", failures) {
        let Some(path) = entry.get("path").and_then(serde_json::Value::as_str) else {
            failures.push("node retirement retiredPackages entry is missing path".to_string());
            continue;
        };
        if root.join(path).join("package.json").is_file() {
            failures.push(format!(
                "{path} is listed in retiredPackages but package.json exists; restore requires a new ledger disposition and explicit review"
            ));
        }
    }
}

fn check_legacy_package_metadata(
    root: &Path,
    ledger: &serde_json::Value,
    failures: &mut Vec<String>,
) -> Result<(), Error> {
    for entry in ledger_array(ledger, "packages", failures) {
        let Some(path) = entry.get("path").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let package_json_path = root.join(path).join("package.json");
        let package_json_text =
            fs::read_to_string(&package_json_path).map_err(|source| Error::CheckFailed {
                check: "node retirement ledger".to_string(),
                failures: vec![format!(
                    "legacy package `{}` is missing or unreadable: {source}",
                    display_path(root, &package_json_path)
                )],
            })?;
        let package_json: serde_json::Value =
            serde_json::from_str(&package_json_text).map_err(|source| Error::CheckFailed {
                check: "node retirement ledger".to_string(),
                failures: vec![format!(
                    "legacy package `{}` is not valid JSON: {source}",
                    display_path(root, &package_json_path)
                )],
            })?;

        if package_json
            .get("private")
            .and_then(serde_json::Value::as_bool)
            != Some(true)
        {
            failures.push(format!(
                "{path}/package.json must set `private: true` while it remains in the legacy Node retirement ledger"
            ));
        }

        let retirement = package_json
            .get("wesley")
            .and_then(|value| value.get("retirement"));
        if retirement
            .and_then(|value| value.get("status"))
            .and_then(serde_json::Value::as_str)
            != Some("legacy-compatibility")
        {
            failures.push(format!(
                "{path}/package.json must set `wesley.retirement.status` to `legacy-compatibility`"
            ));
        }
        if retirement
            .and_then(|value| value.get("ledger"))
            .and_then(serde_json::Value::as_str)
            .is_none_or(str::is_empty)
        {
            failures.push(format!(
                "{path}/package.json must include `wesley.retirement.ledger`"
            ));
        }
        if retirement
            .and_then(|value| value.get("disposition"))
            .and_then(serde_json::Value::as_str)
            .is_none_or(str::is_empty)
        {
            failures.push(format!(
                "{path}/package.json must include `wesley.retirement.disposition`"
            ));
        }
    }

    Ok(())
}

fn node_package_dirs(root: &Path) -> Result<Vec<String>, Error> {
    let packages_dir = root.join("packages");
    let entries = fs::read_dir(&packages_dir).map_err(|source| {
        Error::Usage(format!(
            "failed to read `{}`: {source}",
            display_path(root, &packages_dir)
        ))
    })?;
    let mut dirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|source| {
            Error::Usage(format!(
                "failed to read entry in `{}`: {source}",
                display_path(root, &packages_dir)
            ))
        })?;
        let path = entry.path();
        if path.join("package.json").is_file() {
            dirs.push(display_path(root, &path));
        }
    }

    dirs.sort();
    Ok(dirs)
}

fn check_pnpm_wesley_front_door_docs(
    root: &Path,
    ledger: &serde_json::Value,
    failures: &mut Vec<String>,
) -> Result<(), Error> {
    let context_terms = ledger_strings(ledger, "pnpmWesleyCompatibilityContext", failures);
    for doc in ledger_strings(ledger, "frontDoorDocs", failures) {
        let path = root.join(&doc);
        let content = fs::read_to_string(&path).map_err(|source| Error::CheckFailed {
            check: "node retirement ledger".to_string(),
            failures: vec![format!(
                "front-door doc `{}` is missing or unreadable: {source}",
                display_path(root, &path)
            )],
        })?;
        let lines = content.lines().collect::<Vec<_>>();
        for (index, line) in lines.iter().enumerate() {
            if !line.contains("pnpm wesley") {
                continue;
            }
            let context = context_window(&lines, index, 4).to_ascii_lowercase();
            if !context_terms
                .iter()
                .any(|term| context.contains(&term.to_ascii_lowercase()))
            {
                failures.push(format!(
                    "{}:{} mentions `pnpm wesley` without legacy or migration context",
                    doc,
                    index + 1
                ));
            }
        }
    }

    Ok(())
}

fn check_legacy_core_authority_changes(
    root: &Path,
    ledger: &serde_json::Value,
    failures: &mut Vec<String>,
) -> Result<(), Error> {
    let base = env::var("WESLEY_NODE_RETIREMENT_BASE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "origin/main".to_string());
    if !git_revision_exists(&base)? {
        return Ok(());
    }

    let changed_paths = git_changed_paths_against(&base)?;
    let authority_paths = ledger_strings(ledger, "legacyCoreAuthorityPaths", failures);
    let allowed_changes = ledger_strings(ledger, "legacyCoreAuthorityAllowedChanges", failures);

    for path in changed_paths {
        if authority_paths
            .iter()
            .any(|prefix| path.starts_with(prefix))
            && !allowed_changes.iter().any(|allowed| allowed == &path)
            && !legacy_core_package_metadata_only_change(&base, root, &path)?
        {
            failures.push(format!(
                "{path} changes legacy JS core authority; move behavior to Rust or list an explicit temporary allowance in {NODE_RETIREMENT_LEDGER}"
            ));
        }
    }

    Ok(())
}

fn legacy_core_package_metadata_only_change(
    base: &str,
    root: &Path,
    path: &str,
) -> Result<bool, Error> {
    if path != "packages/wesley-core/package.json" {
        return Ok(false);
    }

    let Some(old_text) = git_file_text(base, path)? else {
        return Ok(false);
    };
    let current_path = root.join(path);
    let current_text = fs::read_to_string(&current_path).map_err(|source| Error::CheckFailed {
        check: "node retirement ledger".to_string(),
        failures: vec![format!(
            "legacy package `{}` is missing or unreadable: {source}",
            display_path(root, &current_path)
        )],
    })?;
    let old_json: serde_json::Value =
        serde_json::from_str(&old_text).map_err(|source| Error::CheckFailed {
            check: "node retirement ledger".to_string(),
            failures: vec![format!("{base}:{path} is not valid JSON: {source}")],
        })?;
    let current_json: serde_json::Value =
        serde_json::from_str(&current_text).map_err(|source| Error::CheckFailed {
            check: "node retirement ledger".to_string(),
            failures: vec![format!("{path} is not valid JSON: {source}")],
        })?;

    Ok(package_json_without_retirement_metadata(&old_json)
        == package_json_without_retirement_metadata(&current_json))
}

fn package_json_without_retirement_metadata(value: &serde_json::Value) -> serde_json::Value {
    let mut normalized = value.clone();
    if let Some(object) = normalized.as_object_mut() {
        object.remove("description");
        object.remove("private");
        object.remove("wesley");
    }
    normalized
}

fn ledger_array<'a>(
    ledger: &'a serde_json::Value,
    key: &str,
    failures: &mut Vec<String>,
) -> Vec<&'a serde_json::Value> {
    match ledger.get(key).and_then(serde_json::Value::as_array) {
        Some(values) => values.iter().collect(),
        None => {
            failures.push(format!("node retirement ledger is missing array `{key}`"));
            Vec::new()
        }
    }
}

fn ledger_strings(
    ledger: &serde_json::Value,
    key: &str,
    failures: &mut Vec<String>,
) -> Vec<String> {
    ledger_array(ledger, key, failures)
        .into_iter()
        .filter_map(|value| value.as_str().map(ToOwned::to_owned))
        .collect()
}

fn context_window(lines: &[&str], index: usize, radius: usize) -> String {
    let start = index.saturating_sub(radius);
    let end = (index + radius + 1).min(lines.len());
    lines[start..end].join("\n")
}

fn git_revision_exists(revision: &str) -> Result<bool, Error> {
    let commit_revision = format!("{revision}^{{commit}}");
    let status = Command::new("git")
        .args(["rev-parse", "--verify", "--quiet", &commit_revision])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|source| Error::Usage(format!("failed to spawn `git rev-parse`: {source}")))?;
    Ok(status.success())
}

fn git_changed_paths_against(base: &str) -> Result<Vec<String>, Error> {
    let label = format!("git diff --name-only --diff-filter=ACMR {base}...HEAD");
    let output = Command::new("git")
        .args(["diff", "--name-only", "--diff-filter=ACMR"])
        .arg(format!("{base}...HEAD"))
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: label,
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

fn git_file_text(base: &str, path: &str) -> Result<Option<String>, Error> {
    let revision_path = format!("{base}:{path}");
    let label = format!("git show {revision_path}");
    let output = Command::new("git")
        .args(["show", &revision_path])
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if !output.status.success() {
        return Ok(None);
    }

    Ok(Some(String::from_utf8_lossy(&output.stdout).to_string()))
}

fn check_doc_links() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let mut markdown_files = Vec::new();
    collect_markdown_files(&root, &mut markdown_files)?;

    let mut failures = Vec::new();
    for file in markdown_files {
        let content = fs::read_to_string(&file).map_err(|source| {
            Error::Usage(format!("failed to read `{}`: {source}", file.display()))
        })?;

        for link in markdown_links(&content) {
            let mut target_link = link.trim().to_string();
            if target_link.is_empty()
                || target_link.starts_with("http://")
                || target_link.starts_with("https://")
                || target_link.starts_with("mailto:")
            {
                continue;
            }

            if let Some((without_anchor, _anchor)) = target_link.split_once('#') {
                target_link = without_anchor.to_string();
            }
            if target_link.is_empty() {
                continue;
            }

            let Some(base) = file.parent() else {
                continue;
            };
            let target = base.join(&target_link);
            if !target.is_file() && !target.is_dir() {
                failures.push(format!("{}: {link}", display_path(&root, &file)));
            }
        }
    }

    if failures.is_empty() {
        println!("✅ No broken relative links found in markdown docs");
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "doc links".to_string(),
            failures,
        })
    }
}

fn collect_markdown_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), Error> {
    const IGNORED_DIRS: &[&str] = &[".git", "node_modules", ".wesley", "out", "target"];

    let entries = fs::read_dir(dir)
        .map_err(|source| Error::Usage(format!("failed to read `{}`: {source}", dir.display())))?;

    for entry in entries {
        let entry = entry.map_err(|source| {
            Error::Usage(format!(
                "failed to read entry in `{}`: {source}",
                dir.display()
            ))
        })?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|source| {
            Error::Usage(format!("failed to inspect `{}`: {source}", path.display()))
        })?;
        let name = entry.file_name();
        let name = name.to_string_lossy();

        if name.starts_with(".DS_Store") {
            continue;
        }

        if file_type.is_dir() {
            if IGNORED_DIRS.contains(&name.as_ref()) {
                continue;
            }
            collect_markdown_files(&path, out)?;
        } else if file_type.is_file()
            && path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
        {
            out.push(path);
        }
    }

    Ok(())
}

fn markdown_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut offset = 0;

    while let Some(open_rel) = content[offset..].find('[') {
        let open = offset + open_rel;
        if open > 0 && content.as_bytes()[open - 1] == b'!' {
            offset = open + 1;
            continue;
        }

        let Some(close_rel) = content[open..].find("](") else {
            break;
        };
        let link_start = open + close_rel + 2;
        let Some(end_rel) = content[link_start..].find(')') else {
            break;
        };
        let link_end = link_start + end_rel;
        links.push(content[link_start..link_end].to_string());
        offset = link_end + 1;
    }

    links
}

fn check_docs_truth_manifest() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let manifest_path = root.join("docs/truth-manifest.json");
    let manifest_text =
        fs::read_to_string(&manifest_path).map_err(|source| Error::CheckFailed {
            check: "docs truth".to_string(),
            failures: vec![format!(
                "missing or unreadable manifest `{}`: {source}",
                display_path(&root, &manifest_path)
            )],
        })?;
    let manifest: serde_json::Value =
        serde_json::from_str(&manifest_text).map_err(|source| Error::CheckFailed {
            check: "docs truth".to_string(),
            failures: vec![format!("manifest is not valid JSON: {source}")],
        })?;

    let mut failures = Vec::new();
    let manifest_version_is_integer = manifest
        .get("version")
        .and_then(serde_json::Value::as_i64)
        .is_some();
    if !manifest_version_is_integer {
        failures.push("manifest.version must be an integer".to_string());
    }

    let Some(documents) = manifest
        .get("documents")
        .and_then(serde_json::Value::as_array)
    else {
        failures.push("manifest.documents must be a non-empty array".to_string());
        return finish_docs_truth(failures);
    };

    if documents.is_empty() {
        failures.push("manifest.documents must be a non-empty array".to_string());
    }

    let mut seen = Vec::<String>::new();
    for entry in documents {
        let Some(entry) = entry.as_object() else {
            failures.push("manifest entry must be an object".to_string());
            continue;
        };

        let Some(path) = entry.get("path").and_then(serde_json::Value::as_str) else {
            failures.push("manifest entry is missing a non-empty \"path\"".to_string());
            continue;
        };
        if path.is_empty() {
            failures.push("manifest entry is missing a non-empty \"path\"".to_string());
            continue;
        }

        let owner = entry
            .get("owner")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if owner.is_empty() {
            failures.push(format!(
                "manifest entry {path} is missing a non-empty \"owner\""
            ));
        }

        let status = entry
            .get("status")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if !matches!(status, "current" | "experimental" | "proposed") {
            failures.push(format!(
                "manifest entry {path} has invalid status \"{status}\""
            ));
        }

        let absolute = root.join(path);
        let normalized = normalize_path(&absolute);
        if seen.contains(&normalized) {
            failures.push(format!("duplicate manifest entry for {path}"));
            continue;
        }
        seen.push(normalized);

        let Ok(content) = fs::read_to_string(&absolute) else {
            failures.push(format!("manifest entry points to missing file: {path}"));
            continue;
        };
        let Some((file_status, file_owner)) = extract_docs_truth(&content) else {
            failures.push(format!("{path} is missing docs-truth metadata comment"));
            continue;
        };
        if file_status != status {
            failures.push(format!(
                "{path} status mismatch: manifest={status} file={file_status}"
            ));
        }
        if file_owner != owner {
            failures.push(format!(
                "{path} owner mismatch: manifest={owner} file={file_owner}"
            ));
        }
    }

    let mkdocs_path = root.join("mkdocs.yml");
    if let Ok(mkdocs) = fs::read_to_string(&mkdocs_path) {
        let nav_docs = extract_nav_docs(&root, &mkdocs);
        for nav_doc in nav_docs {
            let normalized = normalize_path(&nav_doc);
            if !seen.contains(&normalized) {
                failures.push(format!(
                    "public docs page is missing from truth manifest: {}",
                    display_path(&root, &nav_doc)
                ));
            }
        }
    }

    finish_docs_truth(failures)
}

fn finish_docs_truth(failures: Vec<String>) -> Result<(), Error> {
    if failures.is_empty() {
        println!("✅ Docs truth manifest is consistent");
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "docs truth".to_string(),
            failures,
        })
    }
}

fn extract_docs_truth(content: &str) -> Option<(String, String)> {
    let marker = "docs-truth:";
    let marker_index = content.find(marker)?;
    let tail = &content[marker_index + marker.len()..];
    let end = tail.find("-->").unwrap_or(tail.len());
    let metadata = &tail[..end];
    let mut status = None;
    let mut owner = None;

    for token in metadata.split_whitespace() {
        if let Some(value) = token.strip_prefix("status=") {
            status = Some(value.trim().to_string());
        } else if let Some(value) = token.strip_prefix("owner=") {
            owner = Some(value.trim().to_string());
        }
    }

    Some((status?, owner?))
}

fn extract_nav_docs(root: &Path, mkdocs: &str) -> Vec<PathBuf> {
    let docs_dir = mkdocs
        .lines()
        .find_map(|line| {
            let line = line.trim();
            line.strip_prefix("docs_dir:").map(str::trim)
        })
        .unwrap_or("docs");
    let docs_root = root.join(docs_dir);
    let mut docs = Vec::new();

    for raw_line in mkdocs.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') || !line.contains(".md") {
            continue;
        }

        let Some((_label, path_part)) = line.split_once(':') else {
            continue;
        };
        let rel = path_part.split('#').next().unwrap_or_default().trim();
        if rel.ends_with(".md") {
            docs.push(docs_root.join(rel));
        }
    }

    docs
}

fn check_forbidden_literals() -> Result<(), Error> {
    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let mut literals = vec![["", "Users", "james", ""].join("/")];
    if let Ok(extra) = env::var("WESLEY_FORBIDDEN_LITERALS") {
        literals.extend(
            extra
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToOwned::to_owned),
        );
    }

    let output = Command::new("git")
        .args(["ls-files", "-z"])
        .output()
        .map_err(|source| Error::Usage(format!("failed to run `git ls-files`: {source}")))?;
    if !output.status.success() {
        return Err(Error::CommandFailed {
            command: "git ls-files -z".to_string(),
            code: output.status.code().unwrap_or(EXIT_FAILURE as i32),
        });
    }

    let mut failures = Vec::new();
    for raw_path in output.stdout.split(|byte| *byte == 0) {
        if raw_path.is_empty() {
            continue;
        }
        let pathname = String::from_utf8_lossy(raw_path);
        let path = root.join(pathname.as_ref());
        let Ok(content) = fs::read(&path) else {
            continue;
        };

        for literal in &literals {
            if content
                .windows(literal.len())
                .any(|window| window == literal.as_bytes())
            {
                failures.push(format!("{pathname}: {literal}"));
            }
        }
    }

    if failures.is_empty() {
        println!("✅ No forbidden machine-local path literals found");
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "forbidden literals".to_string(),
            failures,
        })
    }
}

fn normalize_path(path: &Path) -> String {
    normalize_path_buf(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn normalize_path_buf(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

fn display_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn run_command(program: &str, args: &[&str]) -> Result<(), Error> {
    let label = command_label(program, args);
    println!("xtask: {label}");

    let status = Command::new(program)
        .args(args)
        .status()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;

    if status.success() {
        Ok(())
    } else {
        Err(Error::CommandFailed {
            command: label,
            code: status.code().unwrap_or(EXIT_FAILURE as i32),
        })
    }
}

fn command_label(program: &str, args: &[&str]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(program.to_string());
    parts.extend(args.iter().map(|arg| (*arg).to_string()));
    parts.join(" ")
}

fn print_help() {
    println!(
        "\
Wesley repository automation

Usage:
  cargo xtask <command>

Commands:
  test              Run Rust workspace tests
  docs-check        Run Rust-native documentation hygiene checks
  preflight         Run the strict pre-PR/release quality gate
  strict-preflight  Alias for preflight
  package-crates    Check package file sets for the crates.io release set
  publish-alpha     Publish the crates.io alpha package set; dry-run by default
  publish-crates    Publish crates.io package set for a release tag
  release-prep-guard Verify release prep before a tag exists
  release-guard     Verify that a release tag is eligible to publish
  release-check     Run strict preflight, then build and package release artifacts
  legacy-preflight  Run the historical pnpm package preflight for legacy changes
  help              Show help

Publish options:
  cargo xtask publish-alpha                    Print alpha plan and run safe dry-runs
  cargo xtask publish-alpha --execute          CI tag-only compatibility publish path
  cargo xtask package-crates --tag vX.Y.Z      Check release package file sets
  cargo xtask package-crates --version X.Y.Z   Check pre-tag release package file sets
  cargo xtask publish-crates --tag vX.Y.Z      Print tag-derived plan and run safe dry-runs
  cargo xtask publish-crates --tag vX.Y.Z --execute  Publish in GitHub Actions only
  cargo xtask release-prep-guard --version X.Y.Z
  cargo xtask release-guard --tag vX.Y.Z"
    );
}

struct PublishCrate {
    name: &'static str,
    path: &'static str,
    dependencies: &'static [&'static str],
}

#[derive(Default)]
struct PublishOptions {
    execute: bool,
    skip_checks: bool,
    tag: Option<String>,
    version: String,
}

impl PublishOptions {
    fn parse(
        args: &[OsString],
        default_version: Option<&str>,
        command_name: &str,
    ) -> Result<Self, Error> {
        let mut options = Self {
            version: default_version.unwrap_or_default().to_string(),
            ..Default::default()
        };

        let mut index = 0;
        while index < args.len() {
            let arg = &args[index];
            let Some(arg) = arg.to_str() else {
                return Err(Error::Usage(format!(
                    "{command_name} options must be UTF-8"
                )));
            };
            match arg {
                "--dry-run" => {
                    options.execute = false;
                }
                "--execute" => {
                    options.execute = true;
                }
                "--skip-checks" => {
                    options.skip_checks = true;
                }
                "--tag" => {
                    index += 1;
                    let Some(tag) = args.get(index).and_then(|arg| arg.to_str()) else {
                        return Err(Error::Usage(format!(
                            "{command_name} --tag requires a UTF-8 value"
                        )));
                    };
                    options.version = version_from_tag(tag)?;
                    options.tag = Some(tag.to_string());
                }
                value if value.starts_with("--tag=") => {
                    let tag = value.trim_start_matches("--tag=");
                    options.version = version_from_tag(tag)?;
                    options.tag = Some(tag.to_string());
                }
                "--version" => {
                    index += 1;
                    let Some(version) = args.get(index).and_then(|arg| arg.to_str()) else {
                        return Err(Error::Usage(format!(
                            "{command_name} --version requires a UTF-8 value"
                        )));
                    };
                    options.version = version_from_release_arg(version)?;
                }
                value if value.starts_with("--version=") => {
                    let version = value.trim_start_matches("--version=");
                    options.version = version_from_release_arg(version)?;
                }
                "--help" | "-h" => {
                    print_help();
                    return Err(Error::Usage(format!(
                        "{command_name} help requested; see usage above"
                    )));
                }
                other => {
                    return Err(Error::Usage(format!(
                        "unknown {command_name} option `{other}`"
                    )));
                }
            }
            index += 1;
        }

        if options.version.is_empty() {
            return Err(Error::Usage(format!(
                "{command_name} requires --tag vX.Y.Z or --version X.Y.Z"
            )));
        }
        Ok(options)
    }
}

struct ReleaseGuardOptions {
    tag: String,
}

struct ReleasePrepOptions {
    version: String,
}

impl ReleasePrepOptions {
    fn parse(args: &[OsString]) -> Result<Self, Error> {
        let mut version = None;
        let mut index = 0;
        while index < args.len() {
            let Some(arg) = args[index].to_str() else {
                return Err(Error::Usage(
                    "release-prep-guard options must be UTF-8".to_string(),
                ));
            };
            match arg {
                "--version" => {
                    index += 1;
                    let Some(value) = args.get(index).and_then(|arg| arg.to_str()) else {
                        return Err(Error::Usage(
                            "release-prep-guard --version requires a UTF-8 value".to_string(),
                        ));
                    };
                    version = Some(version_from_release_arg(value)?);
                }
                value if value.starts_with("--version=") => {
                    let value = value.trim_start_matches("--version=");
                    version = Some(version_from_release_arg(value)?);
                }
                "--help" | "-h" => {
                    print_help();
                    return Err(Error::Usage(
                        "release-prep-guard help requested; see usage above".to_string(),
                    ));
                }
                other => {
                    return Err(Error::Usage(format!(
                        "unknown release-prep-guard option `{other}`"
                    )));
                }
            }
            index += 1;
        }

        let Some(version) = version else {
            return Err(Error::Usage(
                "release-prep-guard requires --version X.Y.Z".to_string(),
            ));
        };
        Ok(Self { version })
    }
}

impl ReleaseGuardOptions {
    fn parse(args: &[OsString]) -> Result<Self, Error> {
        let mut tag = None;
        let mut index = 0;
        while index < args.len() {
            let Some(arg) = args[index].to_str() else {
                return Err(Error::Usage(
                    "release-guard options must be UTF-8".to_string(),
                ));
            };
            match arg {
                "--tag" => {
                    index += 1;
                    let Some(value) = args.get(index).and_then(|arg| arg.to_str()) else {
                        return Err(Error::Usage(
                            "release-guard --tag requires a UTF-8 value".to_string(),
                        ));
                    };
                    tag = Some(value.to_string());
                }
                value if value.starts_with("--tag=") => {
                    tag = Some(value.trim_start_matches("--tag=").to_string());
                }
                "--help" | "-h" => {
                    print_help();
                    return Err(Error::Usage(
                        "release-guard help requested; see usage above".to_string(),
                    ));
                }
                other => {
                    return Err(Error::Usage(format!(
                        "unknown release-guard option `{other}`"
                    )));
                }
            }
            index += 1;
        }

        let Some(tag) = tag else {
            return Err(Error::Usage(
                "release-guard requires --tag vX.Y.Z".to_string(),
            ));
        };
        Ok(Self { tag })
    }
}

#[derive(Debug)]
struct IndexPollError {
    crate_name: String,
    version: String,
}

impl std::fmt::Display for IndexPollError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} {} is not visible in the crates.io index yet",
            self.crate_name, self.version
        )
    }
}

impl std::error::Error for IndexPollError {}

#[derive(Debug)]
enum Error {
    Usage(String),
    CommandFailed {
        command: String,
        code: i32,
    },
    CheckFailed {
        check: String,
        failures: Vec<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn official_dry_run_reports_missing_internal_dependency_as_failure() {
        let failure = dry_run_dependency_failure("wesley-emit-rust", &["wesley-core"]);
        assert_eq!(
            failure,
            "wesley-emit-rust dry-run cannot run until crates.io indexes wesley-core"
        );
    }

    #[test]
    fn execute_publish_skips_crates_that_are_already_indexed() {
        assert_eq!(publish_decision(true), PublishDecision::SkipAlreadyIndexed);
        assert_eq!(publish_decision(false), PublishDecision::Publish);
    }

    #[test]
    fn release_prep_version_does_not_require_existing_git_tag() {
        assert_eq!(version_from_release_arg("0.0.1").unwrap(), "0.0.1");
        assert_eq!(
            version_from_release_arg("0.0.1-alpha.1").unwrap(),
            "0.0.1-alpha.1"
        );
    }

    #[test]
    fn release_guard_queries_github_issue_tracker() {
        let queries = release_issue_queries("v1.2.3", "1.2.3", "flyingrobots/wesley");

        assert_eq!(
            queries,
            vec![
                vec![
                    "issue",
                    "list",
                    "--repo",
                    "flyingrobots/wesley",
                    "--state",
                    "open",
                    "--limit",
                    "1000",
                    "--json",
                    "number,title,url,body",
                ],
                vec![
                    "issue",
                    "list",
                    "--state",
                    "open",
                    "--label",
                    "v1.2.3",
                    "--json",
                    "number,title,url",
                ],
                vec![
                    "issue",
                    "list",
                    "--state",
                    "open",
                    "--milestone",
                    "v1.2.3",
                    "--json",
                    "number,title,url",
                ],
                vec![
                    "issue",
                    "list",
                    "--state",
                    "open",
                    "--milestone",
                    "1.2.3",
                    "--json",
                    "number,title,url",
                ],
                vec![
                    "issue",
                    "list",
                    "--state",
                    "open",
                    "--label",
                    "v1.2.3",
                    "--json",
                    "number,title,url",
                ],
                vec![
                    "issue",
                    "list",
                    "--state",
                    "open",
                    "--label",
                    "1.2.3",
                    "--json",
                    "number,title,url",
                ],
            ]
        );
    }

    #[test]
    fn current_release_issue_text_ignores_comment_only_matches() {
        let content = serde_json::json!([
            {
                "number": 1,
                "title": "release: ship v1.2.3",
                "url": "https://github.com/flyingrobots/wesley/issues/1",
                "body": "release umbrella"
            },
            {
                "number": 2,
                "title": "future runtime work",
                "url": "https://github.com/flyingrobots/wesley/issues/2",
                "body": "No current release assignment here."
            },
            {
                "number": 3,
                "title": "future evidence work",
                "url": "https://github.com/flyingrobots/wesley/issues/3",
                "body": "Related PR comment mentions are not part of this JSON payload."
            },
            {
                "number": 4,
                "title": "version substring",
                "url": "https://github.com/flyingrobots/wesley/issues/4",
                "body": "v1.2.30 belongs to another release lane."
            },
            {
                "number": 5,
                "title": "bare version blocker",
                "url": "https://github.com/flyingrobots/wesley/issues/5",
                "body": "Must clear before 1.2.3."
            },
            {
                "number": 6,
                "title": "unrelated method migration",
                "url": "https://github.com/flyingrobots/wesley/issues/6",
                "body": "METHOD v2.1.0 migration text is not this release lane."
            }
        ])
        .to_string();

        let matches = parse_current_version_issue_text(&content, "v1.2.3", "1.2.3").unwrap();

        assert_eq!(matches.len(), 2);
        assert_eq!(
            matches[0].display,
            "#1 release: ship v1.2.3 https://github.com/flyingrobots/wesley/issues/1 (title/body text)"
        );
        assert_eq!(
            matches[1].display,
            "#5 bare version blocker https://github.com/flyingrobots/wesley/issues/5 (title/body text)"
        );
    }

    #[test]
    fn changelog_release_heading_requires_exact_dated_heading() {
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - 2026-05-21", "0.0.5"),
            ChangelogReleaseHeadingStatus::Dated
        );
        assert_eq!(
            changelog_release_heading_status("## [v0.0.5] - 2026-05-21", "0.0.5"),
            ChangelogReleaseHeadingStatus::Dated
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - 2024-02-29", "0.0.5"),
            ChangelogReleaseHeadingStatus::Dated
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - 2025-02-29", "0.0.5"),
            ChangelogReleaseHeadingStatus::MalformedDate
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5]", "0.0.5"),
            ChangelogReleaseHeadingStatus::Undated
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - soon", "0.0.5"),
            ChangelogReleaseHeadingStatus::MalformedDate
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - 2026-99-99", "0.0.5"),
            ChangelogReleaseHeadingStatus::MalformedDate
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.5] - 2026-05-21 release", "0.0.5"),
            ChangelogReleaseHeadingStatus::MalformedDate
        );
        assert_eq!(
            changelog_release_heading_status("## [0.0.4] - 2026-05-21", "0.0.5"),
            ChangelogReleaseHeadingStatus::Missing
        );
    }

    #[test]
    fn ci_green_skips_current_release_run_and_requires_prior_ci() {
        let runs = vec![
            serde_json::json!({
                "name": "Release",
                "status": "in_progress",
                "conclusion": null,
                "databaseId": 10
            }),
            serde_json::json!({
                "name": "Preflight",
                "status": "completed",
                "conclusion": "success",
                "databaseId": 11
            }),
        ];

        assert!(ci_green_failures_for_runs(&runs, Some(10), "abc123").is_empty());

        let current_only = vec![serde_json::json!({
            "name": "Release",
            "status": "in_progress",
            "conclusion": null,
            "databaseId": 10
        })];
        assert_eq!(
            ci_green_failures_for_runs(&current_only, Some(10), "abc123"),
            vec![
                "no GitHub Actions runs other than the current release workflow were found for HEAD commit abc123; CI must have run before tagging"
            ]
        );
    }

    #[test]
    fn ci_green_rejects_pending_failed_and_missing_conclusions() {
        let runs = vec![
            serde_json::json!({
                "name": "Pending",
                "status": "in_progress",
                "conclusion": null,
                "databaseId": 1
            }),
            serde_json::json!({
                "name": "Failed",
                "status": "completed",
                "conclusion": "failure",
                "databaseId": 2
            }),
            serde_json::json!({
                "name": "Missing conclusion",
                "status": "completed",
                "conclusion": null,
                "databaseId": 3
            }),
        ];

        assert_eq!(
            ci_green_failures_for_runs(&runs, None, "abc123"),
            vec![
                "CI run `Pending` is not yet completed (status: in_progress)",
                "CI run `Failed` did not pass (conclusion: failure)",
                "CI run `Missing conclusion` did not pass (conclusion: <missing>)"
            ]
        );
    }

    #[test]
    fn prior_version_issue_lanes_find_older_semver_labels_and_milestones() {
        let content = serde_json::json!([
            {
                "number": 1,
                "title": "Older label",
                "url": "https://github.com/flyingrobots/wesley/issues/1",
                "labels": [
                    { "name": "triage:bad-code" },
                    { "name": "v0.0.4" },
                    { "name": "v0.0.5" },
                    { "name": "v0.0.4+build" }
                ],
                "milestone": null
            },
            {
                "number": 2,
                "title": "Older milestone",
                "url": "https://github.com/flyingrobots/wesley/issues/2",
                "labels": [],
                "milestone": { "title": "0.0.3" }
            },
            {
                "number": 3,
                "title": "Current release",
                "url": "https://github.com/flyingrobots/wesley/issues/3",
                "labels": [{ "name": "v0.0.5" }],
                "milestone": { "title": "0.0.5" }
            }
        ])
        .to_string();

        let matches = parse_prior_version_issue_lanes(&content, "0.0.5").unwrap();

        assert_eq!(matches.len(), 2);
        assert_eq!(
            matches[0].display,
            "#1 Older label https://github.com/flyingrobots/wesley/issues/1 (prior version label `v0.0.4`)"
        );
        assert_eq!(
            matches[1].display,
            "#2 Older milestone https://github.com/flyingrobots/wesley/issues/2 (prior version milestone `0.0.3`)"
        );
        assert!(version_from_lane_name("v0.0.4").is_some());
        assert!(version_from_lane_name("triage:bad-code").is_none());
        assert!(version_from_lane_name("v0.0.4+build").is_none());
    }

    #[test]
    fn readme_version_headline_requires_exact_heading_line() {
        assert!(readme_has_exact_version_headline(
            "# Wesley\n\n## What's New in v0.0.5\n\nNotes",
            "0.0.5"
        ));
        assert!(!readme_has_exact_version_headline(
            "# Wesley\n\n## What's New in v0.0.50\n\nNotes",
            "0.0.5"
        ));
    }

    #[test]
    fn semver_rejects_leading_zeroes_and_empty_prereleases() {
        assert!(version_from_tag("v01.2.3").is_err());
        assert!(version_from_tag("v1.2.3-").is_err());
    }

    #[test]
    fn git_identity_guard_accepts_unset_or_collaborator_identities() {
        assert!(git_identity_failures(GitIdentityInput::default()).is_empty());
        assert!(git_identity_failures(GitIdentityInput {
            local_name: Some("Example Contributor"),
            local_email: Some("contributor@company.dev"),
            head_author_name: Some("Another Contributor"),
            head_author_email: Some("another@company.dev"),
            head_committer_name: Some("Release Operator"),
            head_committer_email: Some("release@company.dev"),
        })
        .is_empty());
    }

    #[test]
    fn git_identity_guard_rejects_known_fixture_identities() {
        assert_eq!(
            git_identity_failures(GitIdentityInput {
                local_name: Some("Wesley Tests"),
                local_email: Some("contributor@company.dev"),
                ..GitIdentityInput::default()
            }),
            vec!["local git user.name is a test identity: Wesley Tests"]
        );
        assert_eq!(
            git_identity_failures(GitIdentityInput {
                local_name: Some("Example Contributor"),
                local_email: Some("wesley-tests@example.com"),
                ..GitIdentityInput::default()
            }),
            vec!["local git user.email is a test identity: wesley-tests@example.com"]
        );
        assert_eq!(
            git_identity_failures(GitIdentityInput {
                local_name: Some("CI Test"),
                local_email: Some("test@ci.com"),
                ..GitIdentityInput::default()
            }),
            vec![
                "local git user.name is a test identity: CI Test",
                "local git user.email is a test identity: test@ci.com"
            ]
        );
    }

    #[test]
    fn git_identity_guard_rejects_fixture_identities_on_head_commits() {
        assert_eq!(
            git_identity_failures(GitIdentityInput {
                head_author_name: Some("Wesley Tests"),
                head_author_email: Some("wesley-tests@example.com"),
                head_committer_name: Some("CI Test"),
                head_committer_email: Some("test@ci.com"),
                ..GitIdentityInput::default()
            }),
            vec![
                "HEAD author name is a test identity: Wesley Tests",
                "HEAD author email is a test identity: wesley-tests@example.com",
                "HEAD committer name is a test identity: CI Test",
                "HEAD committer email is a test identity: test@ci.com"
            ]
        );
    }

    #[test]
    fn crate_readmes_do_not_use_repo_relative_links() {
        for (name, content) in [
            (
                "wesley-core",
                include_str!("../../crates/wesley-core/README.md"),
            ),
            (
                "wesley-cli",
                include_str!("../../crates/wesley-cli/README.md"),
            ),
            (
                "wesley-emit-rust",
                include_str!("../../crates/wesley-emit-rust/README.md"),
            ),
            (
                "wesley-emit-typescript",
                include_str!("../../crates/wesley-emit-typescript/README.md"),
            ),
        ] {
            assert!(
                !content.contains("../../"),
                "{name} README must use package-safe links"
            );
        }
    }

    #[test]
    fn node_retirement_front_door_doc_read_errors_are_check_failures() {
        let root = env::temp_dir().join(format!(
            "wesley-xtask-front-door-doc-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("temp root should be created");
        let ledger = serde_json::json!({
            "frontDoorDocs": ["missing.md"],
            "pnpmWesleyCompatibilityContext": ["legacy"]
        });
        let mut failures = Vec::new();

        let error = check_pnpm_wesley_front_door_docs(&root, &ledger, &mut failures)
            .expect_err("missing front-door doc should be a check failure");

        match error {
            Error::CheckFailed { check, failures } => {
                assert_eq!(check, "node retirement ledger");
                assert_eq!(failures.len(), 1);
                assert!(
                    failures[0].contains("front-door doc `missing.md` is missing or unreadable"),
                    "unexpected failure: {:?}",
                    failures
                );
            }
            other => panic!("expected CheckFailed, got {other:?}"),
        }
        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    #[test]
    fn node_retirement_package_metadata_requires_private_compatibility_warning() {
        let root = env::temp_dir().join(format!(
            "wesley-xtask-package-metadata-{}",
            std::process::id()
        ));
        let package_dir = root.join("packages/wesley-cli");
        fs::create_dir_all(&package_dir).expect("temp package dir should be created");
        fs::write(
            package_dir.join("package.json"),
            serde_json::json!({
                "name": "@wesley/cli",
                "version": "0.1.0",
                "type": "module"
            })
            .to_string(),
        )
        .expect("temp package json should be written");
        let ledger = serde_json::json!({
            "packages": [
                {
                    "path": "packages/wesley-cli",
                    "disposition": "delete-after-command-migration"
                }
            ]
        });
        let mut failures = Vec::new();

        check_legacy_package_metadata(&root, &ledger, &mut failures)
            .expect("metadata check should complete");

        assert_eq!(
            failures,
            vec![
                "packages/wesley-cli/package.json must set `private: true` while it remains in the legacy Node retirement ledger",
                "packages/wesley-cli/package.json must set `wesley.retirement.status` to `legacy-compatibility`",
                "packages/wesley-cli/package.json must include `wesley.retirement.ledger`",
                "packages/wesley-cli/package.json must include `wesley.retirement.disposition`",
            ]
        );
        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    #[test]
    fn node_retirement_retired_packages_must_stay_absent() {
        let root = env::temp_dir().join(format!(
            "wesley-xtask-retired-package-{}",
            std::process::id()
        ));
        let package_dir = root.join("packages/wesley-cli");
        fs::create_dir_all(&package_dir).expect("temp package dir should be created");
        fs::write(
            package_dir.join("package.json"),
            serde_json::json!({
                "name": "@wesley/cli",
                "version": "0.1.0",
                "type": "module"
            })
            .to_string(),
        )
        .expect("temp package json should be written");
        let ledger = serde_json::json!({
            "retiredPackages": [
                {
                    "path": "packages/wesley-cli",
                    "disposition": "deleted"
                }
            ]
        });
        let mut failures = Vec::new();

        check_retired_node_packages_absent(&root, &ledger, &mut failures);

        assert_eq!(
            failures,
            vec![
                "packages/wesley-cli is listed in retiredPackages but package.json exists; restore requires a new ledger disposition and explicit review",
            ]
        );
        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    #[test]
    fn legacy_core_package_metadata_changes_do_not_count_as_authority() {
        let old = serde_json::json!({
            "name": "@wesley/core",
            "version": "0.1.0",
            "type": "module",
            "description": "old description",
            "exports": {
                ".": "./src/index.mjs"
            },
            "dependencies": {
                "graphql": "^16.11.0"
            }
        });
        let current = serde_json::json!({
            "name": "@wesley/core",
            "version": "0.1.0",
            "private": true,
            "type": "module",
            "description": "Legacy compatibility JS core",
            "wesley": {
                "retirement": {
                    "status": "legacy-compatibility"
                }
            },
            "exports": {
                ".": "./src/index.mjs"
            },
            "dependencies": {
                "graphql": "^16.11.0"
            }
        });
        let authority_change = serde_json::json!({
            "name": "@wesley/core",
            "version": "0.1.0",
            "private": true,
            "type": "module",
            "description": "Legacy compatibility JS core",
            "wesley": {
                "retirement": {
                    "status": "legacy-compatibility"
                }
            },
            "exports": {
                ".": "./src/index.mjs",
                "./new-authority": "./src/new-authority.mjs"
            },
            "dependencies": {
                "graphql": "^16.11.0"
            }
        });

        assert_eq!(
            package_json_without_retirement_metadata(&old),
            package_json_without_retirement_metadata(&current)
        );
        assert_ne!(
            package_json_without_retirement_metadata(&old),
            package_json_without_retirement_metadata(&authority_change)
        );
    }

    #[test]
    fn release_procedure_uses_version_placeholder_in_install_example() {
        let doc = include_str!("../../docs/CRATES_IO_RELEASE.md");
        assert!(
            !doc.contains("cargo install wesley-cli --version 0.0.1"),
            "release procedure should not hardcode the first alpha version"
        );
    }

    #[test]
    fn release_procedure_lists_all_publish_crates() {
        let doc = include_str!("../../docs/CRATES_IO_RELEASE.md");
        for publish_crate in PUBLISH_CRATES {
            let table_entry = format!("| `{}`", publish_crate.name);
            assert!(
                doc.contains(&table_entry),
                "release procedure should list `{}` in Published Units",
                publish_crate.name
            );
        }
    }

    // --- looks_like_file_path ---

    #[test]
    fn file_path_accepts_repo_relative_paths_with_known_prefix() {
        assert!(looks_like_file_path("crates/wesley-core/src/lib.rs"));
        assert!(looks_like_file_path("docs/GUIDE.md"));
        assert!(looks_like_file_path("src/main.rs"));
        assert!(looks_like_file_path("xtask/src/main.rs"));
        assert!(looks_like_file_path("scripts/preflight.sh"));
        assert!(looks_like_file_path("test/fixtures/schema.graphql"));
        assert!(looks_like_file_path(".github/workflows/ci.yml"));
    }

    #[test]
    fn file_path_accepts_paths_with_extension_and_slash() {
        assert!(looks_like_file_path("some/path/file.toml"));
        assert!(looks_like_file_path("a/b.rs"));
    }

    #[test]
    fn file_path_rejects_strings_without_slash() {
        assert!(!looks_like_file_path("GUIDE.md"));
        assert!(!looks_like_file_path("cargo-audit"));
        assert!(!looks_like_file_path("v0.0.5"));
        assert!(!looks_like_file_path("hello"));
    }

    #[test]
    fn file_path_rejects_shell_commands_with_paths() {
        assert!(looks_like_file_path("test/ci-workflows.bats"));
        assert!(!looks_like_file_path(
            "BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats"
        ));
    }

    #[test]
    fn file_path_rejects_http_and_https_urls() {
        // C-1 / H-1: URLs with file-extension last-components must not trigger file-existence checks
        assert!(!looks_like_file_path(
            "https://github.com/flyingrobots/wesley/blob/main/docs/GUIDE.md"
        ));
        assert!(!looks_like_file_path("http://example.com/path/to/file.rs"));
        assert!(!looks_like_file_path("https://example.com/README.md"));
    }

    // --- looks_like_commit_sha ---

    #[test]
    fn commit_sha_accepts_exactly_40_lowercase_hex_chars() {
        assert!(looks_like_commit_sha(
            "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        ));
        assert!(looks_like_commit_sha(&"f".repeat(40)));
        assert!(looks_like_commit_sha(&"0".repeat(40)));
    }

    #[test]
    fn commit_sha_rejects_wrong_length() {
        assert!(!looks_like_commit_sha("abc123")); // too short
        assert!(!looks_like_commit_sha(&"a".repeat(39))); // 39
        assert!(!looks_like_commit_sha(&"a".repeat(41))); // 41
    }

    #[test]
    fn commit_sha_rejects_non_hex_chars() {
        assert!(!looks_like_commit_sha(&"g".repeat(40)));
        assert!(!looks_like_commit_sha(&"z".repeat(40)));
        // git SHAs are hex — mixed case is acceptable since git is case-insensitive
        assert!(looks_like_commit_sha(
            "A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2"
        ));
    }

    #[test]
    fn git_revision_exists_requires_commit_objects() {
        let head_tree = git_output(&["rev-parse", "HEAD^{tree}"]).unwrap();

        assert!(git_revision_exists("HEAD").unwrap());
        assert!(!git_revision_exists(&head_tree).unwrap());
    }

    // --- extract_backtick_content ---

    #[test]
    fn backtick_content_extracts_inline_spans() {
        assert_eq!(extract_backtick_content("hello `world` foo"), vec!["world"]);
        assert_eq!(extract_backtick_content("`a` and `b`"), vec!["a", "b"]);
    }

    #[test]
    fn backtick_content_skips_empty_and_multiline() {
        assert!(extract_backtick_content("no backticks").is_empty());
        assert!(extract_backtick_content("unpaired `tick").is_empty());
        // multi-line span is discarded
        assert!(extract_backtick_content("text `first line\nsecond line` more").is_empty());
    }

    #[test]
    fn backtick_content_handles_back_to_back_pairs() {
        assert_eq!(extract_backtick_content("`foo``bar`"), vec!["foo", "bar"]);
    }

    // --- previous_tag_from_sorted_list ---

    #[test]
    fn previous_tag_returns_tag_immediately_before_current_in_sorted_list() {
        let tags = vec!["v0.1.0", "v0.0.5", "v0.0.4", "v0.0.3"];
        assert_eq!(
            previous_tag_from_sorted_list(&tags, "v0.1.0"),
            Some("v0.0.5")
        );
        assert_eq!(
            previous_tag_from_sorted_list(&tags, "v0.0.5"),
            Some("v0.0.4")
        );
    }

    #[test]
    fn previous_tag_returns_none_for_earliest_tag_and_unknown_tag() {
        let tags = vec!["v0.1.0", "v0.0.5", "v0.0.3"];
        assert_eq!(previous_tag_from_sorted_list(&tags, "v0.0.3"), None);
        assert_eq!(previous_tag_from_sorted_list(&tags, "v99.0.0"), None);
    }

    // --- teardown_contains_version ---

    #[test]
    fn teardown_version_check_requires_v_prefix_and_rejects_substrings() {
        // C-1: bare contains(version) would falsely pass "v0.0.50" for version "0.0.5"
        assert!(!teardown_contains_version(
            "The doc covers v0.0.50 changes.",
            "0.0.5"
        ));
        assert!(!teardown_contains_version(
            "The doc covers v0.0.5-alpha changes.",
            "0.0.5"
        ));
        assert!(!teardown_contains_version(
            "The doc covers v0.0.5+build changes.",
            "0.0.5"
        ));
        assert!(!teardown_contains_version(
            "The doc covers av0.0.5 token.",
            "0.0.5"
        ));
        assert!(!teardown_contains_version(
            "The doc covers v0.0.5_rc token.",
            "0.0.5"
        ));
        assert!(!teardown_contains_version(
            "No version mentioned at all.",
            "0.0.5"
        ));
        // Correct case: doc contains v{version} with v prefix
        assert!(teardown_contains_version(
            "Released v0.0.5 on June 5.",
            "0.0.5"
        ));
    }
}
