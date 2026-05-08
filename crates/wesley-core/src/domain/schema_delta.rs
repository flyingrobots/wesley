//! Schema delta data and L1 IR diffing.

use crate::domain::ir::{Field, TypeDefinition, TypeKind, TypeReference, WesleyIR};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Machine-readable structural delta between two Wesley L1 schemas.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDelta {
    /// Types present in the new schema but absent from the old schema.
    pub added_types: Vec<TypeDelta>,
    /// Types present in the old schema but absent from the new schema.
    pub removed_types: Vec<TypeDelta>,
    /// Types present in both schemas whose L1 structure changed.
    pub modified_types: Vec<TypeModification>,
}

impl SchemaDelta {
    /// Returns true when the delta contains no structural changes.
    pub fn is_empty(&self) -> bool {
        self.added_types.is_empty()
            && self.removed_types.is_empty()
            && self.modified_types.is_empty()
    }

    /// Returns true when any change in the delta is classified as breaking.
    pub fn has_breaking_changes(&self) -> bool {
        self.added_types.iter().any(|change| change.breaking)
            || self.removed_types.iter().any(|change| change.breaking)
            || self.modified_types.iter().any(|change| change.breaking)
    }
}

/// Added or removed type-level delta entry.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TypeDelta {
    /// Type name.
    pub name: String,
    /// Whether the change is breaking for schema consumers.
    pub breaking: bool,
    /// Human-readable change description.
    pub description: String,
}

/// Structural changes for a type that exists in both schemas.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TypeModification {
    /// Type name.
    pub name: String,
    /// Whether any nested change is breaking.
    pub breaking: bool,
    /// Human-readable summary.
    pub description: String,
    /// Type kind change, if the name was reused for a different GraphQL type family.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind_change: Option<TypeKindChange>,
    /// Field or input-field changes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub field_changes: Vec<SchemaElementChange>,
    /// Enum value changes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub enum_value_changes: Vec<SchemaElementChange>,
    /// Union member changes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub union_member_changes: Vec<SchemaElementChange>,
    /// Implemented interface changes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub implements_changes: Vec<SchemaElementChange>,
    /// Type directive changes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub directive_changes: Vec<SchemaElementChange>,
}

/// Change in the GraphQL type family for a named type.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TypeKindChange {
    /// Previous kind.
    pub old_kind: TypeKind,
    /// New kind.
    pub new_kind: TypeKind,
    /// Whether the change is breaking for schema consumers.
    pub breaking: bool,
    /// Human-readable change description.
    pub description: String,
}

/// A named nested schema element change.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaElementChange {
    /// Element name.
    pub name: String,
    /// Added, removed, or changed.
    pub kind: ChangeKind,
    /// Whether the change is breaking for schema consumers.
    pub breaking: bool,
    /// Human-readable change description.
    pub description: String,
}

/// Kind of structural change.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    /// Element was added.
    Added,
    /// Element was removed.
    Removed,
    /// Element exists in both schemas but changed.
    Changed,
}

/// Computes the structural delta between two already-lowered L1 IR documents.
pub fn diff_schema_ir(old_ir: &WesleyIR, new_ir: &WesleyIR) -> SchemaDelta {
    let old_types = type_map(&old_ir.types);
    let new_types = type_map(&new_ir.types);

    let mut added_types = Vec::new();
    let mut removed_types = Vec::new();
    let mut modified_types = Vec::new();

    for name in new_types.keys() {
        if !old_types.contains_key(name) {
            added_types.push(TypeDelta {
                name: (*name).to_string(),
                breaking: false,
                description: format!("Type \"{name}\" added"),
            });
        }
    }

    for name in old_types.keys() {
        if !new_types.contains_key(name) {
            removed_types.push(TypeDelta {
                name: (*name).to_string(),
                breaking: true,
                description: format!("Type \"{name}\" removed"),
            });
        }
    }

    for (name, new_type) in &new_types {
        let Some(old_type) = old_types.get(name) else {
            continue;
        };

        if let Some(modification) = diff_type(old_type, new_type) {
            modified_types.push(modification);
        }
    }

    SchemaDelta {
        added_types,
        removed_types,
        modified_types,
    }
}

fn type_map(types: &[TypeDefinition]) -> BTreeMap<&str, &TypeDefinition> {
    types
        .iter()
        .map(|type_def| (type_def.name.as_str(), type_def))
        .collect()
}

fn diff_type(old_type: &TypeDefinition, new_type: &TypeDefinition) -> Option<TypeModification> {
    let kind_change = diff_type_kind(old_type, new_type);
    let field_changes = diff_fields(old_type, new_type);
    let enum_value_changes = diff_string_members(
        &old_type.enum_values,
        &new_type.enum_values,
        "Enum value",
        &old_type.name,
        false,
        true,
    );
    let union_member_changes = diff_string_members(
        &old_type.union_members,
        &new_type.union_members,
        "Union member",
        &old_type.name,
        false,
        true,
    );
    let implements_changes = diff_string_members(
        &old_type.implements,
        &new_type.implements,
        "Implemented interface",
        &old_type.name,
        false,
        true,
    );
    let directive_changes = diff_directives(old_type, new_type);

    let breaking = kind_change
        .as_ref()
        .map(|change| change.breaking)
        .unwrap_or(false)
        || field_changes.iter().any(|change| change.breaking)
        || enum_value_changes.iter().any(|change| change.breaking)
        || union_member_changes.iter().any(|change| change.breaking)
        || implements_changes.iter().any(|change| change.breaking)
        || directive_changes.iter().any(|change| change.breaking);

    let parts = [
        count_part(kind_change.is_some(), "kind change"),
        count_vec_part(field_changes.len(), "field change"),
        count_vec_part(enum_value_changes.len(), "enum value change"),
        count_vec_part(union_member_changes.len(), "union member change"),
        count_vec_part(implements_changes.len(), "implements change"),
        count_vec_part(directive_changes.len(), "directive change"),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();

    if parts.is_empty() {
        return None;
    }

    Some(TypeModification {
        name: new_type.name.clone(),
        breaking,
        description: format!("Type \"{}\" modified: {}", new_type.name, parts.join(", ")),
        kind_change,
        field_changes,
        enum_value_changes,
        union_member_changes,
        implements_changes,
        directive_changes,
    })
}

fn diff_type_kind(old_type: &TypeDefinition, new_type: &TypeDefinition) -> Option<TypeKindChange> {
    if old_type.kind == new_type.kind {
        return None;
    }

    Some(TypeKindChange {
        old_kind: old_type.kind,
        new_kind: new_type.kind,
        breaking: true,
        description: format!(
            "Type \"{}\" changed kind from {:?} to {:?}",
            old_type.name, old_type.kind, new_type.kind
        ),
    })
}

fn diff_fields(old_type: &TypeDefinition, new_type: &TypeDefinition) -> Vec<SchemaElementChange> {
    let old_fields = field_map(&old_type.fields);
    let new_fields = field_map(&new_type.fields);
    let mut changes = Vec::new();

    for (name, field) in &new_fields {
        if !old_fields.contains_key(name) {
            let breaking = new_type.kind == TypeKind::InputObject && !field.r#type.nullable;
            let description = if breaking {
                format!(
                    "Required input field \"{name}\" added to {} (breaking)",
                    new_type.name
                )
            } else {
                format!("Field \"{name}\" added to {}", new_type.name)
            };
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Added,
                breaking,
                description,
            });
        }
    }

    for name in old_fields.keys() {
        if !new_fields.contains_key(name) {
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Removed,
                breaking: true,
                description: format!("Field \"{name}\" removed from {}", old_type.name),
            });
        }
    }

    for (name, new_field) in &new_fields {
        let Some(old_field) = old_fields.get(name) else {
            continue;
        };

        let old_type_ref = format_type_reference(&old_field.r#type);
        let new_type_ref = format_type_reference(&new_field.r#type);
        if old_type_ref != new_type_ref {
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Changed,
                breaking: true,
                description: format!(
                    "Field \"{name}\" on {} changed type from {old_type_ref} to {new_type_ref}",
                    new_type.name
                ),
            });
        }

        if old_field.directives != new_field.directives {
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Changed,
                breaking: true,
                description: format!("Field \"{name}\" directives changed on {}", new_type.name),
            });
        }
    }

    changes
}

fn field_map(fields: &[Field]) -> BTreeMap<&str, &Field> {
    fields
        .iter()
        .map(|field| (field.name.as_str(), field))
        .collect()
}

fn diff_string_members(
    old_values: &[String],
    new_values: &[String],
    label: &str,
    type_name: &str,
    added_breaking: bool,
    removed_breaking: bool,
) -> Vec<SchemaElementChange> {
    let old_map = string_map(old_values);
    let new_map = string_map(new_values);
    let mut changes = Vec::new();

    for name in new_map.keys() {
        if !old_map.contains_key(name) {
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Added,
                breaking: added_breaking,
                description: format!("{label} \"{name}\" added to {type_name}"),
            });
        }
    }

    for name in old_map.keys() {
        if !new_map.contains_key(name) {
            changes.push(SchemaElementChange {
                name: (*name).to_string(),
                kind: ChangeKind::Removed,
                breaking: removed_breaking,
                description: format!("{label} \"{name}\" removed from {type_name}"),
            });
        }
    }

    changes
}

fn string_map(values: &[String]) -> BTreeMap<&str, ()> {
    values.iter().map(|value| (value.as_str(), ())).collect()
}

fn diff_directives(
    old_type: &TypeDefinition,
    new_type: &TypeDefinition,
) -> Vec<SchemaElementChange> {
    let mut changes = Vec::new();

    for (name, value) in &new_type.directives {
        match old_type.directives.get(name) {
            None => changes.push(SchemaElementChange {
                name: name.clone(),
                kind: ChangeKind::Added,
                breaking: false,
                description: format!("Directive @{name} added to {}", new_type.name),
            }),
            Some(old_value) if old_value != value => changes.push(SchemaElementChange {
                name: name.clone(),
                kind: ChangeKind::Changed,
                breaking: true,
                description: format!("Directive @{name} changed on {}", new_type.name),
            }),
            Some(_) => {}
        }
    }

    for name in old_type.directives.keys() {
        if !new_type.directives.contains_key(name) {
            changes.push(SchemaElementChange {
                name: name.clone(),
                kind: ChangeKind::Removed,
                breaking: true,
                description: format!("Directive @{name} removed from {}", old_type.name),
            });
        }
    }

    changes
}

fn format_type_reference(type_ref: &TypeReference) -> String {
    let mut formatted = if type_ref.is_list {
        let item_suffix = match type_ref.list_item_nullable {
            Some(false) => "!",
            Some(true) | None => "",
        };
        format!("[{}{}]", type_ref.base, item_suffix)
    } else {
        type_ref.base.clone()
    };

    if !type_ref.nullable {
        formatted.push('!');
    }

    formatted
}

fn count_part(has_change: bool, label: &'static str) -> Option<String> {
    if has_change {
        Some(format!("1 {label}"))
    } else {
        None
    }
}

fn count_vec_part(count: usize, label: &'static str) -> Option<String> {
    match count {
        0 => None,
        1 => Some(format!("1 {label}")),
        _ => Some(format!("{count} {label}s")),
    }
}
