#![deny(warnings)]
#![deny(missing_docs)]

//! AST-based Rust model emitter for Wesley L1 IR.

use std::collections::BTreeSet;
use std::fmt::Write;
use wesley_core::{
    Field, OperationArgument, OperationType, SchemaOperation, TypeDefinition, TypeKind,
    TypeReference, WesleyIR,
};

/// Emits Rust model declarations for a Wesley L1 IR document.
pub fn emit_rust(ir: &WesleyIR) -> String {
    let file = RustFile::from_ir(ir);

    print_file(&file)
}

/// Emits Rust model and operation binding declarations for a Wesley L1 IR document.
pub fn emit_rust_with_operations(ir: &WesleyIR, operations: &[SchemaOperation]) -> String {
    let file = RustFile::from_ir_and_operations(ir, operations);

    print_file(&file)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustFile {
    items: Vec<RustItem>,
}

impl RustFile {
    fn from_ir(ir: &WesleyIR) -> Self {
        Self::from_ir_and_operations(ir, &[])
    }

    fn from_ir_and_operations(ir: &WesleyIR, operations: &[SchemaOperation]) -> Self {
        let mut items = Vec::new();
        let root_type_names = operations
            .iter()
            .map(|operation| operation.root_type_name.as_str())
            .collect::<BTreeSet<_>>();

        for type_def in &ir.types {
            if root_type_names.contains(type_def.name.as_str()) {
                continue;
            }

            match type_def.kind {
                TypeKind::Scalar if is_builtin_scalar(&type_def.name) => {}
                TypeKind::Scalar => items.push(RustItem::TypeAlias(RustTypeAlias {
                    name: rust_type_name(&type_def.name),
                    target: RustType::String,
                })),
                TypeKind::Object | TypeKind::Interface | TypeKind::InputObject => {
                    items.push(RustItem::Struct(struct_from_type(type_def)));
                }
                TypeKind::Enum => items.push(RustItem::Enum(enum_from_type(type_def))),
                TypeKind::Union => items.push(RustItem::Enum(union_enum_from_type(type_def))),
            }
        }

        items.extend(
            operations
                .iter()
                .map(|operation| RustItem::Operation(operation_binding_from_schema(operation))),
        );

        Self { items }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RustItem {
    TypeAlias(RustTypeAlias),
    Struct(RustStruct),
    Enum(RustEnum),
    Operation(RustOperationBinding),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustTypeAlias {
    name: String,
    target: RustType,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustStruct {
    name: String,
    fields: Vec<RustField>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustField {
    source_name: String,
    rust_name: String,
    ty: RustType,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustEnum {
    name: String,
    derive_eq: bool,
    variants: Vec<RustVariant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustOperationBinding {
    operation_type: &'static str,
    field_name: String,
    request: RustStruct,
    response_alias: RustTypeAlias,
    directives_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RustVariant {
    source_name: String,
    rust_name: String,
    payload: Option<RustType>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RustType {
    String,
    I32,
    F64,
    Bool,
    Named(String),
    Vec(Box<RustType>),
    Option(Box<RustType>),
}

fn struct_from_type(type_def: &TypeDefinition) -> RustStruct {
    RustStruct {
        name: rust_type_name(&type_def.name),
        fields: type_def.fields.iter().map(field_from_ir).collect(),
    }
}

fn field_from_ir(field: &Field) -> RustField {
    RustField {
        source_name: field.name.clone(),
        rust_name: rust_field_name(&field.name),
        ty: rust_type_from_reference(&field.r#type),
    }
}

fn enum_from_type(type_def: &TypeDefinition) -> RustEnum {
    RustEnum {
        name: rust_type_name(&type_def.name),
        derive_eq: true,
        variants: type_def
            .enum_values
            .iter()
            .map(|value| RustVariant {
                source_name: value.clone(),
                rust_name: rust_variant_name(value),
                payload: None,
            })
            .collect(),
    }
}

fn union_enum_from_type(type_def: &TypeDefinition) -> RustEnum {
    RustEnum {
        name: rust_type_name(&type_def.name),
        derive_eq: false,
        variants: type_def
            .union_members
            .iter()
            .map(|member| RustVariant {
                source_name: member.clone(),
                rust_name: rust_variant_name(member),
                payload: Some(RustType::Named(rust_type_name(member))),
            })
            .collect(),
    }
}

fn operation_binding_from_schema(operation: &SchemaOperation) -> RustOperationBinding {
    let request_type_name = operation_type_name(&operation.field_name, "Request");
    let response_type_name = operation_type_name(&operation.field_name, "Response");

    RustOperationBinding {
        operation_type: operation_type_literal(operation.operation_type),
        field_name: operation.field_name.clone(),
        request: RustStruct {
            name: request_type_name,
            fields: operation
                .arguments
                .iter()
                .map(field_from_operation_argument)
                .collect(),
        },
        response_alias: RustTypeAlias {
            name: response_type_name,
            target: rust_type_from_reference(&operation.result_type),
        },
        directives_json: serde_json::to_string(&operation.directives)
            .expect("schema operation directives should serialize"),
    }
}

fn field_from_operation_argument(argument: &OperationArgument) -> RustField {
    let mut ty = rust_type_from_reference(&argument.r#type);
    if argument.default_value.is_some() && !matches!(ty, RustType::Option(_)) {
        ty = RustType::Option(Box::new(ty));
    }

    RustField {
        source_name: argument.name.clone(),
        rust_name: rust_field_name(&argument.name),
        ty,
    }
}

fn rust_type_from_reference(type_ref: &TypeReference) -> RustType {
    let base = match type_ref.base.as_str() {
        "ID" | "String" => RustType::String,
        "Int" => RustType::I32,
        "Float" => RustType::F64,
        "Boolean" => RustType::Bool,
        name => RustType::Named(rust_type_name(name)),
    };

    let mut ty = if type_ref.is_list {
        let item = match type_ref.list_item_nullable {
            Some(true) | None => RustType::Option(Box::new(base)),
            Some(false) => base,
        };
        RustType::Vec(Box::new(item))
    } else {
        base
    };

    if type_ref.nullable {
        ty = RustType::Option(Box::new(ty));
    }

    ty
}

fn print_file(file: &RustFile) -> String {
    let mut out = String::from("// @generated by Wesley. Do not edit.\n");

    for item in &file.items {
        out.push('\n');
        print_item(&mut out, item);
    }

    out
}

fn print_item(out: &mut String, item: &RustItem) {
    match item {
        RustItem::TypeAlias(alias) => print_type_alias(out, alias),
        RustItem::Struct(struct_item) => print_struct(out, struct_item),
        RustItem::Enum(enum_item) => print_enum(out, enum_item),
        RustItem::Operation(operation) => print_operation_binding(out, operation),
    }
}

fn print_type_alias(out: &mut String, alias: &RustTypeAlias) {
    write!(out, "pub type {} = ", alias.name).expect("writing to string should not fail");
    print_type(out, &alias.target);
    out.push_str(";\n");
}

fn print_struct(out: &mut String, struct_item: &RustStruct) {
    out.push_str("#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]\n");
    writeln!(out, "pub struct {} {{", struct_item.name).expect("writing to string should not fail");

    for field in &struct_item.fields {
        if field.source_name != field.rust_name.trim_start_matches("r#") {
            writeln!(
                out,
                "    #[serde(rename = \"{}\")]",
                escape_attribute(&field.source_name)
            )
            .expect("writing to string should not fail");
        }
        write!(out, "    pub {}: ", field.rust_name).expect("writing to string should not fail");
        print_type(out, &field.ty);
        out.push_str(",\n");
    }

    out.push_str("}\n");
}

fn print_enum(out: &mut String, enum_item: &RustEnum) {
    if enum_item.derive_eq {
        out.push_str(
            "#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]\n",
        );
    } else {
        out.push_str("#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]\n");
    }
    writeln!(out, "pub enum {} {{", enum_item.name).expect("writing to string should not fail");

    for variant in &enum_item.variants {
        writeln!(
            out,
            "    #[serde(rename = \"{}\")]",
            escape_attribute(&variant.source_name)
        )
        .expect("writing to string should not fail");
        write!(out, "    {}", variant.rust_name).expect("writing to string should not fail");
        if let Some(payload) = &variant.payload {
            out.push('(');
            print_type(out, payload);
            out.push(')');
        }
        out.push_str(",\n");
    }

    out.push_str("}\n");
}

fn print_operation_binding(out: &mut String, operation: &RustOperationBinding) {
    print_struct(out, &operation.request);
    out.push('\n');
    print_type_alias(out, &operation.response_alias);
    out.push('\n');
    writeln!(out, "impl {} {{", operation.request.name).expect("writing to string should not fail");
    write!(out, "    pub const OPERATION_TYPE: &'static str = ")
        .expect("writing to string should not fail");
    print_rust_string_literal(out, operation.operation_type);
    out.push_str(";\n");
    write!(out, "    pub const FIELD_NAME: &'static str = ")
        .expect("writing to string should not fail");
    print_rust_string_literal(out, &operation.field_name);
    out.push_str(";\n");
    write!(out, "    pub const DIRECTIVES_JSON: &'static str = ")
        .expect("writing to string should not fail");
    print_rust_string_literal(out, &operation.directives_json);
    out.push_str(";\n");
    out.push_str("}\n");
}

fn print_type(out: &mut String, ty: &RustType) {
    match ty {
        RustType::String => out.push_str("String"),
        RustType::I32 => out.push_str("i32"),
        RustType::F64 => out.push_str("f64"),
        RustType::Bool => out.push_str("bool"),
        RustType::Named(name) => out.push_str(name),
        RustType::Vec(item) => {
            out.push_str("Vec<");
            print_type(out, item);
            out.push('>');
        }
        RustType::Option(item) => {
            out.push_str("Option<");
            print_type(out, item);
            out.push('>');
        }
    }
}

fn operation_type_literal(operation_type: OperationType) -> &'static str {
    match operation_type {
        OperationType::Query => "QUERY",
        OperationType::Mutation => "MUTATION",
        OperationType::Subscription => "SUBSCRIPTION",
    }
}

fn is_builtin_scalar(name: &str) -> bool {
    matches!(name, "ID" | "String" | "Int" | "Float" | "Boolean")
}

fn rust_type_name(name: &str) -> String {
    let mut candidate = sanitize_pascal_identifier(name);
    if candidate.is_empty() {
        candidate.push_str("GeneratedType");
    }
    if candidate
        .chars()
        .next()
        .is_some_and(|ch| ch.is_ascii_digit())
    {
        candidate.insert(0, '_');
    }
    if is_reserved_word(&candidate) {
        candidate.push_str("Type");
    }

    candidate
}

fn operation_type_name(field_name: &str, suffix: &str) -> String {
    rust_type_name(&format!("{field_name}{suffix}"))
}

fn rust_variant_name(name: &str) -> String {
    let mut candidate = if name.contains('_') || name.chars().all(|ch| !ch.is_ascii_lowercase()) {
        to_pascal_case(name)
    } else {
        sanitize_pascal_identifier(name)
    };
    if candidate.is_empty() {
        candidate.push_str("GeneratedVariant");
    }
    if candidate
        .chars()
        .next()
        .is_some_and(|ch| ch.is_ascii_digit())
    {
        candidate.insert(0, '_');
    }
    if is_reserved_word(&candidate) {
        candidate.push_str("Variant");
    }

    candidate
}

fn rust_field_name(name: &str) -> String {
    let mut candidate = to_snake_case(name);
    if candidate.is_empty() {
        candidate.push_str("generated_field");
    }
    if candidate
        .chars()
        .next()
        .is_some_and(|ch| ch.is_ascii_digit())
    {
        candidate.insert(0, '_');
    }
    if is_reserved_word(&candidate) {
        candidate.insert_str(0, "r#");
    }

    candidate
}

fn to_pascal_case(name: &str) -> String {
    let mut out = String::new();
    let mut uppercase_next = true;

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            if uppercase_next {
                out.push(ch.to_ascii_uppercase());
                uppercase_next = false;
            } else {
                out.push(ch.to_ascii_lowercase());
            }
        } else {
            uppercase_next = true;
        }
    }

    out
}

fn sanitize_pascal_identifier(name: &str) -> String {
    let mut out = String::new();

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else if !out.ends_with('_') {
            out.push('_');
        }
    }

    let mut chars = out.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };

    if first.is_ascii_alphabetic() || first == '_' {
        let mut sanitized = String::new();
        sanitized.push(first.to_ascii_uppercase());
        sanitized.extend(chars);
        sanitized.trim_matches('_').to_string()
    } else {
        format!("_{}", out.trim_matches('_'))
    }
}

fn to_snake_case(name: &str) -> String {
    let mut out = String::new();

    for (index, ch) in name.chars().enumerate() {
        if ch.is_ascii_uppercase() {
            if index > 0 && !out.ends_with('_') {
                out.push('_');
            }
            out.push(ch.to_ascii_lowercase());
        } else if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            out.push(ch);
        } else if !out.ends_with('_') {
            out.push('_');
        }
    }

    out.trim_matches('_').to_string()
}

fn is_reserved_word(name: &str) -> bool {
    matches!(
        name,
        "Self"
            | "abstract"
            | "as"
            | "async"
            | "await"
            | "become"
            | "box"
            | "break"
            | "const"
            | "continue"
            | "crate"
            | "do"
            | "dyn"
            | "else"
            | "enum"
            | "extern"
            | "false"
            | "final"
            | "fn"
            | "for"
            | "if"
            | "impl"
            | "in"
            | "let"
            | "loop"
            | "macro"
            | "match"
            | "mod"
            | "move"
            | "mut"
            | "override"
            | "priv"
            | "pub"
            | "ref"
            | "return"
            | "self"
            | "static"
            | "struct"
            | "super"
            | "trait"
            | "true"
            | "try"
            | "type"
            | "typeof"
            | "union"
            | "unsafe"
            | "unsized"
            | "use"
            | "virtual"
            | "where"
            | "while"
            | "yield"
    )
}

fn escape_attribute(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn print_rust_string_literal(out: &mut String, value: &str) {
    out.push('"');
    for ch in value.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(ch),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use wesley_core::{list_schema_operations_sdl, lower_schema_sdl};

    #[test]
    fn emits_rust_models_from_l1_ir() {
        let ir = lower_schema_sdl(
            r#"
            scalar DateTime

            enum Role {
              ADMIN
              READ_ONLY
            }

            type User {
              id: ID!
              displayName: String
              createdAt: DateTime!
              tags: [String]
            }

            input UserFilter {
              role: Role
              limit: Int!
            }
            "#,
        )
        .expect("schema should lower");

        let actual = emit_rust(&ir);

        syn::parse_file(&actual).expect("generated Rust should parse");
        assert_eq!(
            actual,
            r#"// @generated by Wesley. Do not edit.

pub type DateTime = String;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Role {
    #[serde(rename = "ADMIN")]
    Admin,
    #[serde(rename = "READ_ONLY")]
    ReadOnly,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime,
    pub tags: Option<Vec<Option<String>>>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct UserFilter {
    pub role: Option<Role>,
    pub limit: i32,
}
"#
        );
    }

    #[test]
    fn emits_jedit_shaped_hot_text_fixture() {
        let ir = lower_schema_sdl(include_str!(
            "../../../test/fixtures/consumer-models/jedit-hot-text-core.graphql"
        ))
        .expect("jedit-shaped fixture should lower");

        let actual = emit_rust(&ir);

        syn::parse_file(&actual).expect("generated Rust should parse");
        assert!(actual.contains("pub struct BufferWorldline {"));
        assert!(actual.contains("pub enum AnchorKind {"));
        assert!(actual.contains("pub checkpoints: Vec<Checkpoint>,"));
        assert!(actual.contains("pub created_at_tick_id: Option<String>,"));
        assert!(actual.contains("pub create_initial_checkpoint: Option<bool>,"));
    }

    #[test]
    fn emits_jedit_operation_bindings() {
        let sdl =
            include_str!("../../../test/fixtures/consumer-models/jedit-hot-text-runtime.graphql");
        let ir = lower_schema_sdl(sdl).expect("jedit runtime fixture should lower");
        let operations =
            list_schema_operations_sdl(sdl).expect("jedit runtime operations should resolve");

        let actual = emit_rust_with_operations(&ir, &operations);

        syn::parse_file(&actual).expect("generated Rust should parse");
        assert!(!actual.contains("pub struct Mutation {"));
        assert!(actual.contains("pub struct CreateBufferWorldlineRequest {"));
        assert!(actual.contains("pub input: CreateBufferWorldlineInput,"));
        assert!(actual
            .contains("pub type CreateBufferWorldlineResponse = CreateBufferWorldlineResult;"));
        assert!(actual.contains("pub const OPERATION_TYPE: &'static str = \"MUTATION\";"));
        assert!(actual.contains("pub const FIELD_NAME: &'static str = \"createBufferWorldline\";"));
        assert!(actual.contains("pub const DIRECTIVES_JSON: &'static str = "));
        assert!(actual.contains("\\\"wes_footprint\\\""));
    }

    #[test]
    fn sanitizes_reserved_field_names() {
        assert_eq!(rust_field_name("type"), "r#type");
        assert_eq!(rust_field_name("displayName"), "display_name");
    }

    #[test]
    fn union_payload_enums_do_not_derive_eq() {
        let ir = lower_schema_sdl(
            r#"
            type User {
              id: ID!
            }

            union SearchResult = User
            "#,
        )
        .expect("schema should lower");

        let actual = emit_rust(&ir);

        syn::parse_file(&actual).expect("generated Rust should parse");
        assert!(actual.contains(
            "#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]\npub enum SearchResult"
        ));
    }
}
