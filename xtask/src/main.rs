//! Repository automation for Wesley.

use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitCode};

const EXIT_OK: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const EXIT_USAGE: u8 = 2;

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
  release-check     Build and package the native Rust release artifacts
  legacy-preflight  Run the historical pnpm package preflight
  help              Show help"
    );
}

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
