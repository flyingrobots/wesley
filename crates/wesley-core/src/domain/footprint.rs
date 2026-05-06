//! Operation footprint extraction data.

use serde::{Deserialize, Serialize};

/// Declared and observed footprint information for a GraphQL operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintSpec {
    /// Paths declared in `@wes_footprint(reads: [...])`.
    pub declared_reads: Vec<String>,
    /// Paths declared in `@wes_footprint(writes: [...])`.
    pub declared_writes: Vec<String>,
    /// Field-selection paths observed in the operation selection set.
    pub actual_selections: Vec<String>,
}

/// String-level honesty check result for a GraphQL operation footprint.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintCheck {
    /// Extracted declared and observed footprint information.
    pub spec: FootprintSpec,
    /// Selection paths touched by the operation but absent from declared reads and writes.
    pub undeclared_selections: Vec<String>,
    /// Declared read/write paths that are not present in the extracted selection paths.
    pub unused_declarations: Vec<String>,
}

impl FootprintCheck {
    /// Returns true when every extracted selection path is declared.
    pub fn is_honest(&self) -> bool {
        self.undeclared_selections.is_empty()
    }
}
