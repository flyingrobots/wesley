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
    /// Directive definitions declared in the schema document, sorted by
    /// canonical name.
    ///
    /// Absent from the serialized IR when the schema declares no directives,
    /// so the IR and registry hash of such a schema are unchanged by this
    /// member. Built-in GraphQL directives are not recorded unless the schema
    /// declares them itself.
    #[serde(
        rename = "directiveDefinitions",
        default,
        skip_serializing_if = "Vec::is_empty"
    )]
    pub directive_definitions: Vec<DirectiveDefinition>,
}

/// A directive definition: the declaration that says which arguments a
/// directive takes, where it may be used, and whether it may repeat.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveDefinition {
    /// Canonical directive name, without the `@`. Wesley core directive
    /// aliases are recorded under their canonical `wes_` name.
    pub name: String,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Declared arguments, in declaration order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub arguments: Vec<FieldArgument>,
    /// Locations where the directive may be used, sorted and unique.
    pub locations: Vec<DirectiveLocation>,
    /// Whether the directive may be used more than once at one site.
    pub repeatable: bool,
}

/// A location at which a GraphQL directive may be used.
///
/// Variants are declared in the alphabetical order of their wire names, so
/// sorting by this type sorts by wire name.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DirectiveLocation {
    /// An argument definition.
    ArgumentDefinition,
    /// An enum type.
    Enum,
    /// An enum value.
    EnumValue,
    /// A field in an executable document.
    Field,
    /// A field definition.
    FieldDefinition,
    /// A fragment definition.
    FragmentDefinition,
    /// A fragment spread.
    FragmentSpread,
    /// An inline fragment.
    InlineFragment,
    /// An input object field definition.
    InputFieldDefinition,
    /// An input object type.
    InputObject,
    /// An interface type.
    Interface,
    /// A mutation operation.
    Mutation,
    /// An object type.
    Object,
    /// A query operation.
    Query,
    /// A scalar type.
    Scalar,
    /// A schema definition or extension.
    Schema,
    /// A subscription operation.
    Subscription,
    /// A union type.
    Union,
    /// A variable definition.
    VariableDefinition,
}

impl DirectiveLocation {
    /// Returns the GraphQL spelling of the location, such as `FIELD_DEFINITION`.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ArgumentDefinition => "ARGUMENT_DEFINITION",
            Self::Enum => "ENUM",
            Self::EnumValue => "ENUM_VALUE",
            Self::Field => "FIELD",
            Self::FieldDefinition => "FIELD_DEFINITION",
            Self::FragmentDefinition => "FRAGMENT_DEFINITION",
            Self::FragmentSpread => "FRAGMENT_SPREAD",
            Self::InlineFragment => "INLINE_FRAGMENT",
            Self::InputFieldDefinition => "INPUT_FIELD_DEFINITION",
            Self::InputObject => "INPUT_OBJECT",
            Self::Interface => "INTERFACE",
            Self::Mutation => "MUTATION",
            Self::Object => "OBJECT",
            Self::Query => "QUERY",
            Self::Scalar => "SCALAR",
            Self::Schema => "SCHEMA",
            Self::Subscription => "SUBSCRIPTION",
            Self::Union => "UNION",
            Self::VariableDefinition => "VARIABLE_DEFINITION",
        }
    }

    /// Parses the GraphQL spelling of a location. Returns `None` for any
    /// other text.
    pub fn from_graphql_name(name: &str) -> Option<Self> {
        let location = match name {
            "ARGUMENT_DEFINITION" => Self::ArgumentDefinition,
            "ENUM" => Self::Enum,
            "ENUM_VALUE" => Self::EnumValue,
            "FIELD" => Self::Field,
            "FIELD_DEFINITION" => Self::FieldDefinition,
            "FRAGMENT_DEFINITION" => Self::FragmentDefinition,
            "FRAGMENT_SPREAD" => Self::FragmentSpread,
            "INLINE_FRAGMENT" => Self::InlineFragment,
            "INPUT_FIELD_DEFINITION" => Self::InputFieldDefinition,
            "INPUT_OBJECT" => Self::InputObject,
            "INTERFACE" => Self::Interface,
            "MUTATION" => Self::Mutation,
            "OBJECT" => Self::Object,
            "QUERY" => Self::Query,
            "SCALAR" => Self::Scalar,
            "SCHEMA" => Self::Schema,
            "SUBSCRIPTION" => Self::Subscription,
            "UNION" => Self::Union,
            "VARIABLE_DEFINITION" => Self::VariableDefinition,
            _ => return None,
        };
        Some(location)
    }
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
