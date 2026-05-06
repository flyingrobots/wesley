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
