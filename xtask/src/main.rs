//! Repository automation for Wesley.

use std::env;
use std::ffi::OsString;
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
            run_command("cargo", &["test", "--workspace"])?;
            run_command("cargo", &["run", "--bin", "wesley", "--", "--help"])?;
            run_command(
                "cargo",
                &["run", "--bin", "wesley", "--", "check-footprint", "--help"],
            )
        }
        "legacy-preflight" => run_command("pnpm", &["run", "preflight"]),
        other => Err(Error::Usage(format!("unknown xtask command `{other}`"))),
    }
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
  preflight         Run native Rust preflight checks
  legacy-preflight  Run the historical pnpm package preflight
  help              Show help"
    );
}

#[derive(Debug)]
enum Error {
    Usage(String),
    CommandFailed { command: String, code: i32 },
}
