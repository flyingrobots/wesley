//! Domain error types.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Core error types for Wesley.
#[derive(Error, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum WesleyError {
    /// Error during parsing of GraphQL SDL.
    #[error("Parse error: {message}")]
    ParseError {
        /// Human-readable error message.
        message: String,
        /// Line number (if available).
        line: Option<u32>,
        /// Column number (if available).
        column: Option<u32>,
    },
    /// Error during lowering from AST to IR.
    #[error("Lowering error: {message} in {area}")]
    LoweringError {
        /// Human-readable error message.
        message: String,
        /// The area of the compiler where the error occurred (e.g. "table", "field").
        area: String,
    },
    /// Error from a resilience policy (e.g. timeout, max retries).
    #[error("Resilience error: {0}")]
    ResilienceError(String),
}

/// A diagnostic message emitted by the compiler.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WesleyDiagnostic {
    /// Machine-readable error code.
    pub code: String,
    /// Human-readable error message.
    pub message: String,
    /// Severity level (e.g. "ERROR", "WARNING").
    pub severity: String,
    /// Line number (if available).
    pub line: Option<u32>,
    /// Column number (if available).
    pub column: Option<u32>,
}
