//! GraphQL operation analysis data.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::ir::TypeReference;

/// Arguments extracted from a directive attached to a GraphQL operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OperationDirectiveArgs {
    /// Directive name without the leading `@`.
    pub directive_name: String,
    /// Directive arguments represented as JSON-compatible values.
    pub arguments: IndexMap<String, serde_json::Value>,
}

/// GraphQL root operation type.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OperationType {
    /// GraphQL query root field.
    Query,
    /// GraphQL mutation root field.
    Mutation,
    /// GraphQL subscription root field.
    Subscription,
}

/// A field argument on a schema root operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OperationArgument {
    /// Argument name.
    pub name: String,
    /// Argument type reference.
    pub r#type: TypeReference,
    /// Default value, if the schema declares one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Generic map of directives attached to the argument.
    pub directives: IndexMap<String, serde_json::Value>,
}

/// A root schema operation field described as domain-empty data.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaOperation {
    /// Root operation kind for the field.
    pub operation_type: OperationType,
    /// Root field name.
    pub field_name: String,
    /// Root field arguments.
    pub arguments: Vec<OperationArgument>,
    /// Root field result type.
    pub result_type: TypeReference,
    /// Generic map of directives attached to the root field.
    pub directives: IndexMap<String, serde_json::Value>,
}
