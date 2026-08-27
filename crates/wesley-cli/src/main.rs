//! Native Wesley CLI entry point.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use wesley_core::{
    compute_content_hash, compute_registry_hash, diff_schema_sdl, extract_operation_directive_args,
    list_schema_operations_sdl, load_project_manifest, lower_schema_sdl, normalize_schema_sdl,
    resolve_operation_selections, resolve_operation_selections_with_schema,
    select_changed_schema_paths, DetailedSchemaPathConfig, ProjectManifest, ProjectManifestError,
    ResolvedSchemaPath, SchemaDelta, SchemaPathConfig, SelectedSchemaPath, WesleyError, WesleyIR,
};
use wesley_emit_rust::{
    emit_le_binary_rust, emit_rust_with_operations, GENERATOR_NAME as RUST_GENERATOR_NAME,
    GENERATOR_VERSION as RUST_GENERATOR_VERSION, LE_BINARY_RUST_DEFAULT_CODEC_IMPORT,
    LE_BINARY_RUST_GENERATOR_NAME,
};
use wesley_emit_typescript::{
    emit_le_binary_typescript, emit_typescript_with_operations, DEFAULT_CODEC_IMPORT,
    GENERATOR_NAME as TYPESCRIPT_GENERATOR_NAME, GENERATOR_VERSION as TYPESCRIPT_GENERATOR_VERSION,
    LE_BINARY_GENERATOR_NAME as LE_BINARY_TYPESCRIPT_GENERATOR_NAME,
};

const EXIT_OK: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const EXIT_USAGE: u8 = 2;
const RUST_NATIVE_EXECUTION_MODE: &str = "rust-native";
const TARGET_DESCRIPTOR_API_VERSION: &str = "wesley.target-descriptor/v1";
const TARGET_PROCESS_PROTOCOL_VERSION: &str = "wesley.target-process/v1";
const REQUIRED_TARGET_INPUT_IR: &str = "wesley.l1-ir/v1";
const REQUIRED_TARGET_OUTPUT_MANIFEST: &str = "wesley.target-artifact-manifest/v1";
const TARGET_VERIFY_MAX_TIMEOUT_MS: u64 = 300_000;

fn main() -> ExitCode {
    let args = env::args().skip(1).collect::<Vec<_>>();

    match run(args) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(error.exit_code())
        }
    }
}

fn run(args: Vec<String>) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_help();
            Ok(EXIT_OK)
        }
        Some("normalize-sdl") if wants_help(&args[1..]) => {
            print_normalize_sdl_help();
            Ok(EXIT_OK)
        }
        Some("normalize-sdl") => run_normalize_sdl_command(&args[1..]),
        Some("doctor") if wants_help(&args[1..]) => {
            print_doctor_help();
            Ok(EXIT_OK)
        }
        Some("doctor") => run_doctor_command(&args[1..]),
        Some("config") => run_config_command(&args[1..]),
        Some("target") => run_target_command(&args[1..]),
        Some("schema") => run_schema_command(&args[1..]),
        Some("emit") => run_emit_command(&args[1..]),
        Some("operation") => run_operation_command(&args[1..]),
        Some("version") | Some("--version") | Some("-V") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!("unknown command '{command}'"))),
    }
}

fn run_normalize_sdl_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "normalize-sdl")?;
    let schema_path = options.required_schema("normalize-sdl")?;
    let sdl = read_file(&schema_path, "schema")?;
    let normalized = normalize_schema_sdl(&sdl)?;

    if options.hash {
        println!("{}", compute_content_hash(&normalized));
    } else {
        println!("{normalized}");
    }

    Ok(EXIT_OK)
}

fn run_doctor_command(args: &[String]) -> Result<u8, CliError> {
    let output_format = parse_doctor_options(args)?;
    let report = build_doctor_report();

    match output_format {
        DoctorOutputFormat::Text => print_doctor_text(&report),
        DoctorOutputFormat::Json => print_json(&report)?,
    }

    if report.ok {
        Ok(EXIT_OK)
    } else {
        Ok(EXIT_FAILURE)
    }
}

fn run_config_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_config_help();
            Ok(EXIT_OK)
        }
        Some("validate") if wants_help(&args[1..]) => {
            print_config_help();
            Ok(EXIT_OK)
        }
        Some("validate") => {
            let options = parse_options(&args[1..], "config validate")?;
            let (manifest_path, manifest) = load_manifest_from_options(&options)?;
            let report = ConfigInspectReport {
                valid: true,
                manifest_path: manifest_path.display().to_string(),
                resolved_schema_paths: manifest.resolved_schema_paths(),
                manifest,
            };

            if options.json {
                print_json(&report)?;
            } else {
                println!("Manifest valid: {}", report.manifest_path);
            }
            Ok(EXIT_OK)
        }
        Some("inspect") if wants_help(&args[1..]) => {
            print_config_help();
            Ok(EXIT_OK)
        }
        Some("inspect") => {
            let options = parse_options(&args[1..], "config inspect")?;
            let (manifest_path, manifest) = load_manifest_from_options(&options)?;
            let report = ConfigInspectReport {
                valid: true,
                manifest_path: manifest_path.display().to_string(),
                resolved_schema_paths: manifest.resolved_schema_paths(),
                manifest,
            };

            if options.json {
                print_json(&report)?;
            } else {
                println!("Manifest: {}", report.manifest_path);
                println!("Bundle dir: {}", report.manifest.bundle_dir);
                for schema in &report.resolved_schema_paths {
                    println!("Schema {}: {}", schema.id, schema.path);
                }
                for target in &report.manifest.targets {
                    println!("Target: {}", target.name);
                }
            }
            Ok(EXIT_OK)
        }
        Some("changed-schemas") if wants_help(&args[1..]) => {
            print_config_help();
            Ok(EXIT_OK)
        }
        Some("changed-schemas") => {
            let options = parse_options(&args[1..], "config changed-schemas")?;
            let (manifest_path, manifest) = load_manifest_from_options(&options)?;
            let changed_files = changed_files_from_options(&options)?;
            let selection_manifest =
                manifest_with_paths_relative_to_cwd(&manifest_path, &manifest)?;
            let selected_schema_paths =
                select_changed_schema_paths(&selection_manifest, &changed_files);
            let report = ConfigChangedSchemasReport {
                manifest_path: manifest_path.display().to_string(),
                changed_files,
                selected_schema_paths,
            };

            if options.json {
                print_json(&report)?;
            } else {
                for schema in &report.selected_schema_paths {
                    println!("{} {} ({})", schema.id, schema.path, schema.reason);
                }
            }
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!(
            "unknown config command '{command}'"
        ))),
    }
}

fn run_target_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_target_help();
            Ok(EXIT_OK)
        }
        Some("verify") if wants_help(&args[1..]) => {
            print_target_help();
            Ok(EXIT_OK)
        }
        Some("verify") => run_target_verify_command(&args[1..]),
        Some(command) => Err(CliError::usage(format!(
            "unknown target command '{command}'"
        ))),
    }
}

fn run_target_verify_command(args: &[String]) -> Result<u8, CliError> {
    let (descriptor_path, json) = parse_target_verify_args(args)?;
    let descriptor_source = read_file(&descriptor_path, "target descriptor")?;
    let descriptor =
        serde_json::from_str::<ExternalTargetDescriptor>(&descriptor_source).map_err(|source| {
            CliError::JsonInput {
                label: "target descriptor".to_string(),
                path: descriptor_path.clone(),
                source: source.to_string(),
            }
        })?;
    let diagnostics = validate_external_target_descriptor(&descriptor);
    let valid = diagnostics.is_empty();
    let report = TargetVerifyReport {
        valid,
        descriptor_path: descriptor_path.display().to_string(),
        descriptor: TargetDescriptorIdentity {
            api_version: descriptor.api_version.clone(),
            name: descriptor.name.clone(),
            protocol: descriptor.protocol.version.clone(),
        },
        diagnostics,
    };

    if json {
        print_json(&report)?;
    } else if valid {
        println!("Target descriptor valid: {}", report.descriptor.name);
    } else {
        eprintln!("Target descriptor invalid: {}", descriptor_path.display());
        for diagnostic in &report.diagnostics {
            if let Some(subject) = diagnostic.subject.as_deref() {
                eprintln!("{}: {} ({subject})", diagnostic.code, diagnostic.message);
            } else {
                eprintln!("{}: {}", diagnostic.code, diagnostic.message);
            }
        }
    }

    if valid {
        Ok(EXIT_OK)
    } else {
        Ok(EXIT_FAILURE)
    }
}

fn run_schema_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("lower") if wants_help(&args[1..]) => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("lower") => {
            let options = parse_options(&args[1..], "schema lower")?;
            let schema_path = schema_path_or_manifest_default(&options, "schema lower")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            print_json(&ir)?;
            Ok(EXIT_OK)
        }
        Some("hash") if wants_help(&args[1..]) => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("hash") => {
            let options = parse_options(&args[1..], "schema hash")?;
            let schema_path = schema_path_or_manifest_default(&options, "schema hash")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            let schema_hash = compute_registry_hash(&ir)?;

            if options.json {
                print_json(&serde_json::json!({ "schemaHash": schema_hash }))?;
            } else {
                println!("{schema_hash}");
            }

            Ok(EXIT_OK)
        }
        Some("operations") if wants_help(&args[1..]) => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("operations") => {
            let options = parse_options(&args[1..], "schema operations")?;
            let schema_path = schema_path_or_manifest_default(&options, "schema operations")?;
            let sdl = read_file(&schema_path, "schema")?;
            let operations = list_schema_operations_sdl(&sdl)?;

            print_json(&operations)?;
            Ok(EXIT_OK)
        }
        Some("diff") if wants_help(&args[1..]) => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("diff") => {
            let options = parse_options(&args[1..], "schema diff")?;
            let (old_sdl, new_sdl) = read_schema_diff_inputs(&options)?;
            let delta = diff_schema_sdl(&old_sdl, &new_sdl)?;
            let output_format = options.output_format()?;

            print_schema_delta(&delta, output_format, options.breaking_only)?;

            if options.exit_code && delta.has_breaking_changes() {
                Ok(EXIT_FAILURE)
            } else {
                Ok(EXIT_OK)
            }
        }
        Some(command) => Err(CliError::usage(format!(
            "unknown schema command '{command}'"
        ))),
    }
}

fn run_emit_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_emit_help();
            Ok(EXIT_OK)
        }
        Some("rust") if wants_help(&args[1..]) => {
            print_emit_help();
            Ok(EXIT_OK)
        }
        Some("rust") => {
            let options = parse_options(&args[1..], "emit rust")?;
            let schema_path = options.required_schema("emit rust")?;
            let out_path = options.required_out("emit rust")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            let operations = list_schema_operations_sdl(&sdl)?;
            let rust = emit_rust_with_operations(&ir, &operations);

            write_file(&out_path, &rust, "Rust output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                RUST_GENERATOR_NAME,
                RUST_GENERATOR_VERSION,
            )?;
            Ok(EXIT_OK)
        }
        Some("typescript") if wants_help(&args[1..]) => {
            print_emit_help();
            Ok(EXIT_OK)
        }
        Some("typescript") => {
            let options = parse_options(&args[1..], "emit typescript")?;
            let schema_path = options.required_schema("emit typescript")?;
            let out_path = options.required_out("emit typescript")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            let operations = list_schema_operations_sdl(&sdl)?;
            let typescript = emit_typescript_with_operations(&ir, &operations);

            write_file(&out_path, &typescript, "TypeScript output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                TYPESCRIPT_GENERATOR_NAME,
                TYPESCRIPT_GENERATOR_VERSION,
            )?;
            Ok(EXIT_OK)
        }
        Some("le-binary-typescript") if wants_help(&args[1..]) => {
            print_emit_help();
            Ok(EXIT_OK)
        }
        Some("le-binary-typescript") => {
            let options = parse_options(&args[1..], "emit le-binary-typescript")?;
            let schema_path = options.required_schema("emit le-binary-typescript")?;
            let out_path = options.required_out("emit le-binary-typescript")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            let operations = list_schema_operations_sdl(&sdl)?;
            let codec_import = options
                .codec_import
                .as_deref()
                .unwrap_or(DEFAULT_CODEC_IMPORT);
            let typescript = emit_le_binary_typescript(&ir, &operations, codec_import);

            write_file(&out_path, &typescript, "LE binary TypeScript output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                LE_BINARY_TYPESCRIPT_GENERATOR_NAME,
                TYPESCRIPT_GENERATOR_VERSION,
            )?;
            Ok(EXIT_OK)
        }
        Some("le-binary-rust") if wants_help(&args[1..]) => {
            print_emit_help();
            Ok(EXIT_OK)
        }
        Some("le-binary-rust") => {
            let options = parse_options(&args[1..], "emit le-binary-rust")?;
            let schema_path = options.required_schema("emit le-binary-rust")?;
            let out_path = options.required_out("emit le-binary-rust")?;
            let sdl = read_file(&schema_path, "schema")?;
            let ir = lower_schema_sdl(&sdl)?;
            let operations = list_schema_operations_sdl(&sdl)?;
            let codec_import = options
                .codec_import
                .as_deref()
                .unwrap_or(LE_BINARY_RUST_DEFAULT_CODEC_IMPORT);
            let rust = emit_le_binary_rust(&ir, &operations, codec_import);

            write_file(&out_path, &rust, "LE binary Rust output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                LE_BINARY_RUST_GENERATOR_NAME,
                RUST_GENERATOR_VERSION,
            )?;
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!("unknown emit command '{command}'"))),
    }
}

fn run_operation_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_operation_help();
            Ok(EXIT_OK)
        }
        Some("selections") if wants_help(&args[1..]) => {
            print_operation_help();
            Ok(EXIT_OK)
        }
        Some("selections") => {
            let options = parse_options(&args[1..], "operation selections")?;
            let operation_path = options.required_operation("operation selections")?;
            let operation_sdl = read_file(&operation_path, "operation")?;
            let selections = if let Some(schema_path) = options.schema {
                let schema_sdl = read_file(&schema_path, "schema")?;
                resolve_operation_selections_with_schema(&schema_sdl, &operation_sdl)?
            } else {
                resolve_operation_selections(&operation_sdl)?
            };

            if options.json {
                print_json(&selections)?;
            } else {
                for selection in selections {
                    println!("{selection}");
                }
            }

            Ok(EXIT_OK)
        }
        Some("directive-args") if wants_help(&args[1..]) => {
            print_operation_help();
            Ok(EXIT_OK)
        }
        Some("directive-args") => {
            let options = parse_options(&args[1..], "operation directive-args")?;
            let operation_path = options.required_operation("operation directive-args")?;
            let directive_name = options.required_directive("operation directive-args")?;
            let operation_sdl = read_file(&operation_path, "operation")?;
            let directives = extract_operation_directive_args(&operation_sdl, &directive_name)?;

            print_json(&directives)?;
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!(
            "unknown operation command '{command}'"
        ))),
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DoctorOutputFormat {
    Text,
    Json,
}

fn parse_doctor_options(args: &[String]) -> Result<DoctorOutputFormat, CliError> {
    let mut output_format = DoctorOutputFormat::Text;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--json" => output_format = DoctorOutputFormat::Json,
            "--format" => {
                index += 1;
                let format = required_value(args, index, "--format")?;
                output_format = match format.as_str() {
                    "text" => DoctorOutputFormat::Text,
                    "json" => DoctorOutputFormat::Json,
                    format => {
                        return Err(CliError::usage(format!(
                            "unknown output format '{format}'; expected text or json"
                        )));
                    }
                };
            }
            "--help" | "-h" => {
                return Err(CliError::usage(
                    "`doctor` help should be handled before option parsing",
                ));
            }
            value if value.starts_with('-') => {
                return Err(CliError::usage(format!(
                    "unknown option '{value}' for `doctor`"
                )));
            }
            value => {
                return Err(CliError::usage(format!(
                    "unexpected argument '{value}' for `doctor`"
                )));
            }
        }

        index += 1;
    }

    Ok(output_format)
}

const DOCTOR_MINIMAL_SDL: &str = "type Query { health: Boolean }\n";

fn build_doctor_report() -> DoctorReport {
    let checks = vec![
        DoctorCheck::pass(
            "native-cli",
            format!(
                "wesley-cli {} ({RUST_NATIVE_EXECUTION_MODE})",
                env!("CARGO_PKG_VERSION")
            ),
        ),
        doctor_lowering_check(),
        doctor_normalized_sdl_hash_check(),
        doctor_rust_emitter_check(),
        doctor_typescript_emitter_check(),
    ];
    let ok = checks
        .iter()
        .all(|check| check.status == DoctorStatus::Pass);

    DoctorReport {
        ok,
        execution_mode: RUST_NATIVE_EXECUTION_MODE,
        checks,
    }
}

fn doctor_lowering_check() -> DoctorCheck {
    match lower_schema_sdl(DOCTOR_MINIMAL_SDL) {
        Ok(ir) if !ir.types.is_empty() => DoctorCheck::pass(
            "rust-core-lowering",
            "wesley-core lowerer accepts minimal SDL",
        ),
        Ok(_) => DoctorCheck::fail(
            "rust-core-lowering",
            "wesley-core lowerer returned no types",
        ),
        Err(error) => DoctorCheck::fail(
            "rust-core-lowering",
            format!("wesley-core lowerer rejected minimal SDL: {error}"),
        ),
    }
}

fn doctor_normalized_sdl_hash_check() -> DoctorCheck {
    match normalize_schema_sdl(DOCTOR_MINIMAL_SDL) {
        Ok(normalized) => {
            let hash = compute_content_hash(&normalized);
            if hash.len() == 64 && hash.chars().all(|character| character.is_ascii_hexdigit()) {
                DoctorCheck::pass(
                    "normalized-sdl-hash",
                    "normalized SDL hash evidence is available",
                )
            } else {
                DoctorCheck::fail(
                    "normalized-sdl-hash",
                    format!("normalized SDL hash had unexpected shape: {hash}"),
                )
            }
        }
        Err(error) => DoctorCheck::fail(
            "normalized-sdl-hash",
            format!("normalized SDL hash evidence failed: {error}"),
        ),
    }
}

fn doctor_rust_emitter_check() -> DoctorCheck {
    match doctor_emitter_inputs() {
        Ok((ir, operations)) => {
            let output = emit_rust_with_operations(&ir, &operations);
            if output.trim().is_empty() {
                DoctorCheck::fail("rust-emitter", "wesley-emit-rust returned empty output")
            } else {
                DoctorCheck::pass(
                    "rust-emitter",
                    format!("wesley-emit-rust {RUST_GENERATOR_VERSION} available"),
                )
            }
        }
        Err(error) => DoctorCheck::fail(
            "rust-emitter",
            format!("wesley-emit-rust input preparation failed: {error}"),
        ),
    }
}

fn doctor_typescript_emitter_check() -> DoctorCheck {
    match doctor_emitter_inputs() {
        Ok((ir, operations)) => {
            let output = emit_typescript_with_operations(&ir, &operations);
            if output.trim().is_empty() {
                DoctorCheck::fail(
                    "typescript-emitter",
                    "wesley-emit-typescript returned empty output",
                )
            } else {
                DoctorCheck::pass(
                    "typescript-emitter",
                    format!("wesley-emit-typescript {TYPESCRIPT_GENERATOR_VERSION} available"),
                )
            }
        }
        Err(error) => DoctorCheck::fail(
            "typescript-emitter",
            format!("wesley-emit-typescript input preparation failed: {error}"),
        ),
    }
}

fn doctor_emitter_inputs() -> Result<(WesleyIR, Vec<wesley_core::SchemaOperation>), WesleyError> {
    let ir = lower_schema_sdl(DOCTOR_MINIMAL_SDL)?;
    let operations = list_schema_operations_sdl(DOCTOR_MINIMAL_SDL)?;

    Ok((ir, operations))
}

fn print_doctor_text(report: &DoctorReport) {
    for check in &report.checks {
        println!("[{}] {}", check.status, check.message);
    }
}

#[derive(Default)]
struct ParsedOptions {
    schema: Option<PathBuf>,
    config: Option<PathBuf>,
    old_schema: Option<PathBuf>,
    new_schema: Option<PathBuf>,
    revision: Option<String>,
    operation: Option<PathBuf>,
    out: Option<PathBuf>,
    metadata_out: Option<PathBuf>,
    codec_import: Option<String>,
    directive: Option<String>,
    changed: Vec<String>,
    changed_file: Option<PathBuf>,
    format: Option<String>,
    breaking_only: bool,
    exit_code: bool,
    json: bool,
    hash: bool,
}

impl ParsedOptions {
    fn required_schema(&self, command: &str) -> Result<PathBuf, CliError> {
        self.schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --schema for `{command}`")))
    }

    fn required_operation(&self, command: &str) -> Result<PathBuf, CliError> {
        self.operation
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --operation for `{command}`")))
    }

    fn required_out(&self, command: &str) -> Result<PathBuf, CliError> {
        self.out
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --out for `{command}`")))
    }

    fn required_directive(&self, command: &str) -> Result<String, CliError> {
        self.directive
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --directive for `{command}`")))
    }

    fn output_format(&self) -> Result<OutputFormat, CliError> {
        if self.json {
            return Ok(OutputFormat::Json);
        }

        match self.format.as_deref().unwrap_or("text") {
            "text" | "markdown" => Ok(OutputFormat::Text),
            "json" => Ok(OutputFormat::Json),
            "summary" => Ok(OutputFormat::Summary),
            format => Err(CliError::usage(format!(
                "unknown output format '{format}'; expected text, markdown, json, or summary"
            ))),
        }
    }
}

fn parse_options(args: &[String], command: &str) -> Result<ParsedOptions, CliError> {
    let mut options = ParsedOptions::default();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--schema" | "-s" => {
                index += 1;
                options.schema = Some(PathBuf::from(required_value(args, index, "--schema")?));
            }
            "--config" if command.starts_with("config ") || command.starts_with("schema ") => {
                index += 1;
                options.config = Some(PathBuf::from(required_value(args, index, "--config")?));
            }
            "--config" => {
                return Err(CliError::usage(format!(
                    "unknown option '--config' for `{command}`"
                )));
            }
            "--changed" if command == "config changed-schemas" => {
                index += 1;
                options
                    .changed
                    .push(required_value(args, index, "--changed")?);
            }
            "--changed" => {
                return Err(CliError::usage(format!(
                    "unknown option '--changed' for `{command}`"
                )));
            }
            "--changed-file" if command == "config changed-schemas" => {
                index += 1;
                options.changed_file = Some(PathBuf::from(required_value(
                    args,
                    index,
                    "--changed-file",
                )?));
            }
            "--changed-file" => {
                return Err(CliError::usage(format!(
                    "unknown option '--changed-file' for `{command}`"
                )));
            }
            "--old" => {
                index += 1;
                options.old_schema = Some(PathBuf::from(required_value(args, index, "--old")?));
            }
            "--law" => {
                return Err(CliError::usage(format!(
                    "unknown option '--law' for `{command}`"
                )));
            }
            "--new" => {
                index += 1;
                options.new_schema = Some(PathBuf::from(required_value(args, index, "--new")?));
            }
            "--against" | "--base" => {
                let option = args[index].clone();
                index += 1;
                let revision = required_value(args, index, &option)?;
                if options.revision.replace(revision).is_some() {
                    return Err(CliError::usage(
                        "pass only one Git revision with --against or --base",
                    ));
                }
            }
            "--operation" | "-o" => {
                index += 1;
                options.operation =
                    Some(PathBuf::from(required_value(args, index, "--operation")?));
            }
            "--out" => {
                index += 1;
                options.out = Some(PathBuf::from(required_value(args, index, "--out")?));
            }
            "--family" => {
                return Err(CliError::usage(format!(
                    "unknown option '--family' for `{command}`"
                )));
            }
            "--profile" => {
                return Err(CliError::usage(format!(
                    "unknown option '--profile' for `{command}`"
                )));
            }
            "--accept" => {
                return Err(CliError::usage(format!(
                    "unknown option '--accept' for `{command}`"
                )));
            }
            "--metadata-out" if command.starts_with("emit ") => {
                index += 1;
                options.metadata_out = Some(PathBuf::from(required_value(
                    args,
                    index,
                    "--metadata-out",
                )?));
            }
            "--metadata-out" => {
                return Err(CliError::usage(format!(
                    "unknown option '--metadata-out' for `{command}`"
                )));
            }
            "--codec-import"
                if command == "emit le-binary-typescript" || command == "emit le-binary-rust" =>
            {
                index += 1;
                options.codec_import = Some(required_value(args, index, "--codec-import")?);
            }
            "--codec-import" => {
                return Err(CliError::usage(format!(
                    "unknown option '--codec-import' for `{command}`"
                )));
            }
            "--directive" | "-d" => {
                index += 1;
                let name = required_value(args, index, "--directive")?;
                let name = name.trim_start_matches('@').to_string();
                if name.is_empty() {
                    return Err(CliError::usage("missing directive name for --directive"));
                }
                options.directive = Some(name);
            }
            "--format" => {
                index += 1;
                options.format = Some(required_value(args, index, "--format")?);
            }
            "--breaking-only" => {
                options.breaking_only = true;
            }
            "--exit-code" => {
                options.exit_code = true;
            }
            "--json" => {
                options.json = true;
            }
            "--hash" if command == "normalize-sdl" => {
                options.hash = true;
            }
            "--hash" => {
                return Err(CliError::usage(format!(
                    "unknown option '--hash' for `{command}`"
                )));
            }
            "--help" | "-h" => {
                return Err(CliError::usage(format!(
                    "`{command}` does not have nested help yet; run `wesley --help`"
                )));
            }
            value if value.starts_with('-') => {
                return Err(CliError::usage(format!(
                    "unknown option '{value}' for `{command}`"
                )));
            }
            value => {
                return Err(CliError::usage(format!(
                    "unexpected argument '{value}' for `{command}`"
                )));
            }
        }

        index += 1;
    }

    Ok(options)
}

fn parse_target_verify_args(args: &[String]) -> Result<(PathBuf, bool), CliError> {
    let mut descriptor_path = None;
    let mut json = false;

    for argument in args {
        match argument.as_str() {
            "--json" => json = true,
            value if value.starts_with('-') => {
                return Err(CliError::usage(format!(
                    "unknown option '{value}' for `target verify`"
                )));
            }
            value => {
                if descriptor_path.replace(PathBuf::from(value)).is_some() {
                    return Err(CliError::usage(
                        "pass exactly one descriptor path to `target verify`",
                    ));
                }
            }
        }
    }

    let Some(descriptor_path) = descriptor_path else {
        return Err(CliError::usage(
            "missing descriptor path for `target verify`",
        ));
    };

    Ok((descriptor_path, json))
}

fn wants_help(args: &[String]) -> bool {
    args.iter()
        .any(|argument| argument == "--help" || argument == "-h")
}

fn required_value(args: &[String], index: usize, option: &str) -> Result<String, CliError> {
    let Some(value) = args.get(index) else {
        return Err(CliError::usage(format!("missing value for {option}")));
    };

    if value.starts_with('-') {
        return Err(CliError::usage(format!("missing value for {option}")));
    }

    Ok(value.clone())
}

fn validate_external_target_descriptor(
    descriptor: &ExternalTargetDescriptor,
) -> Vec<TargetVerifyDiagnostic> {
    let mut diagnostics = Vec::new();

    if descriptor.api_version != TARGET_DESCRIPTOR_API_VERSION {
        push_target_diagnostic(
            &mut diagnostics,
            "target.api_version.unsupported",
            "target descriptor apiVersion is unsupported",
            Some(&descriptor.api_version),
        );
    }

    if !is_path_safe_name(&descriptor.name) {
        push_target_diagnostic(
            &mut diagnostics,
            "target.name.path_unsafe",
            "target descriptor name must be non-empty and path-safe",
            Some(&descriptor.name),
        );
    }

    if descriptor.protocol.kind != "external-process" {
        push_target_diagnostic(
            &mut diagnostics,
            "target.protocol.kind_unsupported",
            "target protocol kind must be external-process",
            Some(&descriptor.protocol.kind),
        );
    }

    if descriptor.protocol.version != TARGET_PROCESS_PROTOCOL_VERSION {
        push_target_diagnostic(
            &mut diagnostics,
            "target.protocol.version_unsupported",
            "target process protocol version is unsupported",
            Some(&descriptor.protocol.version),
        );
    }

    if !is_safe_relative_path(&descriptor.command.program, true) {
        let code = if is_bare_program_name(&descriptor.command.program) {
            "target.command.program_bare"
        } else {
            "target.command.program_unsafe"
        };
        push_target_diagnostic(
            &mut diagnostics,
            code,
            "target command program must be a descriptor-relative path without traversal",
            Some(&descriptor.command.program),
        );
    }

    if descriptor
        .command
        .args
        .iter()
        .any(|argument| argument.contains('\0'))
    {
        push_target_diagnostic(
            &mut diagnostics,
            "target.command.arg_nul",
            "target command args must not contain NUL bytes",
            None,
        );
    }

    if descriptor.execution.timeout_ms == 0
        || descriptor.execution.timeout_ms > TARGET_VERIFY_MAX_TIMEOUT_MS
    {
        push_target_diagnostic(
            &mut diagnostics,
            "target.execution.timeout_out_of_range",
            "target execution timeout must be between 1 and the host maximum",
            Some(&descriptor.execution.timeout_ms.to_string()),
        );
    }

    if !descriptor
        .capabilities
        .inputs
        .iter()
        .any(|input| input == REQUIRED_TARGET_INPUT_IR)
    {
        push_target_diagnostic(
            &mut diagnostics,
            "target.capability.input_missing",
            "target descriptor must request the Wesley L1 IR input capability",
            Some(REQUIRED_TARGET_INPUT_IR),
        );
    }

    if !descriptor
        .capabilities
        .outputs
        .iter()
        .any(|output| output == REQUIRED_TARGET_OUTPUT_MANIFEST)
    {
        push_target_diagnostic(
            &mut diagnostics,
            "target.capability.output_missing",
            "target descriptor must declare the artifact manifest output capability",
            Some(REQUIRED_TARGET_OUTPUT_MANIFEST),
        );
    }

    if descriptor.capabilities.requires_network {
        push_target_diagnostic(
            &mut diagnostics,
            "target.capability.network_denied",
            "target verify does not grant network capability",
            None,
        );
    }

    if descriptor.capabilities.requires_ambient_filesystem {
        push_target_diagnostic(
            &mut diagnostics,
            "target.capability.ambient_filesystem_denied",
            "target verify does not grant ambient filesystem capability",
            None,
        );
    }

    if !is_safe_relative_path(&descriptor.outputs.default_out_dir, false) {
        push_target_diagnostic(
            &mut diagnostics,
            "target.output.default_dir_unsafe",
            "default output directory must be workspace-relative without traversal",
            Some(&descriptor.outputs.default_out_dir),
        );
    }

    diagnostics
}

fn push_target_diagnostic(
    diagnostics: &mut Vec<TargetVerifyDiagnostic>,
    code: &str,
    message: &str,
    subject: Option<&str>,
) {
    diagnostics.push(TargetVerifyDiagnostic {
        severity: "error".to_string(),
        code: code.to_string(),
        message: message.to_string(),
        subject: subject.map(ToOwned::to_owned),
    });
}

fn is_path_safe_name(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && trimmed == value
        && trimmed != "."
        && trimmed != ".."
        && !trimmed.contains("..")
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
        && !trimmed.contains(':')
        && !trimmed.contains('\0')
}

fn is_bare_program_name(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('/')
        && !value.contains('\\')
        && !value.contains(':')
        && !value.contains('\0')
        && !Path::new(value).is_absolute()
}

fn is_safe_relative_path(value: &str, require_nested: bool) -> bool {
    if value.trim().is_empty()
        || value.contains('\\')
        || value.contains(':')
        || value.contains('\0')
    {
        return false;
    }

    let path = Path::new(value);
    if path.is_absolute() {
        return false;
    }

    let mut normal_components = 0;
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::Normal(_) => normal_components += 1,
            std::path::Component::ParentDir
            | std::path::Component::RootDir
            | std::path::Component::Prefix(_) => return false,
        }
    }

    normal_components > 0 && (!require_nested || value.contains('/'))
}

fn read_file(path: &PathBuf, label: &str) -> Result<String, CliError> {
    fs::read_to_string(path).map_err(|source| CliError::Io {
        label: label.to_string(),
        path: path.clone(),
        source: source.to_string(),
    })
}

fn write_file(path: &Path, content: &str, label: &str) -> Result<(), CliError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|source| CliError::Io {
                label: format!("{label} directory"),
                path: parent.to_path_buf(),
                source: source.to_string(),
            })?;
        }
    }

    fs::write(path, content).map_err(|source| CliError::Io {
        label: label.to_string(),
        path: path.to_path_buf(),
        source: source.to_string(),
    })
}

fn schema_path_or_manifest_default(
    options: &ParsedOptions,
    command: &str,
) -> Result<PathBuf, CliError> {
    if let Some(schema) = options.schema.clone() {
        return Ok(schema);
    }

    let (manifest_path, manifest) = load_manifest_from_options(options)?;
    let schemas = manifest.resolved_schema_paths();
    match schemas.as_slice() {
        [schema] => Ok(resolve_manifest_relative_path(&manifest_path, &schema.path)),
        [] => Err(CliError::usage(format!(
            "missing --schema for `{command}` and manifest has no schemaPaths"
        ))),
        _ => Err(CliError::usage(format!(
            "missing --schema for `{command}` and manifest has multiple schemaPaths; pass --schema explicitly"
        ))),
    }
}

fn load_manifest_from_options(
    options: &ParsedOptions,
) -> Result<(PathBuf, ProjectManifest), CliError> {
    let manifest_path = if let Some(config) = options.config.clone() {
        config
    } else {
        discover_manifest_path()?
    };
    let source = read_file(&manifest_path, "project manifest")?;
    let manifest = load_project_manifest(&source)?;
    Ok((manifest_path, manifest))
}

fn discover_manifest_path() -> Result<PathBuf, CliError> {
    const CANDIDATES: &[&str] = &[
        "wesley.config.json",
        "wesley.config.yaml",
        "wesley.config.yml",
        ".wesley/config.json",
    ];

    let mut dir = env::current_dir()
        .map_err(|source| CliError::Git(format!("failed to read current directory: {source}")))?;
    loop {
        for candidate in CANDIDATES {
            let path = dir.join(candidate);
            if path.is_file() {
                return Ok(path);
            }
        }

        if !dir.pop() {
            break;
        }
    }

    Err(CliError::usage(
        "no Wesley manifest found; pass --config or create wesley.config.json",
    ))
}

fn resolve_manifest_relative_path(manifest_path: &Path, path: &str) -> PathBuf {
    let path = PathBuf::from(path);
    if path.is_absolute() {
        path
    } else {
        manifest_path
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .join(path)
    }
}

fn manifest_with_paths_relative_to_cwd(
    manifest_path: &Path,
    manifest: &ProjectManifest,
) -> Result<ProjectManifest, CliError> {
    let mut projected = manifest.clone();
    projected.bundle_dir = manifest_path_relative_string(manifest_path, &manifest.bundle_dir)?;
    projected.rebuild_on_globs = manifest
        .rebuild_on_globs
        .iter()
        .map(|glob| manifest_path_relative_string(manifest_path, glob))
        .collect::<Result<Vec<_>, _>>()?;
    projected.schema_paths = manifest
        .schema_paths
        .iter()
        .map(|schema| match schema {
            SchemaPathConfig::Path(path) => {
                manifest_path_relative_string(manifest_path, path).map(SchemaPathConfig::Path)
            }
            SchemaPathConfig::Detailed(config) => {
                Ok(SchemaPathConfig::Detailed(DetailedSchemaPathConfig {
                    id: config.id.clone(),
                    path: manifest_path_relative_string(manifest_path, &config.path)?,
                    rebuild_on_globs: config
                        .rebuild_on_globs
                        .iter()
                        .map(|glob| manifest_path_relative_string(manifest_path, glob))
                        .collect::<Result<Vec<_>, _>>()?,
                }))
            }
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(projected)
}

fn manifest_path_relative_string(manifest_path: &Path, path: &str) -> Result<String, CliError> {
    let resolved = resolve_manifest_relative_path(manifest_path, path);
    let path = cwd_relative_path(&resolved)?;
    Ok(path.to_string_lossy().replace('\\', "/"))
}

fn cwd_relative_path(path: &Path) -> Result<PathBuf, CliError> {
    if path.is_absolute() {
        let cwd = env::current_dir().map_err(|source| {
            CliError::Git(format!("failed to read current directory: {source}"))
        })?;
        if let Ok(relative_path) = path.strip_prefix(cwd) {
            return Ok(relative_path.to_path_buf());
        }
    }
    Ok(path.to_path_buf())
}

fn changed_files_from_options(options: &ParsedOptions) -> Result<Vec<String>, CliError> {
    let mut changed = options.changed.clone();
    if let Some(path) = &options.changed_file {
        let content = read_file(path, "changed-file list")?;
        changed.extend(
            content
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_owned),
        );
    }
    Ok(changed)
}

fn write_emit_metadata_if_requested(
    path: Option<&Path>,
    ir: &WesleyIR,
    generator: &'static str,
    generator_version: &'static str,
) -> Result<(), CliError> {
    let Some(path) = path else {
        return Ok(());
    };

    let schema_hash = compute_registry_hash(ir)?;
    let schema_hash_qualified = format!("sha256:{schema_hash}");

    let metadata = EmitMetadata {
        schema_hash,
        schema_hash_qualified,
        generator,
        generator_version,
        execution_mode: RUST_NATIVE_EXECUTION_MODE,
    };
    let mut json = serde_json::to_string_pretty(&metadata)?;
    json.push('\n');

    write_file(path, &json, "emit metadata")
}

fn read_schema_diff_inputs(options: &ParsedOptions) -> Result<(String, String), CliError> {
    let explicit_mode = options.old_schema.is_some() || options.new_schema.is_some();
    let git_mode = options.schema.is_some() || options.revision.is_some();

    match (explicit_mode, git_mode) {
        (true, true) => Err(CliError::usage(
            "`schema diff` accepts either --old/--new or --schema with --against/--base",
        )),
        (true, false) => {
            let old_schema_path = options
                .old_schema
                .clone()
                .ok_or_else(|| CliError::usage("missing --old for `schema diff`"))?;
            let new_schema_path = options
                .new_schema
                .clone()
                .ok_or_else(|| CliError::usage("missing --new for `schema diff`"))?;

            Ok((
                read_file(&old_schema_path, "old schema")?,
                read_file(&new_schema_path, "new schema")?,
            ))
        }
        (false, true) => {
            let schema_path = options
                .schema
                .clone()
                .ok_or_else(|| CliError::usage("missing --schema for `schema diff`"))?;
            let revision = options
                .revision
                .as_deref()
                .ok_or_else(|| CliError::usage("missing --against or --base for `schema diff`"))?;

            Ok((
                read_git_file(revision, &schema_path)?,
                read_file(&schema_path, "schema")?,
            ))
        }
        (false, false) => Err(CliError::usage(
            "`schema diff` needs --old/--new or --schema with --against/--base",
        )),
    }
}

fn read_git_file(revision: &str, schema_path: &Path) -> Result<String, CliError> {
    let absolute_schema_path = absolute_path(schema_path)?;
    let search_dir = absolute_schema_path
        .parent()
        .ok_or_else(|| CliError::Git("schema path has no parent directory".to_string()))?;
    let repo_root_text = git_stdout(search_dir, ["rev-parse", "--show-toplevel"])?;
    let repo_root = fs::canonicalize(repo_root_text.trim()).map_err(|source| {
        CliError::Git(format!(
            "failed to resolve Git repository root `{}`: {source}",
            repo_root_text.trim()
        ))
    })?;
    let relative_path = absolute_schema_path.strip_prefix(&repo_root).map_err(|_| {
        CliError::Git(format!(
            "schema file `{}` is outside Git repository `{}`",
            absolute_schema_path.display(),
            repo_root.display()
        ))
    })?;
    let git_path = relative_path.to_string_lossy().replace('\\', "/");
    let revision_spec = format!("{revision}:{git_path}");

    git_stdout(&repo_root, ["show", revision_spec.as_str()])
}

fn absolute_path(path: &Path) -> Result<PathBuf, CliError> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        env::current_dir()
            .map_err(|source| CliError::Git(format!("failed to read current directory: {source}")))?
            .join(path)
    };

    fs::canonicalize(&path).map_err(|source| CliError::Io {
        label: "schema".to_string(),
        path,
        source: source.to_string(),
    })
}

fn git_stdout<const N: usize>(working_dir: &Path, args: [&str; N]) -> Result<String, CliError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(working_dir)
        .args(args)
        .output()
        .map_err(|source| CliError::Git(format!("failed to run git: {source}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(CliError::Git(format!(
            "git command failed in `{}`: {detail}",
            working_dir.display()
        )));
    }

    String::from_utf8(output.stdout)
        .map_err(|source| CliError::Git(format!("git output was not UTF-8: {source}")))
}

fn print_json(value: &impl serde::Serialize) -> Result<(), CliError> {
    let json = serde_json::to_string_pretty(value)?;
    println!("{json}");
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetDescriptor {
    api_version: String,
    name: String,
    protocol: ExternalTargetProtocol,
    command: ExternalTargetCommand,
    execution: ExternalTargetExecution,
    capabilities: ExternalTargetCapabilities,
    outputs: ExternalTargetOutputs,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetProtocol {
    kind: String,
    version: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetCommand {
    program: String,
    #[serde(default)]
    args: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetExecution {
    timeout_ms: u64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetCapabilities {
    #[serde(default)]
    inputs: Vec<String>,
    #[serde(default)]
    outputs: Vec<String>,
    #[serde(default)]
    requires_network: bool,
    #[serde(default)]
    requires_ambient_filesystem: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExternalTargetOutputs {
    default_out_dir: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TargetVerifyReport {
    valid: bool,
    descriptor_path: String,
    descriptor: TargetDescriptorIdentity,
    diagnostics: Vec<TargetVerifyDiagnostic>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TargetDescriptorIdentity {
    api_version: String,
    name: String,
    protocol: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TargetVerifyDiagnostic {
    severity: String,
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    subject: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigInspectReport {
    valid: bool,
    manifest_path: String,
    resolved_schema_paths: Vec<ResolvedSchemaPath>,
    manifest: ProjectManifest,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigChangedSchemasReport {
    manifest_path: String,
    changed_files: Vec<String>,
    selected_schema_paths: Vec<SelectedSchemaPath>,
}

#[derive(Clone, Copy)]
enum OutputFormat {
    Text,
    Json,
    Summary,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FlatChange {
    breaking: bool,
    description: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct EmitMetadata {
    schema_hash: String,
    schema_hash_qualified: String,
    generator: &'static str,
    generator_version: &'static str,
    execution_mode: &'static str,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DoctorReport {
    ok: bool,
    execution_mode: &'static str,
    checks: Vec<DoctorCheck>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DoctorCheck {
    id: &'static str,
    status: DoctorStatus,
    message: String,
}

impl DoctorCheck {
    fn pass(id: &'static str, message: impl Into<String>) -> Self {
        Self {
            id,
            status: DoctorStatus::Pass,
            message: message.into(),
        }
    }

    fn fail(id: &'static str, message: impl Into<String>) -> Self {
        Self {
            id,
            status: DoctorStatus::Fail,
            message: message.into(),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum DoctorStatus {
    Pass,
    Fail,
}

impl std::fmt::Display for DoctorStatus {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pass => write!(formatter, "pass"),
            Self::Fail => write!(formatter, "fail"),
        }
    }
}

fn print_schema_delta(
    delta: &SchemaDelta,
    output_format: OutputFormat,
    breaking_only: bool,
) -> Result<(), CliError> {
    let changes = flattened_schema_changes(delta, breaking_only);

    match output_format {
        OutputFormat::Text => println!("{}", format_delta_text(&changes)),
        OutputFormat::Json if breaking_only => {
            print_json(&serde_json::json!({ "changes": changes }))?;
        }
        OutputFormat::Json => {
            print_json(delta)?;
        }
        OutputFormat::Summary => println!("{}", format_delta_summary(&changes)),
    }

    Ok(())
}

fn flattened_schema_changes(delta: &SchemaDelta, breaking_only: bool) -> Vec<FlatChange> {
    let mut changes = Vec::new();

    for change in &delta.removed_types {
        changes.push(flat_change(change.breaking, &change.description));
    }

    for modification in &delta.modified_types {
        if let Some(kind_change) = &modification.kind_change {
            changes.push(flat_change(kind_change.breaking, &kind_change.description));
        }

        for change in &modification.field_changes {
            changes.push(flat_change(change.breaking, &change.description));
        }
        for change in &modification.enum_value_changes {
            changes.push(flat_change(change.breaking, &change.description));
        }
        for change in &modification.union_member_changes {
            changes.push(flat_change(change.breaking, &change.description));
        }
        for change in &modification.implements_changes {
            changes.push(flat_change(change.breaking, &change.description));
        }
        for change in &modification.directive_changes {
            changes.push(flat_change(change.breaking, &change.description));
        }
    }

    for change in &delta.added_types {
        changes.push(flat_change(change.breaking, &change.description));
    }

    if breaking_only {
        changes.retain(|change| change.breaking);
    }

    changes
}

fn flat_change(breaking: bool, description: &str) -> FlatChange {
    FlatChange {
        breaking,
        description: description.to_string(),
    }
}

fn format_delta_text(changes: &[FlatChange]) -> String {
    if changes.is_empty() {
        return "No changes detected.".to_string();
    }

    changes
        .iter()
        .map(|change| {
            let tag = if change.breaking {
                "BREAKING"
            } else {
                "safe    "
            };
            format!("{tag}  {}", change.description)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_delta_summary(changes: &[FlatChange]) -> String {
    if changes.is_empty() {
        return "No changes detected.".to_string();
    }

    let breaking = changes.iter().filter(|change| change.breaking).count();
    let safe = changes.len() - breaking;
    let mut parts = Vec::new();

    if breaking > 0 {
        parts.push(format!("{breaking} breaking"));
    }
    if safe > 0 {
        parts.push(format!("{safe} safe"));
    }

    parts.join(", ")
}

fn print_help() {
    println!(
        "\
Wesley native CLI

Usage:
  wesley <command> [options]

Commands:
  normalize-sdl            Print the Rust-core normalized SDL view
  doctor                   Run Rust-native health checks
  config validate          Validate a Wesley project manifest
  config inspect           Print resolved manifest schema paths and targets
  config changed-schemas   Select schema sets affected by changed files
  target verify            Validate an external target descriptor
  schema lower              Lower GraphQL SDL to Wesley L1 IR JSON
  schema hash               Print the Wesley L1 registry hash for GraphQL SDL
  schema operations         List Query/Mutation/Subscription root operations
  schema diff               Compare GraphQL SDL states as Wesley L1 IR
  emit rust                 Emit Rust models and operation bindings from GraphQL SDL
  emit typescript           Emit TypeScript declarations and operation bindings from GraphQL SDL
  emit le-binary-typescript Emit TypeScript LE binary codecs from GraphQL SDL
  emit le-binary-rust       Emit Rust LE binary codecs from GraphQL SDL
  operation selections      Resolve selected operation fields
  operation directive-args  Extract operation directive arguments as JSON
  version                   Print the native CLI version

Options:
  -h, --help     Show help
  -V, --version  Show version"
    );
}

fn print_doctor_help() {
    println!(
        "\
Wesley native doctor

Rust-native health checks only. This command does not inspect legacy Node,
pnpm, config modules, or plugin packages.

Usage:
  wesley doctor [--json]
  wesley doctor [--format text|json]

Options:
  --json                 Emit JSON output
  --format text|json     Output format"
    );
}

fn print_config_help() {
    println!(
        "\
Wesley project manifest commands

Manifest files are domain-free JSON or YAML documents. The CLI discovers
wesley.config.json, wesley.config.yaml, or wesley.config.yml by walking upward
from the current directory when --config is omitted.

Usage:
  wesley config validate [--config <path>] [--json]
  wesley config inspect [--config <path>] [--json]
  wesley config changed-schemas [--config <path>] [--changed <path> ...] [--changed-file <path>] [--json]

Options:
  --config <path>        Manifest path; defaults to upward discovery
  --changed <path>       Changed file path; may be passed more than once
  --changed-file <path>  Newline-delimited changed file list
  --json                 Emit JSON output"
    );
}

fn print_target_help() {
    println!(
        "\
Wesley target commands

External target commands validate descriptor metadata without assigning product
or runtime meaning to Wesley core.

Usage:
  wesley target verify <descriptor> [--json]

Options:
  --json  Emit JSON output"
    );
}

fn print_normalize_sdl_help() {
    println!(
        "\
Wesley SDL normalizer

Usage:
  wesley normalize-sdl --schema <path> [--hash]

Options:
  -s, --schema <path>  GraphQL SDL file
  --hash               Print the SHA-256 of the normalized SDL"
    );
}

fn print_schema_help() {
    println!(
        "\
Wesley schema commands

Usage:
  wesley schema lower --schema <path> [--json]
  wesley schema hash --schema <path> [--json]
  wesley schema operations --schema <path> [--json]
  wesley schema diff --old <path> --new <path> [--format text|json|summary] [--breaking-only] [--exit-code]
  wesley schema diff --schema <path> --against <rev> [--format text|json|summary] [--breaking-only] [--exit-code]

Options:
  -s, --schema <path>  GraphQL SDL file
  --old <path>         Old/base GraphQL SDL file
  --new <path>         New/target GraphQL SDL file
  --against <rev>      Git revision that provides the old schema state
  --base <rev>         Alias for --against
  --json               Emit JSON output"
    );
}

fn print_emit_help() {
    println!(
        "\
Wesley emit commands

Emits model declarations and root operation bindings when the schema declares
Query, Mutation, or Subscription fields.

Usage:
  wesley emit rust --schema <path> --out <path> [--metadata-out <path>]
  wesley emit typescript --schema <path> --out <path> [--metadata-out <path>]
  wesley emit le-binary-typescript --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]
  wesley emit le-binary-rust --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]

Options:
  -s, --schema <path>    GraphQL SDL file
  --out <path>           Output file
  --metadata-out <path>  Deterministic metadata JSON sidecar
  --codec-import <path>  Module specifier for Writer/Reader/CodecError (le-binary-* only)"
    );
}

fn print_operation_help() {
    println!(
        "\
Wesley operation commands

Usage:
  wesley operation selections --operation <path> [--schema <path>] [--json]
  wesley operation directive-args --operation <path> --directive <name> [--json]

Options:
  -o, --operation <path>  GraphQL operation file
  -s, --schema <path>     Optional GraphQL schema SDL file
  -d, --directive <name>  Directive name, without or with @"
    );
}

#[derive(Debug)]
enum CliError {
    Usage(String),
    Io {
        label: String,
        path: PathBuf,
        source: String,
    },
    Core(WesleyError),
    Config(ProjectManifestError),
    Git(String),
    Json(String),
    JsonInput {
        label: String,
        path: PathBuf,
        source: String,
    },
}

impl CliError {
    fn usage(message: impl Into<String>) -> Self {
        Self::Usage(message.into())
    }

    fn exit_code(&self) -> u8 {
        match self {
            Self::Usage(_) => EXIT_USAGE,
            Self::Io { .. }
            | Self::Core(_)
            | Self::Config(_)
            | Self::Git(_)
            | Self::Json(_)
            | Self::JsonInput { .. } => EXIT_FAILURE,
        }
    }
}

impl std::fmt::Display for CliError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Usage(message) => {
                writeln!(formatter, "{message}")?;
                write!(formatter, "Run `wesley --help` for usage.")
            }
            Self::Io {
                label,
                path,
                source,
            } => write!(
                formatter,
                "failed to access {label} `{}`: {source}",
                path.display()
            ),
            Self::Core(error) => write!(formatter, "{error}"),
            Self::Config(error) => write!(formatter, "{error}"),
            Self::Git(error) => write!(formatter, "git error: {error}"),
            Self::Json(error) => write!(formatter, "failed to serialize JSON output: {error}"),
            Self::JsonInput {
                label,
                path,
                source,
            } => write!(
                formatter,
                "failed to parse {label} `{}`: {source}",
                path.display()
            ),
        }
    }
}

impl From<WesleyError> for CliError {
    fn from(error: WesleyError) -> Self {
        Self::Core(error)
    }
}

impl From<ProjectManifestError> for CliError {
    fn from(error: ProjectManifestError) -> Self {
        Self::Config(error)
    }
}

impl From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error.to_string())
    }
}
