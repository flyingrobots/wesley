//! Native Wesley CLI entry point.

use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use wesley_core::{
    check_footprint, check_footprint_with_schema, compute_content_hash, compute_registry_hash,
    lower_schema_sdl, FootprintCheck, WesleyError,
};

const EXIT_OK: u8 = 0;
const EXIT_DISHONEST: u8 = 1;
const EXIT_USAGE: u8 = 2;
const CHECK_FOOTPRINT_KIND: &str = "wesley.checkFootprint.v1";
const ERROR_KIND: &str = "wesley.error.v1";
const JSON_VERSION: u16 = 1;

fn main() -> ExitCode {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let wants_json = args.iter().any(|arg| arg == "--json");

    match run(args) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            if wants_json {
                if let Err(serialization_error) = print_error_json(&error) {
                    eprintln!("{serialization_error}");
                }
            } else {
                eprintln!("{error}");
            }
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
        Some("check-footprint") => run_check_footprint(&args[1..]),
        Some(command) => Err(CliError::usage(format!("unknown command '{command}'"))),
    }
}

fn run_check_footprint(args: &[String]) -> Result<u8, CliError> {
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_check_footprint_help();
        return Ok(EXIT_OK);
    }

    let options = CheckFootprintOptions::parse(args)?;
    let operation_sdl = fs::read_to_string(&options.operation).map_err(|source| {
        CliError::usage(format!(
            "failed to read operation '{}': {source}",
            options.operation.display()
        ))
    })?;

    let mut schema_hash = None;
    let check = if let Some(schema_path) = &options.schema {
        let schema_sdl = fs::read_to_string(schema_path).map_err(|source| {
            CliError::usage(format!(
                "failed to read schema '{}': {source}",
                schema_path.display()
            ))
        })?;
        let ir = lower_schema_sdl(&schema_sdl)?;
        schema_hash = Some(prefixed_hash(&compute_registry_hash(&ir).map_err(
            |source| CliError::usage(format!("failed to compute schema IR hash: {source}")),
        )?));
        check_footprint_with_schema(&schema_sdl, &operation_sdl)?
    } else {
        check_footprint(&operation_sdl)?
    };
    if options.json {
        print_json(&options, &operation_sdl, schema_hash, &check)?;
    } else {
        print_human(&check);
    }

    if check.is_honest() {
        Ok(EXIT_OK)
    } else {
        Ok(EXIT_DISHONEST)
    }
}

fn print_human(check: &FootprintCheck) {
    if check.is_honest() {
        println!("Footprint honest");
    } else {
        println!("Dishonest footprint");
        println!("undeclared selections:");
        for selection in &check.undeclared_selections {
            println!("- {selection}");
        }
    }

    if !check.unused_declarations.is_empty() {
        println!("unused declarations:");
        for declaration in &check.unused_declarations {
            println!("- {declaration}");
        }
    }
}

fn print_json(
    options: &CheckFootprintOptions,
    operation_sdl: &str,
    schema_hash: Option<String>,
    check: &FootprintCheck,
) -> Result<(), CliError> {
    let output = CheckFootprintOutput {
        kind: CHECK_FOOTPRINT_KIND,
        version: JSON_VERSION,
        command: "check-footprint",
        ok: true,
        mode: options.mode(),
        verdict: if check.is_honest() {
            FootprintVerdict::Honest
        } else {
            FootprintVerdict::Dishonest
        },
        honest: check.is_honest(),
        operation_hash: prefixed_hash(&compute_content_hash(operation_sdl)),
        schema_hash,
        inputs: CheckFootprintInputs {
            operation: options.operation.display().to_string(),
            schema: options
                .schema
                .as_ref()
                .map(|schema| schema.display().to_string()),
        },
        declared_reads: check.spec.declared_reads.clone(),
        declared_writes: check.spec.declared_writes.clone(),
        actual_selections: check.spec.actual_selections.clone(),
        undeclared_selections: check.undeclared_selections.clone(),
        unused_declarations: check.unused_declarations.clone(),
        spec: check.spec.clone(),
    };
    let json = serde_json::to_string_pretty(&output).map_err(|source| {
        CliError::usage(format!(
            "failed to serialize footprint check result: {source}"
        ))
    })?;
    println!("{json}");
    Ok(())
}

fn print_error_json(error: &CliError) -> Result<(), CliError> {
    let output = ErrorOutput {
        kind: ERROR_KIND,
        version: JSON_VERSION,
        ok: false,
        error: ErrorBody {
            category: error.category(),
            message: error.message(),
            detail: error.detail(),
        },
    };
    let json = serde_json::to_string_pretty(&output)
        .map_err(|source| CliError::usage(format!("failed to serialize error result: {source}")))?;
    println!("{json}");
    Ok(())
}

fn print_help() {
    println!(
        "\
Wesley native CLI

Usage:
  wesley <command> [options]

Commands:
  check-footprint    Check a GraphQL operation @wes_footprint declaration

Options:
  -h, --help         Show help

Run `wesley check-footprint --help` for command options."
    );
}

fn print_check_footprint_help() {
    println!(
        "\
Check a GraphQL operation @wes_footprint declaration.

Usage:
  wesley check-footprint --operation <path> [--schema <path>] [--json]

Options:
  --operation <path>  GraphQL operation document to check
  --schema <path>     GraphQL schema for schema-coordinate checking
  --json              Emit machine-readable JSON
  -h, --help          Show help"
    );
}

#[derive(Debug)]
struct CheckFootprintOptions {
    operation: PathBuf,
    schema: Option<PathBuf>,
    json: bool,
}

impl CheckFootprintOptions {
    fn parse(args: &[String]) -> Result<Self, CliError> {
        let mut operation = None;
        let mut schema = None;
        let mut json = false;
        let mut index = 0;

        while index < args.len() {
            match args[index].as_str() {
                "--help" | "-h" => unreachable!("help is handled before option parsing"),
                "--json" => {
                    json = true;
                    index += 1;
                }
                "--operation" => {
                    let value = args
                        .get(index + 1)
                        .ok_or_else(|| CliError::usage("--operation requires a path"))?;
                    operation = Some(PathBuf::from(value));
                    index += 2;
                }
                "--schema" => {
                    let value = args
                        .get(index + 1)
                        .ok_or_else(|| CliError::usage("--schema requires a path"))?;
                    schema = Some(PathBuf::from(value));
                    index += 2;
                }
                option if option.starts_with('-') => {
                    return Err(CliError::usage(format!("unknown option '{option}'")));
                }
                value => {
                    return Err(CliError::usage(format!("unexpected argument '{value}'")));
                }
            }
        }

        Ok(Self {
            operation: operation.ok_or_else(|| CliError::usage("--operation is required"))?,
            schema,
            json,
        })
    }

    fn mode(&self) -> FootprintMode {
        if self.schema.is_some() {
            FootprintMode::SchemaCoordinate
        } else {
            FootprintMode::ResponsePath
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckFootprintOutput {
    kind: &'static str,
    version: u16,
    command: &'static str,
    ok: bool,
    mode: FootprintMode,
    verdict: FootprintVerdict,
    honest: bool,
    operation_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    schema_hash: Option<String>,
    inputs: CheckFootprintInputs,
    declared_reads: Vec<String>,
    declared_writes: Vec<String>,
    actual_selections: Vec<String>,
    undeclared_selections: Vec<String>,
    unused_declarations: Vec<String>,
    spec: wesley_core::FootprintSpec,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckFootprintInputs {
    operation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    schema: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
enum FootprintMode {
    ResponsePath,
    SchemaCoordinate,
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
enum FootprintVerdict {
    Honest,
    Dishonest,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorOutput {
    kind: &'static str,
    version: u16,
    ok: bool,
    error: ErrorBody,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    category: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<serde_json::Value>,
}

#[derive(Debug)]
enum CliError {
    Usage(String),
    Wesley(WesleyError),
}

impl CliError {
    fn usage(message: impl Into<String>) -> Self {
        Self::Usage(message.into())
    }

    fn exit_code(&self) -> u8 {
        match self {
            Self::Usage(_) | Self::Wesley(_) => EXIT_USAGE,
        }
    }

    fn category(&self) -> &'static str {
        match self {
            Self::Usage(_) => "usage",
            Self::Wesley(_) => "wesley",
        }
    }

    fn message(&self) -> String {
        match self {
            Self::Usage(message) => message.clone(),
            Self::Wesley(error) => error.to_string(),
        }
    }

    fn detail(&self) -> Option<serde_json::Value> {
        match self {
            Self::Usage(_) => None,
            Self::Wesley(error) => serde_json::to_value(error).ok(),
        }
    }
}

impl From<WesleyError> for CliError {
    fn from(error: WesleyError) -> Self {
        Self::Wesley(error)
    }
}

impl std::fmt::Display for CliError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Usage(message) => {
                writeln!(formatter, "{message}")?;
                write!(formatter, "Run `wesley --help` for usage.")
            }
            Self::Wesley(error) => write!(formatter, "{error}"),
        }
    }
}

fn prefixed_hash(hash: &str) -> String {
    format!("sha256:{hash}")
}
