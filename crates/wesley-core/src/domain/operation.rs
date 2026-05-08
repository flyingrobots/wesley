//! GraphQL operation analysis data.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// Arguments extracted from a directive attached to a GraphQL operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OperationDirectiveArgs {
    /// Directive name without the leading `@`.
    pub directive_name: String,
    /// Directive arguments represented as JSON-compatible values.
    pub arguments: IndexMap<String, serde_json::Value>,
}
