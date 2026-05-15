//! Wesley Intermediate Representation (IR).
//!
//! Pure semantic representation of GraphQL SDL, free from domain-specific concepts.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// The root Wesley IR structure.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WesleyIR {
    /// IR Schema version (e.g. "1.0.0").
    pub version: String,
    /// Non-deterministic metadata (stripped during parity hashing).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Metadata>,
    /// Consolidated type definitions.
    pub types: Vec<TypeDefinition>,
}

/// Metadata for the IR.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    /// Source SDL hash.
    pub source_hash: Option<String>,
    /// Generation timestamp.
    pub generated_at: Option<String>,
    /// Compilation units involved.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub units: Vec<UnitMeta>,
}

/// Compilation unit metadata.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct UnitMeta {
    /// Unit ID (usually path).
    pub id: String,
    /// Package name.
    pub package: String,
    /// Unit hash.
    pub hash: String,
}

/// A type definition (Object, Interface, etc.).
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TypeDefinition {
    /// Type name.
    pub name: String,
    /// Kind of type.
    pub kind: TypeKind,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Generic map of directives.
    pub directives: IndexMap<String, serde_json::Value>,
    /// Interfaces this type implements (for Objects and Interfaces).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub implements: Vec<String>,
    /// Fields (for Objects, Interfaces, InputObjects).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<Field>,
    /// Enum values (for Enums).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub enum_values: Vec<String>,
    /// Union member type names (for Unions).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub union_members: Vec<String>,
}

/// Kinds of GraphQL types.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TypeKind {
    /// Object type.
    Object,
    /// Interface type.
    Interface,
    /// Union type.
    Union,
    /// Enum type.
    Enum,
    /// Scalar type.
    Scalar,
    /// Input object type.
    InputObject,
}

/// A field definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    /// Field name.
    pub name: String,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Field type reference.
    pub r#type: TypeReference,
    /// Field arguments, for object and interface fields.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub arguments: Vec<FieldArgument>,
    /// Default value, if an input object field declares one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Generic map of directives.
    pub directives: IndexMap<String, serde_json::Value>,
}

/// A field argument definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldArgument {
    /// Argument name.
    pub name: String,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Argument type reference.
    pub r#type: TypeReference,
    /// Default value, if the schema declares one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Generic map of directives attached to the argument.
    pub directives: IndexMap<String, serde_json::Value>,
}

/// Reference to a type with nullability and list information.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TypeReference {
    /// Base type name.
    pub base: String,
    /// Whether the type is nullable.
    pub nullable: bool,
    /// Whether the type is a list.
    pub is_list: bool,
    /// Whether list items are nullable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_item_nullable: Option<bool>,
    /// Nested list wrappers ordered from outermost to innermost.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub list_wrappers: Vec<TypeListWrapper>,
    /// Whether the named leaf value is nullable for nested list references.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaf_nullable: Option<bool>,
}

/// One list wrapper inside a nested GraphQL type reference.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TypeListWrapper {
    /// Whether this list wrapper is nullable.
    pub nullable: bool,
}

/// Computes the canonical registry hash for the given IR.
pub fn compute_registry_hash(ir: &WesleyIR) -> Result<String, serde_json::Error> {
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;

    let json = to_canonical_json(&parity_ir)?;
    Ok(compute_content_hash(&json))
}

/// Computes a stable SHA-256 hex hash for arbitrary UTF-8 content.
pub fn compute_content_hash(content: &str) -> String {
    compute_content_hash_bytes(content.as_bytes())
}

/// Computes a stable SHA-256 hex hash for arbitrary bytes.
pub fn compute_content_hash_bytes(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    let result = hasher.finalize();

    hex::encode(result)
}

/// Serializes a value to a canonical JSON string (sorted keys, no whitespace).
pub fn to_canonical_json<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
    let val = serde_json::to_value(value)?;
    let sorted_val = sort_json_value(val);
    serde_json::to_string(&sorted_val)
}

fn sort_json_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted_map = serde_json::Map::new();
            let mut keys: Vec<String> = map.keys().cloned().collect();
            keys.sort();
            for key in keys {
                if let Some(val) = map.get(&key) {
                    sorted_map.insert(key, sort_json_value(val.clone()));
                }
            }
            serde_json::Value::Object(sorted_map)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(sort_json_value).collect())
        }
        _ => value,
    }
}
