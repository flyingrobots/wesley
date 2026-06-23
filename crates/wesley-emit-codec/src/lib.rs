//! Language-neutral LE-binary codec plan.
//!
//! This crate lowers a Wesley L1 IR into a small, target-agnostic description of
//! *what* the codec does — which values are scalars, enums, nested structs,
//! options, or lists, and in what field order. The Rust and TypeScript emitters
//! consume this one plan and only decide *how* to spell it in their language, so
//! the structural logic (nullable → option, list → length-prefixed, scalar →
//! primitive, named type → sub-codec) lives in exactly one place and the two
//! backends cannot drift on the wire.
//!
//! Names in the plan are the **source** GraphQL names; each backend applies its
//! own casing (`rust_field_name`, `pascalCase`, …).

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use std::collections::BTreeSet;

use wesley_core::{OperationType, SchemaOperation, TypeKind, TypeReference, WesleyIR};

/// A primitive wire scalar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarKind {
    /// `Boolean` — a single tagged byte.
    Bool,
    /// `Int` — `i32` little-endian.
    Int,
    /// `Float` — `f32` little-endian.
    Float,
    /// `String` / `ID` — `u32` length-prefixed UTF-8.
    String,
}

/// How to read or write a single value. Recurses for options and lists; a
/// [`CodecOp::Named`] defers to another [`CodecDef`]'s codec by source name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CodecOp {
    /// A primitive scalar.
    Scalar(ScalarKind),
    /// A reference to another emitted type (enum or struct), by source name.
    Named(String),
    /// A nullable value: a presence tag, then the inner value when present.
    Option(Box<CodecOp>),
    /// A list: a `u32` element count, then each element in turn.
    List(Box<CodecOp>),
}

/// One field of a struct, in wire (declaration) order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldPlan {
    /// The source field/argument name (backends apply their own casing).
    pub name: String,
    /// The codec for this field's value.
    pub op: CodecOp,
}

/// Which SDL declaration a struct codec came from. Carried so a backend can
/// label the declaration in its own idiom; it does not affect the wire format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StructKind {
    /// A GraphQL `input` object.
    Input,
    /// A GraphQL output `type`.
    Object,
    /// A GraphQL `interface`.
    Interface,
}

/// A top-level codec, emitted as an `encode_*` / `decode_*` pair.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CodecDef {
    /// An enum: encoded as the zero-based variant ordinal (`u32` LE).
    Enum {
        /// Source type name.
        name: String,
        /// Variant names in declaration (ordinal) order.
        variants: Vec<String>,
    },
    /// A struct (input object, output object, or interface): its fields in order.
    Struct {
        /// Source type name.
        name: String,
        /// Which SDL declaration it came from.
        kind: StructKind,
        /// Fields in wire order.
        fields: Vec<FieldPlan>,
    },
    /// An operation's variables. The struct is named differently per language
    /// (TypeScript `<field>Vars`, Rust `<Operation><Field>Request`), so the plan
    /// carries the raw operation identity and lets each backend name it.
    Operation {
        /// The operation kind.
        operation_type: OperationType,
        /// The root field name.
        field_name: String,
        /// The operation arguments, in wire order.
        fields: Vec<FieldPlan>,
    },
}

/// Lower a Wesley L1 IR and its operations into the codec plan.
///
/// Enums, input objects, and output objects each become a [`CodecDef`];
/// operation root types (Query / Mutation / Subscription) are skipped as data
/// types but their variables become [`CodecDef::Operation`].
#[must_use]
pub fn plan(ir: &WesleyIR, operations: &[SchemaOperation]) -> Vec<CodecDef> {
    let root_type_names: BTreeSet<&str> = operations
        .iter()
        .map(|operation| operation.root_type_name.as_str())
        .collect();

    let mut defs = Vec::new();
    for type_def in &ir.types {
        match type_def.kind {
            TypeKind::Enum => defs.push(CodecDef::Enum {
                name: type_def.name.clone(),
                variants: type_def.enum_values.clone(),
            }),
            TypeKind::InputObject | TypeKind::Object | TypeKind::Interface
                if !root_type_names.contains(type_def.name.as_str()) =>
            {
                defs.push(CodecDef::Struct {
                    name: type_def.name.clone(),
                    kind: match type_def.kind {
                        TypeKind::InputObject => StructKind::Input,
                        TypeKind::Interface => StructKind::Interface,
                        _ => StructKind::Object,
                    },
                    fields: type_def
                        .fields
                        .iter()
                        .map(|field| FieldPlan {
                            name: field.name.clone(),
                            op: op_for(&field.r#type),
                        })
                        .collect(),
                });
            }
            _ => {}
        }
    }

    for operation in operations {
        defs.push(CodecDef::Operation {
            operation_type: operation.operation_type,
            field_name: operation.field_name.clone(),
            fields: operation
                .arguments
                .iter()
                .map(|argument| FieldPlan {
                    name: argument.name.clone(),
                    op: op_for(&argument.r#type),
                })
                .collect(),
        });
    }

    defs
}

/// Lower one [`TypeReference`] into a [`CodecOp`]: nullable wraps in an option,
/// a list wraps its element, and a bare leaf is a scalar or a named sub-codec.
fn op_for(ty: &TypeReference) -> CodecOp {
    if ty.nullable {
        let mut inner = ty.clone();
        inner.nullable = false;
        return CodecOp::Option(Box::new(op_for(&inner)));
    }
    if let Some(item) = list_item_type_reference(ty) {
        return CodecOp::List(Box::new(op_for(&item)));
    }
    match ty.base.as_str() {
        "Boolean" => CodecOp::Scalar(ScalarKind::Bool),
        "Int" => CodecOp::Scalar(ScalarKind::Int),
        "Float" => CodecOp::Scalar(ScalarKind::Float),
        "String" | "ID" => CodecOp::Scalar(ScalarKind::String),
        other => CodecOp::Named(other.to_string()),
    }
}

/// Peel one list wrapper off `ty`, yielding the element's [`TypeReference`], or
/// `None` if `ty` is not a list. The single source of the nested list /
/// nullability rules both emitters previously duplicated.
fn list_item_type_reference(ty: &TypeReference) -> Option<TypeReference> {
    if !ty.is_list {
        return None;
    }

    if ty.list_wrappers.is_empty() {
        return Some(TypeReference {
            base: ty.base.clone(),
            nullable: ty.list_item_nullable.unwrap_or(true),
            is_list: false,
            list_item_nullable: None,
            list_wrappers: Vec::new(),
            leaf_nullable: None,
        });
    }

    let remaining = ty.list_wrappers[1..].to_vec();
    if remaining.is_empty() {
        return Some(TypeReference {
            base: ty.base.clone(),
            nullable: ty.leaf_nullable.unwrap_or(true),
            is_list: false,
            list_item_nullable: None,
            list_wrappers: Vec::new(),
            leaf_nullable: None,
        });
    }

    let next_nullable = remaining
        .get(1)
        .map(|wrapper| wrapper.nullable)
        .unwrap_or_else(|| ty.leaf_nullable.unwrap_or(true));
    Some(TypeReference {
        base: ty.base.clone(),
        nullable: remaining[0].nullable,
        is_list: true,
        list_item_nullable: Some(next_nullable),
        list_wrappers: remaining,
        leaf_nullable: ty.leaf_nullable,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use wesley_core::{list_schema_operations_sdl, lower_schema_sdl};

    fn named(defs: &[CodecDef], name: &str) -> CodecDef {
        defs.iter()
            .find(|def| match def {
                CodecDef::Enum { name: n, .. } | CodecDef::Struct { name: n, .. } => n == name,
                CodecDef::Operation { field_name, .. } => field_name == name,
            })
            .cloned()
            .unwrap_or_else(|| panic!("no codec def named {name}"))
    }

    #[test]
    fn lowers_scalars_enums_options_and_nested_lists() {
        let sdl = include_str!("../../../test/fixtures/typescript-emitter/le-binary-codec.graphql");
        let ir = lower_schema_sdl(sdl).expect("schema lowers");
        let ops = list_schema_operations_sdl(sdl).expect("operations enumerable");
        let defs = plan(&ir, &ops);

        // Enum carries its variants in ordinal order.
        assert_eq!(
            named(&defs, "Color"),
            CodecDef::Enum {
                name: "Color".to_string(),
                variants: vec!["RED".into(), "GREEN".into(), "BLUE".into()],
            }
        );

        // The input object lowers each field's nullability/list structure.
        let CodecDef::Struct { fields, .. } = named(&defs, "MakeWidgetInput") else {
            panic!("MakeWidgetInput is a struct");
        };
        let op_of = |name: &str| fields.iter().find(|f| f.name == name).unwrap().op.clone();
        assert_eq!(op_of("label"), CodecOp::Scalar(ScalarKind::String));
        assert_eq!(op_of("count"), CodecOp::Scalar(ScalarKind::Int));
        assert_eq!(
            op_of("color"),
            CodecOp::Option(Box::new(CodecOp::Named("Color".to_string())))
        );
        assert_eq!(
            op_of("tags"),
            CodecOp::List(Box::new(CodecOp::Scalar(ScalarKind::String)))
        );
        // [[Int!]!]! → list of list of int.
        assert_eq!(
            op_of("matrix"),
            CodecOp::List(Box::new(CodecOp::List(Box::new(CodecOp::Scalar(
                ScalarKind::Int
            )))))
        );

        // Output object `type Widget` is planned; operation roots are not.
        assert!(matches!(named(&defs, "Widget"), CodecDef::Struct { .. }));
        assert!(!defs.iter().any(|def| matches!(
            def,
            CodecDef::Struct { name, .. } if name == "Mutation" || name == "Query"
        )));

        // The mutation's variables are planned as an operation.
        assert!(matches!(
            named(&defs, "makeWidget"),
            CodecDef::Operation { .. }
        ));
    }
}
