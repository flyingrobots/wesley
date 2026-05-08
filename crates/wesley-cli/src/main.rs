//! Native Wesley CLI entry point.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use wesley_core::{
    compute_registry_hash, diff_schema_sdl, extract_operation_directive_args, lower_schema_sdl,
    resolve_operation_selections, resolve_operation_selections_with_schema, SchemaDelta,
    WesleyError,
};

const EXIT_OK: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const EXIT_USAGE: u8 = 2;

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
        Some("schema") => run_schema_command(&args[1..]),
        Some("operation") => run_operation_command(&args[1..]),
        Some("version") | Some("--version") | Some("-V") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(EXIT_OK)
        }
        Some(command) => Err(CliError::usage(format!("unknown command '{command}'"))),
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
        Some("diff") if wants_help(&args[1..]) => {
            print_schema_help();
            Ok(EXIT_OK)
        }
        Some("diff") => {
            let options = parse_options(&args[1..], "schema diff")?;
            let old_schema_path = options.required_old_schema("schema diff")?;
            let new_schema_path = options.required_new_schema("schema diff")?;
            let old_sdl = read_file(&old_schema_path, "old schema")?;
            let new_sdl = read_file(&new_schema_path, "new schema")?;
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

#[derive(Default)]
struct ParsedOptions {
    schema: Option<PathBuf>,
    old_schema: Option<PathBuf>,
    new_schema: Option<PathBuf>,
    operation: Option<PathBuf>,
    directive: Option<String>,
    format: Option<String>,
    breaking_only: bool,
    exit_code: bool,
    json: bool,
}

impl ParsedOptions {
    fn required_schema(&self, command: &str) -> Result<PathBuf, CliError> {
        self.schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --schema for `{command}`")))
    }

    fn required_old_schema(&self, command: &str) -> Result<PathBuf, CliError> {
        self.old_schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --old for `{command}`")))
    }

    fn required_new_schema(&self, command: &str) -> Result<PathBuf, CliError> {
        self.new_schema
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --new for `{command}`")))
    }

    fn required_operation(&self, command: &str) -> Result<PathBuf, CliError> {
        self.operation
            .clone()
            .ok_or_else(|| CliError::usage(format!("missing --operation for `{command}`")))
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
            "text" => Ok(OutputFormat::Text),
            "json" => Ok(OutputFormat::Json),
            "summary" => Ok(OutputFormat::Summary),
            format => Err(CliError::usage(format!(
                "unknown output format '{format}'; expected text, json, or summary"
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
            "--new" => {
                index += 1;
                options.new_schema = Some(PathBuf::from(required_value(args, index, "--new")?));
            }
            "--operation" | "-o" => {
                index += 1;
                options.operation =
                    Some(PathBuf::from(required_value(args, index, "--operation")?));
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
  schema lower              Lower GraphQL SDL to Wesley L1 IR JSON
  schema hash               Print the Wesley L1 registry hash for GraphQL SDL
  schema diff               Compare two GraphQL SDL files as Wesley L1 IR
  operation selections      Resolve selected operation fields
  operation directive-args  Extract operation directive arguments as JSON
  version                   Print the native CLI version

Options:
  -h, --help     Show help
  -V, --version  Show version"
    );
}

fn print_schema_help() {
    println!(
        "\
Wesley schema commands

Usage:
  wesley schema lower --schema <path> [--json]
  wesley schema hash --schema <path> [--json]
  wesley schema diff --old <path> --new <path> [--format text|json|summary] [--breaking-only] [--exit-code]

Options:
  -s, --schema <path>  GraphQL SDL file
  --old <path>         Old/base GraphQL SDL file
  --new <path>         New/target GraphQL SDL file
  --json               Emit JSON output"
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
    Json(String),
}

impl CliError {
    fn usage(message: impl Into<String>) -> Self {
        Self::Usage(message.into())
    }

    fn exit_code(&self) -> u8 {
        match self {
            Self::Usage(_) => EXIT_USAGE,
            Self::Io { .. } | Self::Core(_) | Self::Json(_) => EXIT_FAILURE,
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
                "failed to read {label} file `{}`: {source}",
                path.display()
            ),
            Self::Core(error) => write!(formatter, "{error}"),
            Self::Json(error) => write!(formatter, "failed to serialize JSON output: {error}"),
        }
    }
}

impl From<WesleyError> for CliError {
    fn from(error: WesleyError) -> Self {
        Self::Core(error)
    }
}

impl From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error.to_string())
    }
}
