//! Repository automation for Wesley.

mod built_cli;
mod docs_replay;

use ninelives::{Backoff, Jitter, ResilienceError, RetryPolicy};
use semver::Version;
use std::collections::BTreeMap;
use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::{Duration, Instant};

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
const NODE_RETIREMENT_LEDGER: &str = "xtask/node-retirement-ledger.json";
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
const UNPUBLISHED_CARGO_VERSION_SOURCES: &[CargoVersionSource] = &[CargoVersionSource {
    name: "wesley-holmes",
    path: "crates/wesley-holmes",
    publish: false,
}];

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
        "bench-ir" => run_bench_ir(&args[1..]),
        "preflight" | "strict-preflight" => run_preflight(),
        "docs-check" => run_docs_check(),
        "lean-core-check" => run_lean_core_check(),
        "built-cli" => built_cli::print_path(),
        "docs-replay" => docs_replay::run(),
        "release-autotag-plan" => run_release_autotag_plan(),
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
    // JavaScript dependency advisories are covered by the dependency-review
    // workflow and Dependabot. `pnpm audit` is intentionally not run here: npm
    // retired its audit endpoint (HTTP 410), so the call always fails, and the
    // Rust-native compiler preflight should not depend on npm registry health.
    run_docs_check()?;
    run_command("cargo", &["test", "--workspace"])?;
    run_lean_core_check()?;
    run_command("cargo", &["run", "--bin", "wesley", "--", "--help"])?;
    docs_replay::run()
}

fn run_bench_ir(args: &[OsString]) -> Result<(), Error> {
    let options = BenchIrOptions::parse(args)?;

    let root = env::current_dir()
        .map_err(|source| Error::Usage(format!("failed to resolve current directory: {source}")))?;
    let wesley_bin = build_wesley_for_bench(options.json)?;
    let bench_root = env::temp_dir().join(format!(
        "wesley-bench-ir-{}-{}",
        std::process::id(),
        git_output(&["rev-parse", "--short", "HEAD"]).unwrap_or_else(|_| "unknown".to_string())
    ));
    if bench_root.exists() {
        fs::remove_dir_all(&bench_root).map_err(|source| {
            Error::Usage(format!(
                "failed to remove stale benchmark dir `{}`: {source}",
                bench_root.display()
            ))
        })?;
    }
    fs::create_dir_all(&bench_root).map_err(|source| {
        Error::Usage(format!(
            "failed to create benchmark dir `{}`: {source}",
            bench_root.display()
        ))
    })?;

    let mut fixture_reports = Vec::new();
    for fixture in bench_ir_fixtures() {
        let schema_path = bench_root.join(format!("{}.graphql", fixture.name));
        fs::write(&schema_path, &fixture.schema).map_err(|source| {
            Error::Usage(format!(
                "failed to write benchmark fixture `{}`: {source}",
                schema_path.display()
            ))
        })?;

        for _ in 0..options.warmups {
            run_wesley_schema_lower(&wesley_bin, &schema_path)?;
        }

        let mut output_bytes = 0usize;
        let mut counts = IrMetricCounts::default();
        let mut samples_ms = Vec::new();
        for _ in 0..options.iterations {
            let start = Instant::now();
            let output = run_wesley_schema_lower(&wesley_bin, &schema_path)?;
            let elapsed = start.elapsed();
            output_bytes = output.len();
            let ir: serde_json::Value = serde_json::from_slice(&output).map_err(|source| {
                Error::Usage(format!(
                    "benchmark output for `{}` is not valid JSON: {source}",
                    fixture.name
                ))
            })?;
            counts = ir_metric_counts(&ir);
            samples_ms.push(duration_ms(elapsed));
        }

        let summary = sample_summary(&samples_ms);
        fixture_reports.push(serde_json::json!({
            "name": fixture.name,
            "schemaBytes": fixture.schema.len(),
            "outputBytes": output_bytes,
            "typeCount": counts.type_count,
            "fieldCount": counts.field_count,
            "directiveCount": counts.directive_count,
            "operationCount": counts.operation_count,
            "samplesMs": samples_ms,
            "minMs": summary.min,
            "medianMs": summary.median,
            "meanMs": summary.mean,
            "maxMs": summary.max
        }));
    }

    let _ = fs::remove_dir_all(&bench_root);

    let report = serde_json::json!({
        "apiVersion": "wesley.ir-benchmark/v1",
        "advisory": true,
        "gitHead": git_output(&["rev-parse", "HEAD"]).unwrap_or_else(|_| "unknown".to_string()),
        "command": "cargo xtask bench-ir",
        "lowerer": display_path(&root, &wesley_bin),
        "warmups": options.warmups,
        "iterations": options.iterations,
        "memory": {
            "peakRss": "not-captured"
        },
        "fixtures": fixture_reports
    });

    if let Some(output_path) = &options.output {
        if let Some(parent) = output_path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            fs::create_dir_all(parent).map_err(|source| {
                Error::Usage(format!(
                    "failed to create benchmark output dir `{}`: {source}",
                    parent.display()
                ))
            })?;
        }
        fs::write(output_path, serde_json::to_vec_pretty(&report).unwrap()).map_err(|source| {
            Error::Usage(format!(
                "failed to write benchmark report `{}`: {source}",
                output_path.display()
            ))
        })?;
    }

    if options.json {
        println!("{}", serde_json::to_string_pretty(&report).unwrap());
    } else {
        print_bench_ir_summary(&report);
        if let Some(output_path) = &options.output {
            println!("report: {}", output_path.display());
        }
    }

    Ok(())
}

fn build_wesley_for_bench(json_output: bool) -> Result<PathBuf, Error> {
    // Announced on stdout only when stdout is not the JSON report.
    built_cli::build_wesley(!json_output)
}

fn run_wesley_schema_lower(wesley_bin: &Path, schema_path: &Path) -> Result<Vec<u8>, Error> {
    let output = Command::new(wesley_bin)
        .args(["schema", "lower", "--schema"])
        .arg(schema_path)
        .arg("--json")
        .output()
        .map_err(|source| {
            Error::Usage(format!(
                "failed to spawn `{}` schema lower: {source}",
                wesley_bin.display()
            ))
        })?;

    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(Error::Usage(format!(
            "benchmark lower failed for `{}`\nstderr:\n{}",
            schema_path.display(),
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}

fn print_bench_ir_summary(report: &serde_json::Value) {
    println!("Wesley IR benchmark advisory report");
    println!(
        "apiVersion: {}",
        report["apiVersion"].as_str().unwrap_or("")
    );
    println!("memory.peakRss: not-captured");
    println!();
    println!(
        "{:<28} {:>7} {:>7} {:>7} {:>7} {:>9} {:>9}",
        "fixture", "types", "fields", "dirs", "ops", "median", "output"
    );
    for fixture in report["fixtures"].as_array().into_iter().flatten() {
        println!(
            "{:<28} {:>7} {:>7} {:>7} {:>7} {:>8.3}ms {:>9}",
            fixture["name"].as_str().unwrap_or(""),
            fixture["typeCount"].as_u64().unwrap_or(0),
            fixture["fieldCount"].as_u64().unwrap_or(0),
            fixture["directiveCount"].as_u64().unwrap_or(0),
            fixture["operationCount"].as_u64().unwrap_or(0),
            fixture["medianMs"].as_f64().unwrap_or(0.0),
            fixture["outputBytes"].as_u64().unwrap_or(0)
        );
    }
}

fn duration_ms(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn sample_summary(samples: &[f64]) -> SampleSummary {
    let mut sorted = samples.to_vec();
    sorted.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    let sum: f64 = sorted.iter().sum();
    let median = match sorted.len() {
        0 => 0.0,
        len if len % 2 == 1 => sorted[len / 2],
        len => (sorted[(len / 2) - 1] + sorted[len / 2]) / 2.0,
    };
    SampleSummary {
        min: sorted.first().copied().unwrap_or(0.0),
        median,
        mean: if sorted.is_empty() {
            0.0
        } else {
            sum / sorted.len() as f64
        },
        max: sorted.last().copied().unwrap_or(0.0),
    }
}

fn ir_metric_counts(ir: &serde_json::Value) -> IrMetricCounts {
    let mut counts = IrMetricCounts::default();
    let Some(types) = ir.get("types").and_then(serde_json::Value::as_array) else {
        return counts;
    };

    counts.type_count = types.len();
    for type_def in types {
        counts.directive_count += directive_count(type_def);
        let fields = type_def
            .get("fields")
            .and_then(serde_json::Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        counts.field_count += fields.len();

        let type_name = type_def
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if matches!(type_name, "Query" | "Mutation" | "Subscription") {
            counts.operation_count += fields.len();
        }

        for field in fields {
            counts.directive_count += directive_count(field);
            for argument in field
                .get("arguments")
                .and_then(serde_json::Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or(&[])
            {
                counts.directive_count += directive_count(argument);
            }
        }
    }

    counts
}

fn directive_count(value: &serde_json::Value) -> usize {
    value
        .get("directives")
        .and_then(serde_json::Value::as_object)
        .map(|directives| {
            directives
                .values()
                .map(|directive| directive.as_array().map(Vec::len).unwrap_or(1))
                .sum()
        })
        .unwrap_or(0)
}

fn bench_ir_fixtures() -> Vec<BenchIrFixture> {
    vec![
        BenchIrFixture {
            name: "wide-schema",
            schema: wide_schema_fixture(),
        },
        BenchIrFixture {
            name: "deep-input-schema",
            schema: deep_input_schema_fixture(),
        },
        BenchIrFixture {
            name: "directive-heavy-schema",
            schema: directive_heavy_schema_fixture(),
        },
        BenchIrFixture {
            name: "operation-heavy-schema",
            schema: operation_heavy_schema_fixture(),
        },
        BenchIrFixture {
            name: "extension-folding-schema",
            schema: extension_folding_schema_fixture(),
        },
    ]
}

fn wide_schema_fixture() -> String {
    let mut sdl = String::new();
    sdl.push_str("type Query {\n");
    for index in 0..75 {
        sdl.push_str(&format!("  item{index}(id: ID!): Item{index}\n"));
    }
    sdl.push_str("}\n\n");
    for index in 0..75 {
        sdl.push_str(&format!("type Item{index} {{\n"));
        sdl.push_str("  id: ID!\n");
        for field in 0..8 {
            sdl.push_str(&format!("  field{field}: String\n"));
        }
        sdl.push_str("}\n\n");
    }
    sdl
}

fn deep_input_schema_fixture() -> String {
    let mut sdl = String::from("type Query {\n  search(input: Input0): String\n}\n\n");
    for index in 0..32 {
        sdl.push_str(&format!("input Input{index} {{\n"));
        sdl.push_str("  value: String\n");
        if index < 31 {
            sdl.push_str(&format!("  next: Input{}\n", index + 1));
        }
        sdl.push_str("}\n\n");
    }
    sdl
}

fn directive_heavy_schema_fixture() -> String {
    let mut sdl = String::from(
        "directive @tag(value: String) repeatable on OBJECT | FIELD_DEFINITION | ARGUMENT_DEFINITION\n\n",
    );
    sdl.push_str("type Query @tag(value: \"root\") {\n");
    for index in 0..120 {
        sdl.push_str(&format!(
            "  field{index}(arg: String @tag(value: \"arg{index}\")): String @tag(value: \"field{index}\")\n"
        ));
    }
    sdl.push_str("}\n");
    sdl
}

fn operation_heavy_schema_fixture() -> String {
    let mut sdl = String::from("type Query {\n");
    for index in 0..160 {
        sdl.push_str(&format!(
            "  queryOp{index}(id: ID!, filter: String): String\n"
        ));
    }
    sdl.push_str("}\n\n");
    sdl.push_str("type Mutation {\n");
    for index in 0..80 {
        sdl.push_str(&format!("  mutationOp{index}(input: String!): Boolean!\n"));
    }
    sdl.push_str("}\n");
    sdl
}

fn extension_folding_schema_fixture() -> String {
    let mut sdl =
        String::from("directive @tag(value: String) repeatable on OBJECT | FIELD_DEFINITION\n\n");
    sdl.push_str("type Query {\n  thing: Thing\n}\n\n");
    sdl.push_str("type Thing @tag(value: \"base\") {\n  id: ID!\n}\n\n");
    for index in 0..90 {
        sdl.push_str(&format!(
            "extend type Thing {{\n  extField{index}: String @tag(value: \"ext{index}\")\n}}\n\n"
        ));
    }
    sdl
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
    check_release_tag_is_annotated(tag)?;
    check_release_tag_is_on_main(tag)?;
    assert_clean_worktree()?;
    check_publish_manifest_versions(&version)?;
    check_release_required_files(&version)?;
    check_release_tracker_clear(tag, &version)?;
    check_no_wip_fixup_commits(tag)?;
    check_breaking_change_version_bump(tag, &version)?;
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

/// Why a release tag's object type is unacceptable, or `None` when it is an
/// annotated tag. `object_type` is what `git cat-file -t refs/tags/<tag>` prints.
fn release_tag_object_failure(tag: &str, object_type: &str) -> Option<String> {
    match object_type {
        "tag" => None,
        "commit" => Some(format!(
            "tag `{tag}` is a lightweight tag; release tags are annotated"
        )),
        other => Some(format!(
            "tag `{tag}` names a `{other}` object; release tags are annotated tags"
        )),
    }
}

/// Release tags are annotated: autotag creates them with `git tag -a`, and the
/// manual fallback signs them. A lightweight tag peels to the same commit, so
/// every other tag check would pass it.
fn check_release_tag_is_annotated(tag: &str) -> Result<(), Error> {
    let reference = format!("refs/tags/{tag}");
    let object_type = git_output(&["cat-file", "-t", reference.as_str()])?;
    release_tag_object_failure(tag, object_type.trim()).map_or(Ok(()), |failure| {
        Err(Error::CheckFailed {
            check: "release tag".to_string(),
            failures: vec![failure],
        })
    })
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
    check_publish_manifest_versions_at(&root, version)
}

fn check_publish_manifest_versions_at(root: &Path, version: &str) -> Result<(), Error> {
    let publish_crate_names = PUBLISH_CRATES
        .iter()
        .map(|publish_crate| publish_crate.name)
        .collect::<Vec<_>>();
    let mut failures = Vec::new();

    check_root_package_version(root, version, &mut failures);

    for source in UNPUBLISHED_CARGO_VERSION_SOURCES {
        check_cargo_version_source(root, source, version, &mut failures);
    }

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

fn check_cargo_version_source(
    root: &Path,
    source: &CargoVersionSource,
    version: &str,
    failures: &mut Vec<String>,
) {
    let manifest_path = root.join(source.path).join("Cargo.toml");
    let manifest = match read_toml_manifest(&manifest_path) {
        Ok(manifest) => manifest,
        Err(failure) => {
            failures.push(failure);
            return;
        }
    };

    let Some(package) = manifest.get("package").and_then(toml::Value::as_table) else {
        failures.push(format!("{} is missing [package]", source.path));
        return;
    };

    let name = package
        .get("name")
        .and_then(toml::Value::as_str)
        .unwrap_or_default();
    if name != source.name {
        failures.push(format!(
            "{} package.name is `{name}`, expected `{}`",
            source.path, source.name
        ));
    }

    let manifest_version = package
        .get("version")
        .and_then(toml::Value::as_str)
        .unwrap_or_default();
    if manifest_version != version {
        failures.push(format!(
            "{} version is `{manifest_version}`, expected `{version}`",
            source.path
        ));
    }

    let publish = package.get("publish").and_then(toml::Value::as_bool);
    if publish != Some(source.publish) {
        failures.push(format!(
            "{} publish is `{}`, expected `{}`",
            source.path,
            publish
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unset".to_string()),
            source.publish
        ));
    }
}

fn check_root_package_version(root: &Path, version: &str, failures: &mut Vec<String>) {
    let path = root.join("package.json");
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(source) => {
            failures.push(format!("package.json is missing or unreadable: {source}"));
            return;
        }
    };

    let manifest: serde_json::Value = match serde_json::from_str(&content) {
        Ok(manifest) => manifest,
        Err(source) => {
            failures.push(format!("package.json is malformed JSON: {source}"));
            return;
        }
    };

    let manifest_version = manifest
        .get("version")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if manifest_version != version {
        failures.push(format!(
            "package.json version is `{manifest_version}`, expected `{version}`"
        ));
    }
}

const DEPENDENCY_SECTIONS: [&str; 3] = ["dependencies", "dev-dependencies", "build-dependencies"];

/// The dependency sections declared directly in `scope`, which is a manifest or
/// one `[target.<spec>]` table. `prefix` labels them for reporting.
fn dependency_sections_of<'a>(
    scope: &'a toml::Value,
    prefix: &str,
) -> Vec<(String, &'a toml::value::Table)> {
    DEPENDENCY_SECTIONS
        .iter()
        .filter_map(|section_name| {
            let table = scope.get(section_name)?.as_table()?;
            Some((format!("{prefix}{section_name}"), table))
        })
        .collect()
}

/// Every dependency table a manifest can declare, with the label used to report
/// it: the three top-level sections, and the same three under each
/// `[target.<spec>]`.
fn dependency_tables(manifest: &toml::Value) -> Vec<(String, &toml::value::Table)> {
    let mut tables = dependency_sections_of(manifest, "");
    if let Some(targets) = manifest.get("target").and_then(toml::Value::as_table) {
        for (target_spec, target) in targets {
            tables.extend(dependency_sections_of(
                target,
                &format!("target.{target_spec}."),
            ));
        }
    }
    tables
}

fn check_dependency_hygiene(
    publish_crate: &PublishCrate,
    manifest: &toml::Value,
    version: &str,
    publish_crate_names: &[&str],
    failures: &mut Vec<String>,
) {
    // Published crates are versioned in lockstep, so a sibling is pinned
    // exactly. A bare `"X.Y.Z"` is a caret requirement: for a pre-release it
    // admits every later `X.Y` release, and an unlocked install of an older
    // release would then resolve newer siblings.
    let sibling_requirement = format!("={version}");
    for (section_name, dependencies) in dependency_tables(manifest) {
        for (dependency_name, dependency) in dependencies {
            // A dependency's key may be an alias; `package` names the crate
            // Cargo resolves, so sibling identity comes from there.
            let package_name = dependency
                .get("package")
                .and_then(toml::Value::as_str)
                .unwrap_or(dependency_name);
            let is_sibling = publish_crate_names.contains(&package_name);
            // Cargo accepts a requirement as a bare string or as the `version`
            // key of a table; both forms are read so neither escapes the check.
            let requirement = dependency
                .as_str()
                .or_else(|| dependency.get("version").and_then(toml::Value::as_str))
                .unwrap_or_default();

            if let Some(dependency_table) = dependency.as_table() {
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
                if dependency_table.contains_key("path")
                    && (!is_sibling || requirement != sibling_requirement)
                {
                    failures.push(format!(
                        "{} {section_name}.{dependency_name} has registry-incompatible path dependency",
                        publish_crate.path
                    ));
                }
            }

            if is_sibling && requirement != sibling_requirement {
                failures.push(format!(
                    "{} {section_name}.{dependency_name} version requirement is `{requirement}`, expected `{sibling_requirement}`",
                    publish_crate.path
                ));
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

fn check_release_tracker_clear(tag: &str, version: &str) -> Result<(), Error> {
    check_release_issue_tracker_clear(tag, version)
}

fn is_release_version_boundary(ch: Option<char>) -> bool {
    match ch {
        None => true,
        Some(c) => !c.is_ascii_alphanumeric() && c != '.' && c != '-' && c != '+' && c != '_',
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

fn display_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// What the autotag workflow should do with one push to `main`.
#[derive(Debug, PartialEq, Eq)]
enum AutotagDecision {
    /// Create this annotated tag at the pushed commit.
    Tag(String),
    /// Create nothing, for this reason. Skipping is the normal outcome: most
    /// pushes to `main` are not release-prep merges.
    Skip(String),
}

/// The facts about one push to `main` that decide whether it is tagged.
struct AutotagInput<'a> {
    /// The version the primary version source declares at the pushed commit.
    version: &'a str,
    /// The head branch of the merged pull request, if the commit has one.
    head_branch: Option<&'a str>,
    /// The title of that pull request.
    pr_title: Option<&'a str>,
    /// The commit being considered: `HEAD` of the pushed `main`.
    head_commit: &'a str,
    /// The expected tag, if it already exists.
    existing_tag: Option<ExistingTag<'a>>,
}

/// A release tag that already exists in the repository.
#[derive(Clone, Copy)]
struct ExistingTag<'a> {
    /// The commit the tag peels to.
    commit: &'a str,
    /// Whether the ref names a tag object rather than the commit itself.
    annotated: bool,
}

/// Decides whether a push to `main` is a release-prep merge that earns a tag.
///
/// Follows the Continuum release runbook, section 16: a branch name is useful
/// but is not the only line of defense, so the pull request's title must name
/// the same version its branch does. A push that is not a release-prep merge is
/// skipped. A push that *claims* to be one and disagrees with itself is an
/// error, because tagging the wrong commit cannot be undone.
fn autotag_decision(input: &AutotagInput<'_>) -> Result<AutotagDecision, Error> {
    let version = version_from_release_arg(input.version)?;
    let tag = format!("v{version}");

    let (Some(head_branch), Some(pr_title)) = (input.head_branch, input.pr_title) else {
        return Ok(AutotagDecision::Skip(
            "the pushed commit has no merged pull request".to_string(),
        ));
    };
    let Some(branch_version) = head_branch.strip_prefix(AUTOTAG_RELEASE_BRANCH_PREFIX) else {
        return Ok(AutotagDecision::Skip(format!(
            "`{head_branch}` is not a release-prep branch"
        )));
    };

    let mut failures = Vec::new();
    if branch_version != version {
        failures.push(format!(
            "branch `{head_branch}` names `{branch_version}`, but {AUTOTAG_VERSION_SOURCE} declares `{version}`"
        ));
    }
    if !title_names_tag(pr_title, &tag) {
        failures.push(format!(
            "pull request title `{pr_title}` does not name `{tag}`"
        ));
    }
    if !failures.is_empty() {
        return Err(Error::CheckFailed {
            check: "autotag release-prep agreement".to_string(),
            failures,
        });
    }

    let Some(existing) = input.existing_tag else {
        return Ok(AutotagDecision::Tag(tag));
    };
    // Public tags are never moved, so neither defect below can be repaired
    // here, and neither may pass as a green skip.
    let mut failures = Vec::new();
    if existing.commit != input.head_commit {
        failures.push(format!(
            "tag `{tag}` already exists at `{}`, not at the release commit `{}`",
            existing.commit, input.head_commit
        ));
    }
    if !existing.annotated {
        failures.push(format!(
            "tag `{tag}` is a lightweight tag; release tags are annotated"
        ));
    }
    if !failures.is_empty() {
        return Err(Error::CheckFailed {
            check: "autotag existing tag".to_string(),
            failures,
        });
    }
    // A rerun on the commit that is already tagged: nothing to do.
    Ok(AutotagDecision::Skip(format!(
        "tag `{tag}` already points at this commit"
    )))
}

/// The branch prefix a release-prep pull request is opened from.
const AUTOTAG_RELEASE_BRANCH_PREFIX: &str = "release/v";
/// The primary version source, first in `.continuum/release.yml`.
const AUTOTAG_VERSION_SOURCE: &str = "crates/wesley-core/Cargo.toml";

/// Whether a title names exactly this tag as a whole word, so that `v0.3.0`
/// does not match inside `v0.3.0-alpha.2`.
fn title_names_tag(title: &str, tag: &str) -> bool {
    let is_version_char = |ch: char| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '+');
    title
        .split(|ch: char| !is_version_char(ch))
        .any(|word| word.trim_end_matches('.') == tag)
}

/// Whether `refs/tags/<tag>` names a tag object. A lightweight tag names the
/// commit directly, so `git cat-file -t` reports `commit` for it.
fn tag_is_annotated(tag: &str) -> Result<bool, Error> {
    let reference = format!("refs/tags/{tag}");
    Ok(git_output(&["cat-file", "-t", reference.as_str()])?.trim() == "tag")
}

/// The commit a tag points at, or `None` when the tag does not exist.
fn commit_of_tag(tag: &str) -> Result<Option<String>, Error> {
    let reference = format!("refs/tags/{tag}^{{commit}}");
    let args = ["rev-parse", "--verify", "--quiet", reference.as_str()];
    let label = command_label("git", &args);
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    // `--verify --quiet` exits 1 with no output when the ref does not exist.
    if !output.status.success() {
        return Ok(None);
    }
    Ok(Some(
        String::from_utf8_lossy(&output.stdout).trim().to_string(),
    ))
}

/// Prints the autotag decision for the checked-out commit as `key=value` lines
/// suitable for `$GITHUB_OUTPUT`.
///
/// The pull request's head branch and title arrive through the
/// `AUTOTAG_HEAD_BRANCH` and `AUTOTAG_PR_TITLE` environment variables rather
/// than arguments: a title is text a contributor chose, and a workflow must
/// never interpolate it into a command line.
fn run_release_autotag_plan() -> Result<(), Error> {
    let manifest = fs::read_to_string(AUTOTAG_VERSION_SOURCE).map_err(|source| {
        Error::Usage(format!("failed to read {AUTOTAG_VERSION_SOURCE}: {source}"))
    })?;
    let manifest: toml::Value = manifest.parse().map_err(|source| {
        Error::Usage(format!(
            "failed to parse {AUTOTAG_VERSION_SOURCE}: {source}"
        ))
    })?;
    let Some(version) = manifest
        .get("package")
        .and_then(|package| package.get("version"))
        .and_then(toml::Value::as_str)
    else {
        return Err(Error::Usage(format!(
            "{AUTOTAG_VERSION_SOURCE} declares no package.version"
        )));
    };

    let head_commit = git_output(&["rev-parse", "HEAD"])?;
    let expected_tag = format!("v{}", version_from_release_arg(version)?);
    let existing_tag_commit = commit_of_tag(&expected_tag)?;
    let existing_tag = match existing_tag_commit.as_deref() {
        None => None,
        Some(commit) => Some(ExistingTag {
            commit,
            annotated: tag_is_annotated(&expected_tag)?,
        }),
    };

    let head_branch = env::var("AUTOTAG_HEAD_BRANCH")
        .ok()
        .filter(|value| !value.is_empty());
    let pr_title = env::var("AUTOTAG_PR_TITLE")
        .ok()
        .filter(|value| !value.is_empty());
    let decision = autotag_decision(&AutotagInput {
        version,
        head_branch: head_branch.as_deref(),
        pr_title: pr_title.as_deref(),
        head_commit: head_commit.trim(),
        existing_tag,
    })?;
    match decision {
        AutotagDecision::Tag(tag) => println!("decision=tag\ntag={tag}"),
        AutotagDecision::Skip(reason) => println!("decision=skip\nreason={reason}"),
    }
    Ok(())
}

/// Crates a `wesley-core` build without default features must not pull in.
///
/// The compiler kernel is synchronous and pure. The async runtime stack belongs
/// to the optional `resilience` feature, so a consumer that only lowers SDL
/// does not pay for it.
const LEAN_CORE_FORBIDDEN_DEPENDENCIES: &[&str] = &["async-trait", "ninelives", "tokio", "tower"];

/// Returns the forbidden crates named in `cargo tree --prefix none` output.
fn lean_core_forbidden_dependencies(tree: &str) -> Vec<String> {
    let mut found: Vec<String> = tree
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| LEAN_CORE_FORBIDDEN_DEPENDENCIES.contains(name))
        .map(str::to_string)
        .collect();
    found.sort();
    found.dedup();
    found
}

/// Proves the compiler kernel builds, passes its tests, and stays free of the
/// async runtime stack when built without default features.
fn run_lean_core_check() -> Result<(), Error> {
    run_command(
        "cargo",
        &["test", "-p", "wesley-core", "--no-default-features"],
    )?;

    let args = [
        "tree",
        "-p",
        "wesley-core",
        "--no-default-features",
        "-e",
        "normal",
        "--prefix",
        "none",
    ];
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

    let failures = lean_core_forbidden_dependencies(&String::from_utf8_lossy(&output.stdout));
    if failures.is_empty() {
        Ok(())
    } else {
        Err(Error::CheckFailed {
            check: "lean wesley-core must not depend on the async runtime stack".to_string(),
            failures,
        })
    }
}

fn run_command(program: &str, args: &[&str]) -> Result<(), Error> {
    let label = command_label(program, args);
    println!("xtask: {label}");

    run_command_with_label(program, args, label)
}

fn run_command_with_label(program: &str, args: &[&str], label: String) -> Result<(), Error> {
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
  bench-ir          Run advisory Rust-native IR lowering benchmarks
  docs-check        Run Rust-native documentation hygiene checks
  lean-core-check   Prove wesley-core without default features omits the async stack
  built-cli         Build the wesley binary and print the path Cargo gave it
  docs-replay       Replay the documented CLI sessions and check the generated CLI reference
  preflight         Run the strict pre-PR/release quality gate
  strict-preflight  Alias for preflight
  package-crates    Check package file sets for the crates.io release set
  publish-alpha     Publish the crates.io alpha package set; dry-run by default
  publish-crates    Publish crates.io package set for a release tag
  release-prep-guard Verify release prep before a tag exists
  release-guard     Verify that a release tag is eligible to publish
  release-autotag-plan Decide whether the checked-out main commit earns a release tag
  release-check     Run strict preflight, then build and package release artifacts
  legacy-preflight  Run the historical pnpm package preflight for legacy changes
  help              Show help

Publish options:
  cargo xtask publish-alpha                    Print alpha plan and run safe dry-runs
  cargo xtask publish-alpha --execute          CI tag-only compatibility publish path
  cargo xtask package-crates --tag vX.Y.Z      Check release package file sets
  cargo xtask package-crates --version X.Y.Z   Check pre-tag release package file sets
  cargo xtask bench-ir --iterations 5 --warmups 1 --json
  cargo xtask bench-ir --output out/ir-benchmark.json
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

struct CargoVersionSource {
    name: &'static str,
    path: &'static str,
    publish: bool,
}

#[derive(Debug, PartialEq, Eq)]
struct BenchIrOptions {
    iterations: usize,
    warmups: usize,
    json: bool,
    output: Option<PathBuf>,
}

impl BenchIrOptions {
    fn parse(args: &[OsString]) -> Result<Self, Error> {
        let mut options = Self {
            iterations: 5,
            warmups: 1,
            json: false,
            output: None,
        };

        let mut index = 0;
        while index < args.len() {
            let Some(arg) = args[index].to_str() else {
                return Err(Error::Usage("bench-ir options must be UTF-8".to_string()));
            };

            match arg {
                "--json" => options.json = true,
                "--iterations" => {
                    index += 1;
                    let value = args
                        .get(index)
                        .and_then(|arg| arg.to_str())
                        .ok_or_else(|| {
                            Error::Usage("bench-ir --iterations requires a UTF-8 value".to_string())
                        })?;
                    options.iterations = parse_positive_usize("bench-ir --iterations", value)?;
                }
                value if value.starts_with("--iterations=") => {
                    let value = value.trim_start_matches("--iterations=");
                    options.iterations = parse_positive_usize("bench-ir --iterations", value)?;
                }
                "--warmups" => {
                    index += 1;
                    let value = args
                        .get(index)
                        .and_then(|arg| arg.to_str())
                        .ok_or_else(|| {
                            Error::Usage("bench-ir --warmups requires a UTF-8 value".to_string())
                        })?;
                    options.warmups = parse_usize("bench-ir --warmups", value)?;
                }
                value if value.starts_with("--warmups=") => {
                    let value = value.trim_start_matches("--warmups=");
                    options.warmups = parse_usize("bench-ir --warmups", value)?;
                }
                "--output" => {
                    index += 1;
                    let value = args.get(index).ok_or_else(|| {
                        Error::Usage("bench-ir --output requires a path value".to_string())
                    })?;
                    options.output = Some(PathBuf::from(value));
                }
                value if value.starts_with("--output=") => {
                    options.output = Some(PathBuf::from(value.trim_start_matches("--output=")));
                }
                "--help" | "-h" => {
                    print_help();
                    return Err(Error::Usage(
                        "bench-ir help requested; see usage above".to_string(),
                    ));
                }
                other => {
                    return Err(Error::Usage(format!("unknown bench-ir option `{other}`")));
                }
            }

            index += 1;
        }

        Ok(options)
    }
}

struct BenchIrFixture {
    name: &'static str,
    schema: String,
}

#[derive(Default)]
struct IrMetricCounts {
    type_count: usize,
    field_count: usize,
    directive_count: usize,
    operation_count: usize,
}

struct SampleSummary {
    min: f64,
    median: f64,
    mean: f64,
    max: f64,
}

fn parse_positive_usize(label: &str, value: &str) -> Result<usize, Error> {
    let parsed = parse_usize(label, value)?;
    if parsed == 0 {
        Err(Error::Usage(format!("{label} must be greater than zero")))
    } else {
        Ok(parsed)
    }
}

fn parse_usize(label: &str, value: &str) -> Result<usize, Error> {
    value
        .parse::<usize>()
        .map_err(|source| Error::Usage(format!("{label} must be an integer: {source}")))
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

    fn os_args(args: &[&str]) -> Vec<OsString> {
        args.iter().map(OsString::from).collect()
    }

    const AUTOTAG_HEAD: &str = "1111111111111111111111111111111111111111";
    const AUTOTAG_ELSEWHERE: &str = "2222222222222222222222222222222222222222";

    fn autotag_input<'a>(
        version: &'a str,
        head_branch: Option<&'a str>,
        pr_title: Option<&'a str>,
        existing_tag: Option<ExistingTag<'a>>,
    ) -> AutotagInput<'a> {
        AutotagInput {
            version,
            head_branch,
            pr_title,
            head_commit: AUTOTAG_HEAD,
            existing_tag,
        }
    }

    const fn annotated_at(commit: &str) -> ExistingTag<'_> {
        ExistingTag {
            commit,
            annotated: true,
        }
    }

    #[test]
    fn autotag_tags_a_merged_release_prep_pull_request() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert_eq!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Tag("v0.3.0-alpha.2".to_string())
        );
    }

    #[test]
    fn autotag_skips_an_ordinary_merge_to_main() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("core/803-lean-core-resilience-feature"),
            Some("feat(core): put the async lowering port behind a `resilience` feature"),
            None,
        );

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("not a release-prep")
        ));
    }

    #[test]
    fn autotag_skips_a_push_with_no_pull_request() {
        let input = autotag_input("0.3.0-alpha.2", None, None, None);

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("no merged pull request")
        ));
    }

    #[test]
    fn autotag_skips_a_rerun_when_the_tag_already_points_at_this_commit() {
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(annotated_at(AUTOTAG_HEAD)),
        );

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("already points at this commit")
        ));
    }

    #[test]
    fn autotag_refuses_a_lightweight_tag_even_at_the_release_commit() {
        // Release tags are annotated. A lightweight tag at HEAD peels to the
        // same commit, so a green skip would let the publish dispatch run from
        // a tag this workflow would never have created.
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(ExistingTag {
                commit: AUTOTAG_HEAD,
                annotated: false,
            }),
        );

        assert!(matches!(
            autotag_decision(&input),
            Err(Error::CheckFailed { failures, .. })
                if failures.iter().any(|failure| failure.contains("lightweight"))
        ));
    }

    #[test]
    fn autotag_fails_loudly_when_the_tag_exists_on_another_commit() {
        // A green skip here would hide that an immutable version is attached to
        // the wrong source.
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(annotated_at(AUTOTAG_ELSEWHERE)),
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_release_branch_that_disagrees_with_the_manifest() {
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_release_branch_whose_title_names_another_version() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.3"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_does_not_mistake_a_longer_version_in_the_title_for_a_match() {
        let input = autotag_input(
            "0.3.0",
            Some("release/v0.3.0"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_version_with_build_metadata() {
        let input = autotag_input(
            "0.3.0+build.7",
            Some("release/v0.3.0+build.7"),
            Some("chore(release): prepare v0.3.0+build.7"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn lean_core_check_names_each_forbidden_crate_once_in_sorted_order() {
        let tree = "wesley-core v0.3.0-alpha.2 (/repo/crates/wesley-core)\n\
                    tokio v1.47.1\n\
                    serde v1.0.229\n\
                    tokio v1.47.1 (*)\n\
                    async-trait v0.1.89 (proc-macro)\n";

        assert_eq!(
            lean_core_forbidden_dependencies(tree),
            vec!["async-trait".to_string(), "tokio".to_string()]
        );
    }

    #[test]
    fn lean_core_check_matches_whole_crate_names_only() {
        let tree =
            "tokio-util v0.7.16\ntower-layer v0.3.3\nasync-trait-fn v0.1.0\nserde v1.0.229\n";

        assert!(lean_core_forbidden_dependencies(tree).is_empty());
    }

    #[test]
    fn lean_core_check_passes_a_tree_without_the_async_stack() {
        let tree = "wesley-core v0.3.0-alpha.2\napollo-parser v0.8.4\nserde_json v1.0.145\n";

        assert!(lean_core_forbidden_dependencies(tree).is_empty());
    }

    #[test]
    fn bench_ir_options_use_advisory_defaults() {
        assert_eq!(
            BenchIrOptions::parse(&[]).unwrap(),
            BenchIrOptions {
                iterations: 5,
                warmups: 1,
                json: false,
                output: None
            }
        );
    }

    #[test]
    fn bench_ir_options_parse_report_flags() {
        let args = os_args(&[
            "--json",
            "--iterations=7",
            "--warmups",
            "0",
            "--output",
            "out/bench.json",
        ]);

        assert_eq!(
            BenchIrOptions::parse(&args).unwrap(),
            BenchIrOptions {
                iterations: 7,
                warmups: 0,
                json: true,
                output: Some(PathBuf::from("out/bench.json"))
            }
        );
    }

    #[test]
    fn bench_ir_options_reject_zero_iterations() {
        let args = os_args(&["--iterations", "0"]);

        assert!(matches!(
            BenchIrOptions::parse(&args),
            Err(Error::Usage(message)) if message == "bench-ir --iterations must be greater than zero"
        ));
    }

    #[test]
    fn bench_ir_fixture_corpus_covers_scale_shapes() {
        let fixtures = bench_ir_fixtures();
        let names = fixtures
            .iter()
            .map(|fixture| fixture.name)
            .collect::<Vec<_>>();

        assert_eq!(
            names,
            vec![
                "wide-schema",
                "deep-input-schema",
                "directive-heavy-schema",
                "operation-heavy-schema",
                "extension-folding-schema"
            ]
        );
        assert!(fixtures
            .iter()
            .any(|fixture| fixture.schema.contains("extend type Thing")));
        assert!(fixtures
            .iter()
            .any(|fixture| fixture.schema.contains("directive @tag")));
    }

    #[test]
    fn ir_metric_counts_include_fields_directives_and_operations() {
        let ir = serde_json::json!({
            "types": [
                {
                    "name": "Query",
                    "directives": { "tag": {} },
                    "fields": [
                        {
                            "name": "user",
                            "directives": { "cache": {} },
                            "arguments": [
                                { "name": "id", "directives": { "arg": {} } }
                            ]
                        },
                        { "name": "search" }
                    ]
                },
                {
                    "name": "User",
                    "directives": { "tag": [{}, {}] },
                    "fields": [
                        { "name": "id", "directives": { "id": {} } }
                    ]
                }
            ]
        });

        let counts = ir_metric_counts(&ir);

        assert_eq!(counts.type_count, 2);
        assert_eq!(counts.field_count, 3);
        assert_eq!(counts.directive_count, 6);
        assert_eq!(counts.operation_count, 2);
    }

    #[test]
    fn sample_summary_uses_true_even_sample_median() {
        let summary = sample_summary(&[12.0, 2.0, 6.0, 4.0]);

        assert_eq!(summary.min, 2.0);
        assert_eq!(summary.median, 5.0);
        assert_eq!(summary.mean, 6.0);
        assert_eq!(summary.max, 12.0);
    }

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
    fn release_guard_does_not_query_release_gate_milestones() {
        let queries = release_issue_queries("v1.2.3", "1.2.3", "flyingrobots/wesley");

        assert!(
            queries
                .iter()
                .all(|query| !query.iter().any(|arg| arg == "--milestone")),
            "release-gate milestones may stay open until post-publication closeout"
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
    fn root_package_json_version_mismatch_blocks_release_manifest_check() {
        let root = env::temp_dir().join(format!(
            "wesley-xtask-release-version-root-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).expect("stale temp root should be removed");
        }
        fs::create_dir_all(&root).expect("temp root should be created");
        fs::write(
            root.join("package.json"),
            serde_json::json!({
                "name": "wesley",
                "version": "9.9.9",
                "private": true
            })
            .to_string(),
        )
        .expect("root package json should be written");

        for publish_crate in PUBLISH_CRATES {
            let crate_root = root.join(publish_crate.path);
            fs::create_dir_all(crate_root.join("src")).expect("crate src should be created");
            fs::write(crate_root.join("README.md"), "# Test crate\n")
                .expect("crate readme should be written");
            fs::write(crate_root.join("src/lib.rs"), "").expect("crate source should be written");

            let mut dependency_lines = String::new();
            for dependency in publish_crate.dependencies {
                dependency_lines.push_str(&format!(
                    "{dependency} = {{ path = \"../{dependency}\", version = \"=1.2.3\" }}\n"
                ));
            }
            fs::write(
                crate_root.join("Cargo.toml"),
                format!(
                    "[package]\nname = \"{}\"\nversion = \"1.2.3\"\nedition = \"2021\"\nreadme = \"README.md\"\n\n[dependencies]\n{}",
                    publish_crate.name, dependency_lines
                ),
            )
            .expect("crate manifest should be written");
        }

        let holmes_root = root.join("crates/wesley-holmes");
        fs::create_dir_all(holmes_root.join("src")).expect("holmes src should be created");
        fs::write(
            holmes_root.join("Cargo.toml"),
            "[package]\nname = \"wesley-holmes\"\nversion = \"1.2.3\"\nedition = \"2021\"\npublish = false\n",
        )
        .expect("holmes manifest should be written");

        let result = check_publish_manifest_versions_at(&root, "1.2.3");

        match result {
            Err(Error::CheckFailed { check, failures }) => {
                assert_eq!(check, "release manifest versions");
                assert_eq!(
                    failures,
                    vec!["package.json version is `9.9.9`, expected `1.2.3`"]
                );
            }
            other => panic!("expected root package version failure, got {other:?}"),
        }

        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    #[test]
    fn unpublished_holmes_version_mismatch_blocks_release_manifest_check() {
        let root = env::temp_dir().join(format!(
            "wesley-xtask-release-holmes-version-{}",
            std::process::id()
        ));
        if root.exists() {
            fs::remove_dir_all(&root).expect("stale temp root should be removed");
        }
        fs::create_dir_all(&root).expect("temp root should be created");
        fs::write(
            root.join("package.json"),
            serde_json::json!({
                "name": "wesley",
                "version": "1.2.3",
                "private": true
            })
            .to_string(),
        )
        .expect("root package json should be written");

        for publish_crate in PUBLISH_CRATES {
            let crate_root = root.join(publish_crate.path);
            fs::create_dir_all(crate_root.join("src")).expect("crate src should be created");
            fs::write(crate_root.join("README.md"), "# Test crate\n")
                .expect("crate readme should be written");
            fs::write(crate_root.join("src/lib.rs"), "").expect("crate source should be written");

            let mut dependency_lines = String::new();
            for dependency in publish_crate.dependencies {
                dependency_lines.push_str(&format!(
                    "{dependency} = {{ path = \"../{dependency}\", version = \"=1.2.3\" }}\n"
                ));
            }
            fs::write(
                crate_root.join("Cargo.toml"),
                format!(
                    "[package]\nname = \"{}\"\nversion = \"1.2.3\"\nedition = \"2021\"\nreadme = \"README.md\"\n\n[dependencies]\n{}",
                    publish_crate.name, dependency_lines
                ),
            )
            .expect("crate manifest should be written");
        }

        let holmes_root = root.join("crates/wesley-holmes");
        fs::create_dir_all(holmes_root.join("src")).expect("holmes src should be created");
        fs::write(
            holmes_root.join("Cargo.toml"),
            "[package]\nname = \"wesley-holmes\"\nversion = \"9.9.9\"\nedition = \"2021\"\npublish = false\n",
        )
        .expect("holmes manifest should be written");

        let result = check_publish_manifest_versions_at(&root, "1.2.3");

        match result {
            Err(Error::CheckFailed { check, failures }) => {
                assert_eq!(check, "release manifest versions");
                assert_eq!(
                    failures,
                    vec!["crates/wesley-holmes version is `9.9.9`, expected `1.2.3`"]
                );
            }
            other => panic!("expected Holmes package version failure, got {other:?}"),
        }

        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    // --- sibling requirements ---

    /// Failures `check_dependency_hygiene` reports for a `wesley-cli` manifest
    /// with this body, when the release version is `1.2.3-alpha.2`.
    fn dependency_hygiene_failures(manifest: &str) -> Vec<String> {
        let cli = PUBLISH_CRATES
            .iter()
            .find(|publish_crate| publish_crate.name == "wesley-cli")
            .expect("wesley-cli should be a published crate");
        let manifest: toml::Value = manifest.parse().expect("fixture manifest should parse");
        let mut failures = Vec::new();
        check_dependency_hygiene(
            cli,
            &manifest,
            "1.2.3-alpha.2",
            &["wesley-core"],
            &mut failures,
        );
        failures
    }

    /// The same, for a `wesley-core` path dependency with this requirement.
    fn sibling_requirement_failures(requirement: &str) -> Vec<String> {
        dependency_hygiene_failures(&format!(
            "[dependencies]\nwesley-core = {{ path = \"../wesley-core\", version = \"{requirement}\" }}\n"
        ))
    }

    fn expects_exact_pin(failures: &[String]) -> bool {
        failures
            .iter()
            .any(|failure| failure.contains("expected `=1.2.3-alpha.2`"))
    }

    #[test]
    fn sibling_requirement_pinned_exactly_passes() {
        assert_eq!(
            sibling_requirement_failures("=1.2.3-alpha.2"),
            Vec::<String>::new()
        );
    }

    #[test]
    fn bare_sibling_requirement_is_refused_because_cargo_reads_it_as_caret() {
        // `"1.2.3-alpha.2"` admits `1.2.3-alpha.3` and `1.2.3`, so an unlocked
        // install of an older release can resolve newer siblings.
        let failures = sibling_requirement_failures("1.2.3-alpha.2");

        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("expected `=1.2.3-alpha.2`")),
            "{failures:?}"
        );
    }

    #[test]
    fn caret_sibling_requirement_is_refused() {
        let failures = sibling_requirement_failures("^1.2.3-alpha.2");

        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("expected `=1.2.3-alpha.2`")),
            "{failures:?}"
        );
    }

    #[test]
    fn shorthand_sibling_requirement_is_refused_too() {
        // `wesley-core = "1.2.3-alpha.2"` is valid Cargo and is the same caret
        // requirement; a check that reads only dependency tables never sees it.
        let cli = PUBLISH_CRATES
            .iter()
            .find(|publish_crate| publish_crate.name == "wesley-cli")
            .expect("wesley-cli should be a published crate");
        let manifest: toml::Value = "[dependencies]\nwesley-core = \"1.2.3-alpha.2\"\n"
            .parse()
            .expect("fixture manifest should parse");
        let mut failures = Vec::new();

        check_dependency_hygiene(
            cli,
            &manifest,
            "1.2.3-alpha.2",
            &["wesley-core"],
            &mut failures,
        );

        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("expected `=1.2.3-alpha.2`")),
            "{failures:?}"
        );
    }

    #[test]
    fn target_specific_sibling_requirement_is_refused() {
        for section in ["dependencies", "dev-dependencies", "build-dependencies"] {
            let failures = dependency_hygiene_failures(&format!(
                "[target.'cfg(unix)'.{section}]\nwesley-core = {{ path = \"../wesley-core\", version = \"1.2.3-alpha.2\" }}\n"
            ));

            assert!(expects_exact_pin(&failures), "{section}: {failures:?}");
        }
    }

    #[test]
    fn target_specific_sibling_pinned_exactly_passes() {
        let failures = dependency_hygiene_failures(
            "[target.'cfg(unix)'.dependencies]\nwesley-core = { path = \"../wesley-core\", version = \"=1.2.3-alpha.2\" }\n",
        );

        assert_eq!(failures, Vec::<String>::new());
    }

    #[test]
    fn renamed_sibling_requirement_is_refused() {
        // The key is an alias; `package` names the crate Cargo resolves.
        let failures = dependency_hygiene_failures(
            "[dependencies]\ncore = { package = \"wesley-core\", version = \"1.2.3-alpha.2\" }\n",
        );

        assert!(expects_exact_pin(&failures), "{failures:?}");
    }

    #[test]
    fn renamed_sibling_pinned_exactly_passes() {
        let failures = dependency_hygiene_failures(
            "[dependencies]\ncore = { package = \"wesley-core\", path = \"../wesley-core\", version = \"=1.2.3-alpha.2\" }\n",
        );

        assert_eq!(failures, Vec::<String>::new());
    }

    #[test]
    fn a_dependency_that_only_shares_a_sibling_alias_is_not_a_sibling() {
        // `wesley-core` here is an alias for an unrelated registry crate.
        let failures = dependency_hygiene_failures(
            "[dependencies]\nwesley-core = { package = \"serde\", version = \"1\" }\n",
        );

        assert_eq!(failures, Vec::<String>::new());
    }

    // --- release tag object type ---

    #[test]
    fn an_annotated_release_tag_is_accepted() {
        assert_eq!(release_tag_object_failure("v1.2.3", "tag"), None);
    }

    #[test]
    fn a_lightweight_release_tag_is_refused() {
        // `git cat-file -t refs/tags/<tag>` reports `commit` for a lightweight
        // tag, because the ref names the commit directly.
        let failure = release_tag_object_failure("v1.2.3", "commit")
            .expect("a lightweight tag should be refused");

        assert!(failure.contains("lightweight"), "{failure}");
        assert!(failure.contains("v1.2.3"), "{failure}");
    }

    #[test]
    fn a_release_tag_naming_any_other_object_is_refused() {
        let failure = release_tag_object_failure("v1.2.3", "blob")
            .expect("a tag ref naming a blob should be refused");

        assert!(failure.contains("`blob`"), "{failure}");
    }

    // --- looks_like_file_path ---

    // --- looks_like_commit_sha ---

    #[test]
    fn git_revision_exists_requires_commit_objects() {
        let head_tree = git_output(&["rev-parse", "HEAD^{tree}"]).unwrap();

        assert!(git_revision_exists("HEAD").unwrap());
        assert!(!git_revision_exists(&head_tree).unwrap());
    }

    // --- extract_backtick_content ---

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
}
