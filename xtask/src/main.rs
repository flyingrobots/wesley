//! Repository automation for Wesley.

use ninelives::{Backoff, Jitter, ResilienceError, RetryPolicy};
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
const PUBLISH_CRATES: &[PublishCrate] = &[
    PublishCrate {
        name: "wesley-core",
        dependencies: &[],
    },
    PublishCrate {
        name: "wesley-emit-rust",
        dependencies: &["wesley-core"],
    },
    PublishCrate {
        name: "wesley-emit-typescript",
        dependencies: &["wesley-core"],
    },
    PublishCrate {
        name: "wesley-cli",
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
            run_docs_check()?;
            run_command("cargo", &["test", "--workspace"])?;
            run_command("cargo", &["run", "--bin", "wesley", "--", "--help"])
        }
        "docs-check" => run_docs_check(),
        "publish-alpha" => run_publish_alpha(&args[1..]),
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

fn run_publish_alpha(args: &[OsString]) -> Result<(), Error> {
    let options = PublishOptions::parse(args)?;

    if options.execute {
        assert_clean_worktree()?;
        if !options.skip_checks {
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
            publish_crate_to_crates_io(publish_crate.name)?;
            wait_for_crate_version(publish_crate.name, ALPHA_VERSION)?;
        }
        println!("xtask: published Wesley alpha {ALPHA_VERSION}");
        Ok(())
    } else {
        print_publish_alpha_plan();
        run_publish_alpha_dry_run()
    }
}

fn print_publish_alpha_plan() {
    println!("Wesley crates.io alpha publish plan");
    println!();
    println!("Version: {ALPHA_VERSION}");
    println!("Mode: dry-run/plan. Pass --execute for real crates.io uploads.");
    println!();
    println!("Publish order:");
    for publish_crate in PUBLISH_CRATES {
        println!(" - {}", publish_crate.name);
    }
    println!();
}

fn run_publish_alpha_dry_run() -> Result<(), Error> {
    for publish_crate in PUBLISH_CRATES {
        let missing_dependencies = publish_crate
            .dependencies
            .iter()
            .filter(|dependency| !crate_version_is_indexed(dependency, ALPHA_VERSION))
            .copied()
            .collect::<Vec<_>>();

        if missing_dependencies.is_empty() {
            run_command(
                "cargo",
                &[
                    "publish",
                    "--dry-run",
                    "--allow-dirty",
                    "-p",
                    publish_crate.name,
                ],
            )?;
        } else {
            println!(
                "xtask: skipping dry-run for {} until crates.io indexes {}",
                publish_crate.name,
                missing_dependencies.join(", ")
            );
        }
    }

    Ok(())
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
    const IGNORED_DIRS: &[&str] = &[".git", "node_modules", ".wesley", "out"];

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
  publish-alpha     Publish the crates.io alpha package set; dry-run by default
  release-check     Build and package the native Rust release artifacts
  legacy-preflight  Run the historical pnpm package preflight
  help              Show help

Publish options:
  cargo xtask publish-alpha            Print plan and run safe dry-runs
  cargo xtask publish-alpha --execute  Publish crates in dependency order
  cargo xtask publish-alpha --execute --skip-checks"
    );
}

struct PublishCrate {
    name: &'static str,
    dependencies: &'static [&'static str],
}

#[derive(Default)]
struct PublishOptions {
    execute: bool,
    skip_checks: bool,
}

impl PublishOptions {
    fn parse(args: &[OsString]) -> Result<Self, Error> {
        let mut options = Self::default();
        for arg in args {
            let Some(arg) = arg.to_str() else {
                return Err(Error::Usage(
                    "publish-alpha options must be UTF-8".to_string(),
                ));
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
                "--help" | "-h" => {
                    print_help();
                    return Err(Error::Usage(
                        "publish-alpha help requested; see usage above".to_string(),
                    ));
                }
                other => {
                    return Err(Error::Usage(format!(
                        "unknown publish-alpha option `{other}`"
                    )));
                }
            }
        }
        Ok(options)
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
