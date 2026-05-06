//! Native Wesley CLI entry point.

use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use wesley_core::{check_footprint, check_footprint_with_schema, FootprintCheck, WesleyError};

const EXIT_OK: u8 = 0;
const EXIT_DISHONEST: u8 = 1;
const EXIT_USAGE: u8 = 2;

fn main() -> ExitCode {
    match run(env::args().skip(1).collect()) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(EXIT_USAGE)
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

    let check = if let Some(schema_path) = &options.schema {
        let schema_sdl = fs::read_to_string(schema_path).map_err(|source| {
            CliError::usage(format!(
                "failed to read schema '{}': {source}",
                schema_path.display()
            ))
        })?;
        check_footprint_with_schema(&schema_sdl, &operation_sdl)?
    } else {
        check_footprint(&operation_sdl)?
    };
    if options.json {
        print_json(&check)?;
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

fn print_json(check: &FootprintCheck) -> Result<(), CliError> {
    let output = CheckFootprintOutput {
        honest: check.is_honest(),
        check,
    };
    let json = serde_json::to_string_pretty(&output).map_err(|source| {
        CliError::usage(format!(
            "failed to serialize footprint check result: {source}"
        ))
    })?;
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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckFootprintOutput<'a> {
    honest: bool,
    #[serde(flatten)]
    check: &'a FootprintCheck,
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
