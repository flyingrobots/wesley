//! Repository automation for Wesley.

use ninelives::{Backoff, Jitter, ResilienceError, RetryPolicy};
use semver::Version;
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
const PUBLISH_CRATES: &[PublishCrate] = &[
    PublishCrate {
        name: "wesley-core",
        path: "crates/wesley-core",
        dependencies: &[],
    },
    PublishCrate {
        name: "wesley-emit-rust",
        path: "crates/wesley-emit-rust",
        dependencies: &["wesley-core"],
    },
    PublishCrate {
        name: "wesley-emit-typescript",
        path: "crates/wesley-emit-typescript",
        dependencies: &["wesley-core"],
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
        "preflight" => {
            check_git_identity_guard()?;
            run_docs_check()?;
            run_command("cargo", &["test", "--workspace"])?;
            run_command("cargo", &["run", "--bin", "wesley", "--", "--help"])
        }
        "docs-check" => run_docs_check(),
        "package-crates" => run_package_crates(&args[1..]),
        "publish-alpha" => {
            run_publish_crates(&args[1..], Some(ALPHA_VERSION), "publish-alpha", true)
        }
        "publish-crates" => run_publish_crates(&args[1..], None, "publish-crates", false),
        "release-prep-guard" => run_release_prep_guard(&args[1..]),
        "release-guard" => run_release_guard(&args[1..]),
        "release-check" => {
            run_command("cargo", &["test", "--workspace"])?;
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
        "legacy-preflight" => run_command("pnpm", &["run", "preflight"]),
        other => Err(Error::Usage(format!("unknown xtask command `{other}`"))),
    }
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
            run_docs_check()?;
            run_command("cargo", &["test", "--workspace"])?;
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
            run_command("cargo", &["xtask", "release-check"])?;
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
    check_release_backlog_clear(&tag, &options.version)?;
    check_package_file_sets()?;
    println!("xtask: release prep guard passed for {}", options.version);
    Ok(())
}

fn run_release_guard_for_tag(tag: &str) -> Result<(), Error> {
    let version = version_from_tag(tag)?;
    check_git_identity_guard()?;
    check_release_tag_points_to_head(tag)?;
    check_release_tag_is_on_main(tag)?;
    check_publish_manifest_versions(&version)?;
    check_release_required_files(&version)?;
    check_release_backlog_clear(tag, &version)?;
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
        let version_heading = format!("## [{version}]");
        let v_version_heading = format!("## [v{version}]");
        if !changelog.contains(&version_heading) && !changelog.contains(&v_version_heading) {
            failures.push(format!(
                "CHANGELOG.md has no release notes section for {version}"
            ));
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
    Ok(())
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
  preflight         Run native Rust preflight checks
  package-crates    Check package file sets for the crates.io release set
  publish-alpha     Publish the crates.io alpha package set; dry-run by default
  publish-crates    Publish crates.io package set for a release tag
  release-prep-guard Verify release prep before a tag exists
  release-guard     Verify that a release tag is eligible to publish
  release-check     Build and package the native Rust release artifacts
  legacy-preflight  Run the historical pnpm package preflight
  help              Show help

Publish options:
  cargo xtask publish-alpha                    Print alpha plan and run safe dry-runs
  cargo xtask publish-alpha --execute          CI tag-only compatibility publish path
  cargo xtask package-crates --tag vX.Y.Z      Check release package file sets
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
    fn release_procedure_uses_version_placeholder_in_install_example() {
        let doc = include_str!("../../docs/CRATES_IO_RELEASE.md");
        assert!(
            !doc.contains("cargo install wesley-cli --version 0.0.1"),
            "release procedure should not hardcode the first alpha version"
        );
    }
}
