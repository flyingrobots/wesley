//! Native Wesley CLI entry point.

use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use wesley_core::{
    build_contract_bundle_manifest_v1, compute_content_hash, compute_law_hash_v1,
    compute_registry_hash, diff_law_ir_v1, diff_schema_sdl, extract_operation_directive_args,
    format_law_diff_markdown_v1, list_schema_operations_sdl, load_weslaw_yaml, lower_schema_sdl,
    lower_wes_channel_directives_to_law_ir_v1, normalize_schema_sdl, record_law_binding_error_v1,
    resolve_operation_selections, resolve_operation_selections_with_schema,
    ContractBundleManifestV1, FootprintLawV1, LawDiffReportV1, LawEntryBodyV1, LawIrV1,
    OperationType, ScalarSemanticsLawV1, SchemaDelta, TypeKind, WeslawError, WesleyError, WesleyIR,
};
use wesley_emit_rust::{
    emit_rust_with_operations, emit_rust_with_operations_and_law,
    GENERATOR_NAME as RUST_GENERATOR_NAME, GENERATOR_VERSION as RUST_GENERATOR_VERSION,
};
use wesley_emit_typescript::{
    emit_le_binary_typescript, emit_typescript_with_operations, DEFAULT_CODEC_IMPORT,
    GENERATOR_NAME as TYPESCRIPT_GENERATOR_NAME,
    GENERATOR_VERSION as TYPESCRIPT_GENERATOR_VERSION,
    LE_BINARY_GENERATOR_NAME as LE_BINARY_TYPESCRIPT_GENERATOR_NAME,
};

const EXIT_OK: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const EXIT_USAGE: u8 = 2;
const RUST_NATIVE_EXECUTION_MODE: &str = "rust-native";

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
        Some("init-law") if wants_help(&args[1..]) => {
            print_init_law_help();
            Ok(EXIT_OK)
        }
        Some("init-law") => run_init_law_command(&args[1..]),
        Some("schema") => run_schema_command(&args[1..]),
        Some("law") => run_law_command(&args[1..]),
        Some("emit") => run_emit_command(&args[1..]),
        Some("operation") => run_operation_command(&args[1..]),
        Some("version") | Some("--version") | Some("-V") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!("unknown command '{command}'"))),
    }
}

fn run_law_command(args: &[String]) -> Result<u8, CliError> {
    match args.first().map(String::as_str) {
        None | Some("--help") | Some("-h") => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("validate") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("validate") => {
            let options = parse_options(&args[1..], "law validate")?;
            let schema_path = options.required_schema("law validate")?;
            let law_path = options.required_law("law validate")?;
            let schema_sdl = read_file(&schema_path, "schema")?;
            let law_source = read_file(&law_path, "law")?;
            let ir = lower_schema_sdl(&schema_sdl)?;
            let operations = list_schema_operations_sdl(&schema_sdl)?;
            let law_ir = load_weslaw_yaml(&law_source)?;
            let manifest = build_contract_bundle_manifest_v1(&law_ir, &ir, &operations)?;

            if options.json {
                print_json(&LawValidateReport {
                    schema_hash: manifest.schema_hash.clone(),
                    law_hash: manifest.law_hash.clone(),
                    law_document_hash: manifest.law_document_hash.clone(),
                    profile_hash: manifest.profile_hash.clone(),
                    bundle_hash: manifest.bundle_hash.clone(),
                    bound_entry_count: manifest.law_entry_count,
                    manifest,
                })?;
            } else {
                println!(
                    "Law validation passed: {} active entries bound to {} (lawHash {}, bundleHash {})",
                    manifest.law_entry_count,
                    manifest.schema_hash,
                    manifest.law_hash,
                    manifest.bundle_hash
                );
            }

            Ok(EXIT_OK)
        }
        Some("lint") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("lint") => run_law_lint_command(&args[1..]),
        Some("diff") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("diff") => run_law_diff_command(&args[1..]),
        Some("explain") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("explain") => run_law_explain_command(&args[1..]),
        Some("rebind") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("rebind") => run_law_rebind_command(&args[1..]),
        Some("capabilities") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("capabilities") => run_law_capabilities_command(&args[1..]),
        Some("coverage") if wants_help(&args[1..]) => {
            print_law_help();
            Ok(EXIT_OK)
        }
        Some("coverage") => run_law_coverage_command(&args[1..]),
        Some(command) => Err(CliError::usage(format!("unknown law command '{command}'"))),
    }
}

fn run_law_lint_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law lint")?;
    let law_path = options.required_law("law lint")?;
    let law_source = read_file(&law_path, "law")?;
    let law_ir = load_weslaw_yaml(&law_source)?;
    let report = LawLintReport {
        api_version: law_ir.api_version.clone(),
        family: law_ir.family.clone(),
        schema_hash: law_ir.schema_hash.clone(),
        active_entry_count: law_ir.entries.len(),
        law_hash: compute_law_hash_v1(&law_ir)?,
    };

    if options.json {
        print_json(&report)?;
    } else {
        println!(
            "Law lint passed: {} active entries in {} (lawHash {})",
            report.active_entry_count, report.family, report.law_hash
        );
    }

    Ok(EXIT_OK)
}

fn run_law_diff_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law diff")?;
    let old_path = options.required_old("law diff")?;
    let new_path = options.required_new("law diff")?;
    let old_law_source = read_file(&old_path, "old law")?;
    let new_law_source = read_file(&new_path, "new law")?;
    let old_law_ir = load_weslaw_yaml(&old_law_source)?;
    let new_law_ir = load_weslaw_yaml(&new_law_source)?;
    let mut report = diff_law_ir_v1(&old_law_ir, &new_law_ir)?;
    let mut exit_code = EXIT_OK;

    if let Some(schema_path) = options.schema.as_ref() {
        let schema_sdl = read_file(schema_path, "schema")?;
        let ir = lower_schema_sdl(&schema_sdl)?;
        let operations = list_schema_operations_sdl(&schema_sdl)?;
        if let Err(error) = build_contract_bundle_manifest_v1(&new_law_ir, &ir, &operations) {
            record_law_binding_error_v1(&mut report, &error);
            exit_code = EXIT_FAILURE;
        }
    }

    print_law_diff(&report, options.output_format()?)?;
    Ok(exit_code)
}

fn run_init_law_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "init-law")?;
    let schema_path = options.required_schema("init-law")?;
    let family = options.required_family("init-law")?;
    let schema_sdl = read_file(&schema_path, "schema")?;
    let ir = lower_schema_sdl(&schema_sdl)?;
    let schema_hash = format!("sha256:{}", compute_registry_hash(&ir)?);
    let law_ir = lower_wes_channel_directives_to_law_ir_v1(
        &ir,
        &family,
        &schema_hash,
        Some(schema_path.display().to_string()),
    )?;
    let drafts = draft_suggestions_from_descriptions(&ir);
    let output = render_weslaw_yaml(&law_ir, &drafts);

    if let Some(out) = options.out.as_ref() {
        write_file(out, &output, "weslaw scaffold")?;
    } else {
        print!("{output}");
    }

    Ok(EXIT_OK)
}

fn run_law_explain_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law explain")?;
    let law_path = options.required_law("law explain")?;
    let subject = options.required_subject("law explain")?;
    let law_source = read_file(&law_path, "law")?;
    let law_ir = load_weslaw_yaml(&law_source)?;
    let explanation = explain_law_subject(&law_ir, &subject)?;

    if options.json {
        print_json(&explanation)?;
    } else {
        print!("{}", explanation.to_text());
    }

    Ok(EXIT_OK)
}

fn run_law_rebind_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law rebind")?;
    let schema_path = options.required_schema("law rebind")?;
    let law_path = options.required_law("law rebind")?;
    let schema_sdl = read_file(&schema_path, "schema")?;
    let law_source = read_file(&law_path, "law")?;
    let ir = lower_schema_sdl(&schema_sdl)?;
    let operations = list_schema_operations_sdl(&schema_sdl)?;
    let old_law_ir = load_weslaw_yaml(&law_source)?;
    let new_schema_hash = format!("sha256:{}", compute_registry_hash(&ir)?);
    let mut report = LawRebindReport {
        api_version: "wesley.law-rebind/v1",
        old_schema_hash: old_law_ir.schema_hash.clone(),
        new_schema_hash: new_schema_hash.clone(),
        changed: old_law_ir.schema_hash != new_schema_hash,
        accepted: false,
        output: None,
    };

    if options.accept {
        let out = options.required_out("law rebind --accept")?;
        let rebound = replace_schema_hash_anchor(
            &law_source,
            &old_law_ir.schema_hash,
            &new_schema_hash,
            &law_path,
        )?;
        let rebound_law_ir = load_weslaw_yaml(&rebound)?;
        build_contract_bundle_manifest_v1(&rebound_law_ir, &ir, &operations)?;
        write_file(&out, &rebound, "rebound law")?;
        report.accepted = true;
        report.output = Some(out.display().to_string());
    }

    if options.json {
        print_json(&report)?;
    } else if report.accepted {
        println!(
            "Law rebind accepted: {} -> {} ({})",
            report.old_schema_hash,
            report.new_schema_hash,
            report.output.as_deref().unwrap_or("-")
        );
    } else if report.changed {
        println!(
            "Law rebind required: {} -> {}",
            report.old_schema_hash, report.new_schema_hash
        );
    } else {
        println!("Law rebind not required: {}", report.new_schema_hash);
    }

    Ok(EXIT_OK)
}

fn run_law_capabilities_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law capabilities")?;
    let law_path = options.required_law("law capabilities")?;
    let law_source = read_file(&law_path, "law")?;
    let law_ir = load_weslaw_yaml(&law_source)?;
    let report = capability_report_from_law(&law_ir);

    if options.json {
        print_json(&report)?;
    } else {
        println!(
            "Capability report: {} footprint(s), reportOnly={}, runtimeEnforcement={}",
            report.footprints.len(),
            report.report_only,
            report.runtime_enforcement
        );
        for footprint in &report.footprints {
            println!("{} {}", footprint.subject, footprint.law_id);
            print_nonempty_list("  reads", &footprint.reads);
            print_nonempty_list("  writes", &footprint.writes);
            print_nonempty_list("  creates", &footprint.creates);
            print_nonempty_list("  forbids", &footprint.forbids);
        }
    }

    Ok(EXIT_OK)
}

fn run_law_coverage_command(args: &[String]) -> Result<u8, CliError> {
    let options = parse_options(args, "law coverage")?;
    let schema_path = options.required_schema("law coverage")?;
    let law_path = options.required_law("law coverage")?;
    let schema_sdl = read_file(&schema_path, "schema")?;
    let law_source = read_file(&law_path, "law")?;
    let ir = lower_schema_sdl(&schema_sdl)?;
    let operations = list_schema_operations_sdl(&schema_sdl)?;
    let law_ir = load_weslaw_yaml(&law_source)?;
    build_contract_bundle_manifest_v1(&law_ir, &ir, &operations)?;
    let profile = coverage_profile_or_default(options.profile.as_deref())?.to_string();
    let report = law_coverage_report(&ir, &operations, &law_ir, &profile);

    if options.json {
        print_json(&report)?;
    } else {
        println!(
            "Law coverage profile {}: {}/{} required subjects covered ({:.1}%)",
            report.profile, report.required_covered, report.required_total, report.required_percent
        );
        for category in &report.categories {
            println!(
                "{}: {}/{} covered{}",
                category.id,
                category.covered,
                category.total,
                if category.required { " required" } else { "" }
            );
        }
    }

    Ok(EXIT_OK)
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
            let schema_path = options.required_schema("schema lower")?;
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
            let schema_path = options.required_schema("schema hash")?;
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
            let schema_path = options.required_schema("schema operations")?;
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
            let bundle =
                load_contract_bundle_if_requested(options.law.as_deref(), &ir, &operations)?;
            let manifest = bundle.as_ref().map(|bundle| &bundle.manifest);
            let rust = if let Some(bundle) = &bundle {
                emit_rust_with_operations_and_law(
                    &ir,
                    &operations,
                    &bundle.manifest.schema_hash,
                    &bundle.manifest.law_hash,
                    &bundle.law_ir,
                )
            } else {
                emit_rust_with_operations(&ir, &operations)
            };

            write_file(&out_path, &rust, "Rust output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                manifest,
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
            let bundle =
                load_contract_bundle_if_requested(options.law.as_deref(), &ir, &operations)?;
            let manifest = bundle.as_ref().map(|bundle| &bundle.manifest);
            let typescript = emit_typescript_with_operations(&ir, &operations);

            write_file(&out_path, &typescript, "TypeScript output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                manifest,
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
            let bundle =
                load_contract_bundle_if_requested(options.law.as_deref(), &ir, &operations)?;
            let manifest = bundle.as_ref().map(|bundle| &bundle.manifest);
            let codec_import = options
                .codec_import
                .as_deref()
                .unwrap_or(DEFAULT_CODEC_IMPORT);
            let typescript = emit_le_binary_typescript(&ir, &operations, codec_import);

            write_file(&out_path, &typescript, "LE binary TypeScript output")?;
            write_emit_metadata_if_requested(
                options.metadata_out.as_deref(),
                &ir,
                manifest,
                LE_BINARY_TYPESCRIPT_GENERATOR_NAME,
                TYPESCRIPT_GENERATOR_VERSION,
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
    law: Option<PathBuf>,
    old_schema: Option<PathBuf>,
    new_schema: Option<PathBuf>,
    revision: Option<String>,
    operation: Option<PathBuf>,
    out: Option<PathBuf>,
    metadata_out: Option<PathBuf>,
    codec_import: Option<String>,
    directive: Option<String>,
    family: Option<String>,
    profile: Option<String>,
    subject: Option<String>,
    format: Option<String>,
    breaking_only: bool,
    exit_code: bool,
    json: bool,
    hash: bool,
    accept: bool,
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

    fn required_law(&self, command: &str) -> Result<PathBuf, CliError> {
        self.law
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --law for `{command}`")))
    }

    fn required_old(&self, command: &str) -> Result<PathBuf, CliError> {
        self.old_schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --old for `{command}`")))
    }

    fn required_new(&self, command: &str) -> Result<PathBuf, CliError> {
        self.new_schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --new for `{command}`")))
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

    fn required_family(&self, command: &str) -> Result<String, CliError> {
        self.family
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --family for `{command}`")))
    }

    fn required_subject(&self, command: &str) -> Result<String, CliError> {
        self.subject
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing subject for `{command}`")))
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
            "--old" => {
                index += 1;
                options.old_schema = Some(PathBuf::from(required_value(args, index, "--old")?));
            }
            "--law"
                if matches!(
                    command,
                    "law validate"
                        | "law lint"
                        | "law explain"
                        | "law rebind"
                        | "law capabilities"
                        | "law coverage"
                ) || command.starts_with("emit ") =>
            {
                index += 1;
                options.law = Some(PathBuf::from(required_value(args, index, "--law")?));
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
            "--family" if command == "init-law" => {
                index += 1;
                options.family = Some(required_value(args, index, "--family")?);
            }
            "--family" => {
                return Err(CliError::usage(format!(
                    "unknown option '--family' for `{command}`"
                )));
            }
            "--profile" if command == "law coverage" => {
                index += 1;
                options.profile = Some(required_value(args, index, "--profile")?);
            }
            "--profile" => {
                return Err(CliError::usage(format!(
                    "unknown option '--profile' for `{command}`"
                )));
            }
            "--accept" if command == "law rebind" => {
                options.accept = true;
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
            "--codec-import" if command == "emit le-binary-typescript" => {
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
            value if command == "law explain" => {
                if options.subject.replace(value.to_string()).is_some() {
                    return Err(CliError::usage("pass exactly one subject to `law explain`"));
                }
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

fn write_emit_metadata_if_requested(
    path: Option<&Path>,
    ir: &WesleyIR,
    manifest: Option<&ContractBundleManifestV1>,
    generator: &'static str,
    generator_version: &'static str,
) -> Result<(), CliError> {
    let Some(path) = path else {
        return Ok(());
    };

    let schema_hash = manifest
        .map(|manifest| unqualified_sha256(&manifest.schema_hash))
        .transpose()?
        .unwrap_or(compute_registry_hash(ir)?);
    let schema_hash_qualified = manifest
        .map(|manifest| manifest.schema_hash.clone())
        .unwrap_or_else(|| format!("sha256:{schema_hash}"));

    let metadata = EmitMetadata {
        schema_hash,
        schema_hash_qualified,
        law_hash: manifest.map(|manifest| manifest.law_hash.clone()),
        law_document_hash: manifest.and_then(|manifest| manifest.law_document_hash.clone()),
        profile_hash: manifest.map(|manifest| manifest.profile_hash.clone()),
        bundle_hash: manifest.map(|manifest| manifest.bundle_hash.clone()),
        law_ir_codec: manifest.map(|manifest| manifest.law_ir_codec.clone()),
        generator,
        generator_version,
        execution_mode: RUST_NATIVE_EXECUTION_MODE,
    };
    let mut json = serde_json::to_string_pretty(&metadata)?;
    json.push('\n');

    write_file(path, &json, "emit metadata")
}

struct LoadedContractBundle {
    law_ir: LawIrV1,
    manifest: ContractBundleManifestV1,
}

fn load_contract_bundle_if_requested(
    law_path: Option<&Path>,
    ir: &WesleyIR,
    operations: &[wesley_core::SchemaOperation],
) -> Result<Option<LoadedContractBundle>, CliError> {
    let Some(law_path) = law_path else {
        return Ok(None);
    };

    let law_source = fs::read_to_string(law_path).map_err(|source| CliError::Io {
        label: "law".to_string(),
        path: law_path.to_path_buf(),
        source: source.to_string(),
    })?;
    let law_ir = load_weslaw_yaml(&law_source)?;
    let manifest = build_contract_bundle_manifest_v1(&law_ir, ir, operations)?;

    Ok(Some(LoadedContractBundle { law_ir, manifest }))
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
struct LawValidateReport {
    schema_hash: String,
    law_hash: String,
    law_document_hash: Option<String>,
    profile_hash: String,
    bundle_hash: String,
    bound_entry_count: usize,
    manifest: ContractBundleManifestV1,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LawLintReport {
    api_version: String,
    family: String,
    schema_hash: String,
    active_entry_count: usize,
    law_hash: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LawExplanation {
    subject: String,
    law_count: usize,
    lines: Vec<String>,
}

impl LawExplanation {
    fn to_text(&self) -> String {
        let mut output = format!("Subject: {}\n", self.subject);
        output.push_str(&format!("Bound laws: {}\n", self.law_count));
        for line in &self.lines {
            output.push_str(line);
            output.push('\n');
        }
        output
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LawRebindReport {
    api_version: &'static str,
    old_schema_hash: String,
    new_schema_hash: String,
    changed: bool,
    accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityReport {
    api_version: &'static str,
    report_only: bool,
    runtime_enforcement: bool,
    note: &'static str,
    footprints: Vec<CapabilityFootprintReport>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityFootprintReport {
    law_id: String,
    subject: String,
    reads: Vec<String>,
    writes: Vec<String>,
    creates: Vec<String>,
    forbids: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LawCoverageReport {
    api_version: &'static str,
    profile: String,
    required_total: usize,
    required_covered: usize,
    required_percent: f64,
    categories: Vec<LawCoverageCategory>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LawCoverageCategory {
    id: &'static str,
    label: &'static str,
    required: bool,
    total: usize,
    covered: usize,
    missing_subjects: Vec<String>,
}

struct DraftSuggestion {
    id: String,
    subject: String,
    source: String,
    text: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct EmitMetadata {
    schema_hash: String,
    schema_hash_qualified: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    law_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    law_document_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    profile_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bundle_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    law_ir_codec: Option<String>,
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

fn print_law_diff(report: &LawDiffReportV1, output_format: OutputFormat) -> Result<(), CliError> {
    match output_format {
        OutputFormat::Json => print_json(report)?,
        OutputFormat::Text => println!("{}", format_law_diff_markdown_v1(report)),
        OutputFormat::Summary => println!("{}", format_law_diff_summary(report)),
    }

    Ok(())
}

fn format_law_diff_summary(report: &LawDiffReportV1) -> String {
    if report.changes.is_empty() {
        return "No semantic law changes detected.".to_string();
    }

    format!(
        "{} semantic law change(s), oldLawHash {}, newLawHash {}",
        report.changes.len(),
        report.old_law_hash,
        report.new_law_hash
    )
}

fn capability_report_from_law(law_ir: &LawIrV1) -> CapabilityReport {
    let footprints = law_ir
        .entries
        .iter()
        .filter_map(|entry| {
            let LawEntryBodyV1::FootprintLaw(body) = &entry.body else {
                return None;
            };
            Some(CapabilityFootprintReport {
                law_id: entry.id.clone(),
                subject: entry.subject.clone(),
                reads: body.reads.clone(),
                writes: body.writes.clone(),
                creates: body.creates.clone(),
                forbids: body.forbids.clone(),
            })
        })
        .collect();

    CapabilityReport {
        api_version: "wesley.capability-report/v1",
        report_only: true,
        runtime_enforcement: false,
        note: "Footprint capabilities are report-only in weslaw v1; no runtime enforcement is claimed.",
        footprints,
    }
}

fn law_coverage_report(
    ir: &WesleyIR,
    operations: &[wesley_core::SchemaOperation],
    law_ir: &LawIrV1,
    profile: &str,
) -> LawCoverageReport {
    let release_required = matches!(profile, "release" | "ci-release");
    let categories = vec![
        law_coverage_category(
            "customScalarSemantics",
            "Custom scalar semantic law",
            release_required,
            custom_scalar_subjects(ir),
            law_ir,
            |body| matches!(body, LawEntryBodyV1::ScalarSemantics(_)),
        ),
        law_coverage_category(
            "variantInputLaw",
            "Input variant law",
            release_required,
            variant_input_subjects(ir),
            law_ir,
            |body| matches!(body, LawEntryBodyV1::VariantLaw(_)),
        ),
        law_coverage_category(
            "mutationFootprintLaw",
            "Mutation footprint law",
            release_required,
            mutation_operation_subjects(operations),
            law_ir,
            |body| matches!(body, LawEntryBodyV1::FootprintLaw(_)),
        ),
        law_coverage_category(
            "channelLaw",
            "Channel law",
            release_required,
            schema_channel_subjects(ir),
            law_ir,
            |body| matches!(body, LawEntryBodyV1::ChannelLaw(_)),
        ),
    ];
    let required_total = categories
        .iter()
        .filter(|category| category.required)
        .map(|category| category.total)
        .sum();
    let required_covered = categories
        .iter()
        .filter(|category| category.required)
        .map(|category| category.covered)
        .sum();
    let required_percent = percentage(required_covered, required_total);

    LawCoverageReport {
        api_version: "wesley.law-coverage/v1",
        profile: profile.to_string(),
        required_total,
        required_covered,
        required_percent,
        categories,
    }
}

fn law_coverage_category(
    id: &'static str,
    label: &'static str,
    required: bool,
    subjects: Vec<String>,
    law_ir: &LawIrV1,
    predicate: impl Fn(&LawEntryBodyV1) -> bool,
) -> LawCoverageCategory {
    let subjects = subjects.into_iter().collect::<BTreeSet<_>>();
    let missing_subjects = subjects
        .iter()
        .filter(|subject| !has_law_for_subject(law_ir, subject, &predicate))
        .cloned()
        .collect::<Vec<_>>();
    let total = subjects.len();
    let covered = total - missing_subjects.len();

    LawCoverageCategory {
        id,
        label,
        required,
        total,
        covered,
        missing_subjects,
    }
}

fn has_law_for_subject(
    law_ir: &LawIrV1,
    subject: &str,
    predicate: impl Fn(&LawEntryBodyV1) -> bool,
) -> bool {
    law_ir
        .entries
        .iter()
        .any(|entry| entry.subject == subject && predicate(&entry.body))
}

fn custom_scalar_subjects(ir: &WesleyIR) -> Vec<String> {
    ir.types
        .iter()
        .filter(|definition| {
            definition.kind == TypeKind::Scalar && !is_builtin_graphql_scalar(&definition.name)
        })
        .map(|definition| format!("scalar:{}", definition.name))
        .collect()
}

fn variant_input_subjects(ir: &WesleyIR) -> Vec<String> {
    ir.types
        .iter()
        .filter(|definition| {
            definition.kind == TypeKind::InputObject
                && definition.fields.iter().any(|field| field.name == "kind")
        })
        .map(|definition| format!("input:{}", definition.name))
        .collect()
}

fn mutation_operation_subjects(operations: &[wesley_core::SchemaOperation]) -> Vec<String> {
    operations
        .iter()
        .filter(|operation| matches!(operation.operation_type, OperationType::Mutation))
        .map(|operation| format!("operation:Mutation.{}", operation.field_name))
        .collect()
}

fn schema_channel_subjects(ir: &WesleyIR) -> Vec<String> {
    ir.types
        .iter()
        .filter_map(|definition| {
            let directive = definition.directives.get("wes_channel")?;
            let name = directive.get("name").and_then(serde_json::Value::as_str)?;
            let version = directive
                .get("version")
                .and_then(serde_json::Value::as_u64)?;
            Some(format!("channel:{name}@{version}"))
        })
        .collect()
}

fn is_builtin_graphql_scalar(name: &str) -> bool {
    matches!(name, "ID" | "String" | "Int" | "Float" | "Boolean")
}

fn percentage(covered: usize, total: usize) -> f64 {
    if total == 0 {
        100.0
    } else {
        ((covered as f64 / total as f64) * 1000.0).round() / 10.0
    }
}

fn draft_suggestions_from_descriptions(ir: &WesleyIR) -> Vec<DraftSuggestion> {
    ir.types
        .iter()
        .filter_map(|definition| {
            let description = definition.description.as_ref()?;
            let (id_kind, subject_kind) = match definition.kind {
                TypeKind::Object | TypeKind::Interface | TypeKind::Union => ("type", "type"),
                TypeKind::Enum => ("enum", "enum"),
                TypeKind::Scalar => ("scalar", "scalar"),
                TypeKind::InputObject => ("input", "input"),
            };
            Some(DraftSuggestion {
                id: format!("draft.description.{id_kind}.{}", definition.name),
                subject: format!("{subject_kind}:{}", definition.name),
                source: "description".to_string(),
                text: description.clone(),
            })
        })
        .collect()
}

fn render_weslaw_yaml(law_ir: &LawIrV1, drafts: &[DraftSuggestion]) -> String {
    let mut output = String::new();
    output.push_str("apiVersion: weslaw/v1\n");
    output.push_str("schema:\n");
    output.push_str(&format!("  family: {}\n", yaml_quote(&law_ir.family)));
    output.push_str(&format!("  hash: {}\n", law_ir.schema_hash));
    if let Some(source) = &law_ir.schema_source {
        output.push_str(&format!("  source: {}\n", yaml_quote(source)));
    }
    if law_ir.entries.is_empty() && drafts.is_empty() {
        output.push_str("laws: []\n");
        return output;
    }

    output.push_str("laws:\n");

    for entry in &law_ir.entries {
        if let LawEntryBodyV1::ChannelLaw(body) = &entry.body {
            output.push_str(&format!("  - id: {}\n", yaml_quote(&entry.id)));
            output.push_str("    status: active\n");
            output.push_str("    kind: channelLaw\n");
            output.push_str(&format!("    subject: {}\n", yaml_quote(&entry.subject)));
            output.push_str(&format!("    ordered: {}\n", body.ordered));
            output.push_str(&format!("    version: {}\n", body.version));
            output.push_str("    messages:\n");
            for message in &body.messages {
                output.push_str(&format!("      - field: {}\n", yaml_quote(&message.field)));
                output.push_str(&format!("        type: {}\n", yaml_quote(&message.r#type)));
            }
        }
    }

    for draft in drafts {
        output.push_str(&format!("  - id: {}\n", yaml_quote(&draft.id)));
        output.push_str("    status: draft\n");
        output.push_str(&format!("    subject: {}\n", yaml_quote(&draft.subject)));
        output.push_str(&format!("    source: {}\n", yaml_quote(&draft.source)));
        output.push_str(&format!("    suggestion: {}\n", yaml_quote(&draft.text)));
    }

    output
}

fn yaml_quote(value: &str) -> String {
    serde_json::to_string(value).expect("string serialization should not fail")
}

fn explain_law_subject(law_ir: &LawIrV1, subject: &str) -> Result<LawExplanation, CliError> {
    let mut lines = Vec::new();
    let mut law_count = 0;
    for entry in law_ir
        .entries
        .iter()
        .filter(|entry| entry.subject == subject)
    {
        law_count += 1;
        lines.push(format!("Law: {}", entry.id));
        match &entry.body {
            LawEntryBodyV1::ScalarSemantics(body) => explain_scalar_semantics(body, &mut lines),
            LawEntryBodyV1::FootprintLaw(body) => explain_footprint(body, &mut lines),
            LawEntryBodyV1::VariantLaw(_) => lines.push("Kind: variant law".to_string()),
            LawEntryBodyV1::ChannelLaw(_) => lines.push("Kind: channel law".to_string()),
            LawEntryBodyV1::InvariantLaw(_) => lines.push("Kind: invariant law".to_string()),
        }
    }

    if law_count == 0 {
        return Err(CliError::usage(format!(
            "no active law entries found for subject `{subject}`"
        )));
    }

    Ok(LawExplanation {
        subject: subject.to_string(),
        law_count,
        lines,
    })
}

fn explain_scalar_semantics(body: &ScalarSemanticsLawV1, lines: &mut Vec<String>) {
    lines.push(format!(
        "Kind: scalar semantics ({:?})",
        body.representation
    ));
    if let Some(min) = body.min_inclusive {
        lines.push(format!("Minimum: {min}"));
    }
    if let Some(max) = body.max_inclusive {
        lines.push(format!("Maximum: {max}"));
    }
    if let Some(ordering) = body.ordering {
        lines.push(format!("Ordering: {ordering:?}"));
    }
    if let Some(scope) = &body.scope {
        lines.push(format!("Scope: {scope}"));
    }
    if !body.forbids.is_empty() {
        lines.push(format!("Forbids: {}", serde_list(&body.forbids)));
    }
}

fn explain_footprint(body: &FootprintLawV1, lines: &mut Vec<String>) {
    lines.push("Kind: operation footprint".to_string());
    push_named_list(lines, "Reads", &body.reads);
    push_named_list(lines, "Writes", &body.writes);
    push_named_list(lines, "Creates", &body.creates);
    push_named_list(lines, "Forbids", &body.forbids);
}

fn push_named_list(lines: &mut Vec<String>, label: &str, values: &[String]) {
    if !values.is_empty() {
        lines.push(format!("{label}: {}", values.join(", ")));
    }
}

fn print_nonempty_list(label: &str, values: &[String]) {
    if !values.is_empty() {
        println!("{label}: {}", values.join(", "));
    }
}

fn coverage_profile_or_default(profile: Option<&str>) -> Result<&str, CliError> {
    let profile = profile.unwrap_or("release");
    match profile {
        "release" | "ci-release" | "local" => Ok(profile),
        value => Err(CliError::usage(format!(
            "unknown law coverage profile `{value}`; expected release, ci-release, or local"
        ))),
    }
}

fn unqualified_sha256(value: &str) -> Result<String, CliError> {
    let Some(hash) = value.strip_prefix("sha256:") else {
        return Err(CliError::usage(format!(
            "expected sha256-qualified hash, got `{value}`"
        )));
    };
    Ok(hash.to_string())
}

fn serde_list<T: serde::Serialize>(values: &T) -> String {
    match serde_json::to_value(values) {
        Ok(serde_json::Value::Array(items)) => items
            .iter()
            .filter_map(serde_json::Value::as_str)
            .collect::<Vec<_>>()
            .join(", "),
        _ => "-".to_string(),
    }
}

fn replace_schema_hash_anchor(
    source: &str,
    old_schema_hash: &str,
    new_schema_hash: &str,
    path: &Path,
) -> Result<String, CliError> {
    let mut replacements = 0usize;
    let mut in_schema = false;
    let mut schema_indent = 0usize;
    let trailing_newline = source.ends_with('\n');
    let mut lines = Vec::new();

    for line in source.lines() {
        let trimmed = line.trim_start();
        let indent = line.len() - trimmed.len();
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            if trimmed == "schema:" {
                in_schema = true;
                schema_indent = indent;
            } else if in_schema && indent <= schema_indent {
                in_schema = false;
            }
        }

        if in_schema {
            if let Some(hash_value) = trimmed.strip_prefix("hash:") {
                let hash_without_comment = hash_value
                    .split_once('#')
                    .map(|(value, _)| value)
                    .unwrap_or(hash_value)
                    .trim();
                let unquoted_hash = hash_without_comment.trim_matches('"').trim_matches('\'');
                if unquoted_hash == old_schema_hash {
                    replacements += 1;
                    lines.push(line.replacen(old_schema_hash, new_schema_hash, 1));
                    continue;
                }
            }
        }

        lines.push(line.to_string());
    }

    if replacements != 1 {
        return Err(CliError::usage(format!(
            "expected exactly one schema.hash anchor `{old_schema_hash}` in `{}`; found {replacements}",
            path.display()
        )));
    }

    let mut output = lines.join("\n");
    if trailing_newline {
        output.push('\n');
    }
    Ok(output)
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
  init-law                 Scaffold weslaw/v1 from known SDL law directives
  schema lower              Lower GraphQL SDL to Wesley L1 IR JSON
  schema hash               Print the Wesley L1 registry hash for GraphQL SDL
  schema operations         List Query/Mutation/Subscription root operations
  schema diff               Compare GraphQL SDL states as Wesley L1 IR
  law validate              Validate weslaw against active GraphQL SDL
  law lint                  Validate weslaw structure without schema binding
  law diff                  Compare weslaw semantic Law IR states
  law explain               Explain active laws bound to one subject
  law rebind                Re-anchor weslaw to an active schema hash
  law capabilities          Emit report-only footprint capability summaries
  law coverage              Report profile/category-aware law coverage
  emit rust                 Emit Rust models and operation bindings from GraphQL SDL
  emit typescript           Emit TypeScript declarations and operation bindings from GraphQL SDL
  operation selections      Resolve selected operation fields
  operation directive-args  Extract operation directive arguments as JSON
  version                   Print the native CLI version

Options:
  -h, --help     Show help
  -V, --version  Show version"
    );
}

fn print_init_law_help() {
    println!(
        "\
Wesley init-law

Scaffolds weslaw/v1 from formally known SDL law directives and draft
description-derived suggestions. Draft suggestions are not active law.

Usage:
  wesley init-law --schema <path> --family <name> [--out <path>]

Options:
  -s, --schema <path>  GraphQL SDL file
  --family <name>      Contract family id for the generated law document
  --out <path>         Optional output path; stdout when omitted"
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

fn print_law_help() {
    println!(
        "\
Wesley law commands

Usage:
  wesley law lint --law <path> [--json]
  wesley law validate --schema <path> --law <path> [--json]
  wesley law diff --old <path> --new <path> [--schema <path>] [--format markdown|json|summary]
  wesley law explain --law <path> <subject> [--json]
  wesley law rebind --schema <path> --law <path> [--accept --out <path>] [--json]
  wesley law capabilities --law <path> [--json]
  wesley law coverage --schema <path> --law <path> [--profile release|ci-release|local] [--json]

Options:
  -s, --schema <path>  GraphQL SDL file used to validate the new law document
  --law <path>         weslaw/v1 authoring file
  --old <path>         Old/base weslaw/v1 authoring file for diff
  --new <path>         New/target weslaw/v1 authoring file for diff
  --accept             Write an explicitly accepted rebind output
  --out <path>         Rebind output path
  --profile <name>     Coverage profile, default: release
  --json               Emit JSON output
  --format <format>    Output format: markdown, json, or summary"
    );
}

fn print_emit_help() {
    println!(
        "\
Wesley emit commands

Emits model declarations and root operation bindings when the schema declares
Query, Mutation, or Subscription fields.

Usage:
  wesley emit rust --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
  wesley emit typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
  wesley emit le-binary-typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>] [--codec-import <path>]

Options:
  -s, --schema <path>    GraphQL SDL file
  --law <path>           Optional weslaw/v1 file for bundle hashes
  --out <path>           Output file
  --metadata-out <path>  Deterministic metadata JSON sidecar
  --codec-import <path>  Module specifier for Writer/Reader/CodecError (le-binary-typescript only)"
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
    Law(WeslawError),
    Git(String),
    Json(String),
}

impl CliError {
    fn usage(message: impl Into<String>) -> Self {
        Self::Usage(message.into())
    }

    fn exit_code(&self) -> u8 {
        match self {
            Self::Usage(_) => EXIT_USAGE,
            Self::Io { .. } | Self::Core(_) | Self::Law(_) | Self::Git(_) | Self::Json(_) => {
                EXIT_FAILURE
            }
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
            Self::Law(error) => {
                write!(formatter, "{}: {}", error.code.as_str(), error.message)?;
                if let Some(path) = &error.path {
                    write!(formatter, " ({path})")?;
                }
                Ok(())
            }
            Self::Git(error) => write!(formatter, "git error: {error}"),
            Self::Json(error) => write!(formatter, "failed to serialize JSON output: {error}"),
        }
    }
}

impl From<WesleyError> for CliError {
    fn from(error: WesleyError) -> Self {
        Self::Core(error)
    }
}

impl From<WeslawError> for CliError {
    fn from(error: WeslawError) -> Self {
        Self::Law(error)
    }
}

impl From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error.to_string())
    }
}
