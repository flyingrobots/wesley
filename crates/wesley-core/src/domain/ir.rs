//! Wesley Intermediate Representation (IR).

use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

/// The root Wesley IR structure.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WesleyIR {
    /// IR Schema version (e.g. "1.0.0").
    pub version: String,
    /// Non-deterministic metadata (stripped during parity hashing).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Metadata>,
    /// Table definitions extracted from SDL.
    pub tables: Vec<Table>,
    /// Enum definitions.
    #[serde(default)]
    pub enums: Vec<Enum>,
    /// Custom scalar definitions.
    #[serde(default)]
    pub scalars: Vec<CustomScalar>,
    /// Synthesized relationships.
    #[serde(default)]
    pub relationships: Vec<Relationship>,
}

/// Metadata for the IR.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    /// SHA-256 hash of the source SDL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<String>,
    /// ISO-8601 generation timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<String>,
    /// Name of the schema.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_name: Option<String>,
}

/// A table definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Table {
    /// Table name.
    pub name: String,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Table-level directives.
    pub directives: TableDirectives,
    /// Field definitions.
    pub fields: Vec<Field>,
    /// Index definitions.
    #[serde(default)]
    pub indexes: Vec<Index>,
    /// Constraint definitions.
    #[serde(default)]
    pub constraints: Vec<Constraint>,
}

/// Table-level directives (e.g. @wes_table).
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableDirectives {
    /// Whether this is explicitly marked as a table.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table: Option<bool>,
    /// RLS configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rls: Option<RLSConfig>,
    /// Tenant configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant: Option<TenantConfig>,
    /// Audit configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit: Option<bool>,
    /// Soft delete configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub soft_delete: Option<bool>,
}

/// A field definition within a table.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    /// Field name.
    pub name: String,
    /// Field type information.
    pub r#type: FieldType,
    /// Whether the field can be null.
    pub nullable: bool,
    /// Field-level directives.
    pub directives: FieldDirectives,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Detailed field type information.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldType {
    /// Base type name (e.g. "String", "Int").
    pub base: String,
    /// Whether this is a list type.
    pub is_list: bool,
    /// Whether items in the list can be null.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_item_nullable: Option<bool>,
}

/// Field-level directives (e.g. @wes_pk, @wes_fk).
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct FieldDirectives {
    /// Primary key flag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pk: Option<bool>,
    /// Unique constraint flag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unique: Option<bool>,
    /// Index flag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<bool>,
    /// Default value configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<DefaultValue>,
    /// Foreign key configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fk: Option<ForeignKey>,
}

/// Default value configuration.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DefaultValue {
    /// The default value.
    pub value: serde_json::Value,
    /// Whether the value is a SQL expression.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_sql: Option<bool>,
}

/// Foreign key configuration.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKey {
    /// Target table name.
    pub target_table: String,
    /// Target field name.
    pub target_field: String,
    /// On delete behavior.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_delete: Option<String>,
}

/// Index definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Index {
    /// Fields involved in the index.
    pub fields: Vec<String>,
    /// Optional index name.
    pub name: Option<String>,
    /// Table name.
    pub table: String,
    /// Whether the index is unique.
    pub unique: bool,
    /// Indexing method (e.g. "btree").
    pub using: Option<String>,
}

/// Constraint definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Constraint {
    /// Constraint name.
    pub name: String,
    /// Constraint type (e.g. "check").
    pub r#type: String,
    /// Table name.
    pub table: String,
    /// Constraint definition string.
    pub definition: String,
}

/// Relationship between tables.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Relationship {
    /// Relationship type (e.g. "one-to-many").
    pub r#type: String,
    /// Source reference.
    pub from: TableFieldRef,
    /// Target reference.
    pub to: TableFieldRef,
}

/// Reference to a specific field in a table.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableFieldRef {
    /// Table name.
    pub table: String,
    /// Field name.
    pub field: String,
}

/// RLS configuration.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct RLSConfig {
    /// Whether RLS is enabled.
    pub enable: bool,
}

/// Tenant configuration.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TenantConfig {
    /// Field name used for partitioning by tenant.
    pub field: String,
}

/// Enum definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Enum {
    /// Enum name.
    pub name: String,
    /// Possible enum values.
    pub values: Vec<String>,
}

/// Custom scalar definition.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomScalar {
    /// Scalar name.
    pub name: String,
    /// Target SQL type.
    pub sql_type: String,
}

/// Computes the canonical registry hash for the given IR.
/// Matches @wesley/core domain/registryHash.mjs logic.
pub fn compute_registry_hash(ir: &WesleyIR) -> Result<String, serde_json::Error> {
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;

    let json = to_canonical_json(&parity_ir)?;
    
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    let result = hasher.finalize();
    
    Ok(hex::encode(result))
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
