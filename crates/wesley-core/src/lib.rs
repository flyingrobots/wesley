use serde::{Deserialize, Serialize};
use indexmap::IndexMap;
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WesleyIR {
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Metadata>,
    pub tables: Vec<Table>,
    #[serde(default)]
    pub enums: Vec<Enum>,
    #[serde(default)]
    pub scalars: Vec<CustomScalar>,
    #[serde(default)]
    pub relationships: Vec<Relationship>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Table {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub directives: TableDirectives,
    pub fields: Vec<Field>,
    #[serde(default)]
    pub indexes: Vec<Index>,
    #[serde(default)]
    pub constraints: Vec<Constraint>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableDirectives {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rls: Option<RLSConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant: Option<TenantConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub soft_delete: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    pub name: String,
    pub r#type: FieldType,
    pub nullable: bool,
    pub directives: FieldDirectives,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldType {
    pub base: String,
    pub is_list: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_item_nullable: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct FieldDirectives {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pk: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unique: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<DefaultValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fk: Option<ForeignKey>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DefaultValue {
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_sql: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKey {
    pub target_table: String,
    pub target_field: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_delete: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Index {
    pub fields: Vec<String>,
    pub name: Option<String>,
    pub table: String,
    pub unique: bool,
    pub using: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Constraint {
    pub name: String,
    pub r#type: String,
    pub table: String,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Relationship {
    pub r#type: String,
    pub from: TableFieldRef,
    pub to: TableFieldRef,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableFieldRef {
    pub table: String,
    pub field: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct RLSConfig {
    pub enable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TenantConfig {
    pub field: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Enum {
    pub name: String,
    pub values: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomScalar {
    pub name: String,
    pub sql_type: String,
}

/// Computes the canonical registry hash for the given IR.
/// Matches @wesley/core domain/registryHash.mjs logic.
pub fn compute_registry_hash(ir: &WesleyIR) -> Result<String, serde_json::Error> {
    // Clone and strip metadata for parity hashing
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;

    // Serialize to canonical JSON (sorted keys)
    let json = to_canonical_json(&parity_ir)?;
    
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    let result = hasher.finalize();
    
    Ok(hex::encode(result))
}

/// Serializes a value to a canonical JSON string (sorted keys, no whitespace).
/// Using a BTreeMap or similar sorting mechanism would be more robust for deep sorting,
/// but serde_json with a custom formatter or pre-processing to Map<String, Value> is required.
pub fn to_canonical_json<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
    // Convert to a generic Value first to allow recursive key sorting
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
