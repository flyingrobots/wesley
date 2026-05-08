#![deny(warnings)]
#![deny(missing_docs)]

//! AST-based TypeScript declaration emitter for Wesley L1 IR.

use std::fmt::Write;
use wesley_core::{Field, TypeDefinition, TypeKind, TypeReference, WesleyIR};

/// Emits TypeScript declarations for a Wesley L1 IR document.
pub fn emit_typescript(ir: &WesleyIR) -> String {
    let program = TsProgram::from_ir(ir);

    print_program(&program)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TsProgram {
    declarations: Vec<TsDeclaration>,
}

impl TsProgram {
    fn from_ir(ir: &WesleyIR) -> Self {
        let mut declarations = Vec::new();

        for type_def in &ir.types {
            match type_def.kind {
                TypeKind::Scalar if is_builtin_scalar(&type_def.name) => {}
                TypeKind::Scalar => declarations.push(TsDeclaration::TypeAlias(TsTypeAlias {
                    name: ts_type_name(&type_def.name),
                    type_expr: TsTypeExpr::Unknown,
                })),
                TypeKind::Object | TypeKind::Interface | TypeKind::InputObject => {
                    declarations.push(TsDeclaration::Interface(interface_from_type(type_def)));
                }
                TypeKind::Enum => declarations.push(TsDeclaration::TypeAlias(TsTypeAlias {
                    name: ts_type_name(&type_def.name),
                    type_expr: string_literal_union(&type_def.enum_values),
                })),
                TypeKind::Union => declarations.push(TsDeclaration::TypeAlias(TsTypeAlias {
                    name: ts_type_name(&type_def.name),
                    type_expr: type_reference_union(&type_def.union_members),
                })),
            }
        }

        Self { declarations }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TsDeclaration {
    Interface(TsInterface),
    TypeAlias(TsTypeAlias),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TsInterface {
    name: String,
    extends: Vec<String>,
    properties: Vec<TsProperty>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TsTypeAlias {
    name: String,
    type_expr: TsTypeExpr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TsProperty {
    name: String,
    optional: bool,
    type_expr: TsTypeExpr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TsTypeExpr {
    String,
    Number,
    Boolean,
    Unknown,
    Never,
    Null,
    Reference(String),
    StringLiteral(String),
    Array(Box<TsTypeExpr>),
    Union(Vec<TsTypeExpr>),
}

impl TsTypeExpr {
    fn union(types: Vec<Self>) -> Self {
        let mut unique = Vec::new();

        for type_expr in types {
            if !unique.contains(&type_expr) {
                unique.push(type_expr);
            }
        }

        match unique.len() {
            0 => Self::Never,
            1 => unique.into_iter().next().expect("union has one item"),
            _ => Self::Union(unique),
        }
    }
}

fn interface_from_type(type_def: &TypeDefinition) -> TsInterface {
    let is_input = type_def.kind == TypeKind::InputObject;

    TsInterface {
        name: ts_type_name(&type_def.name),
        extends: if is_input {
            Vec::new()
        } else {
            type_def
                .implements
                .iter()
                .map(|interface| ts_type_name(interface))
                .collect()
        },
        properties: type_def
            .fields
            .iter()
            .map(|field| property_from_field(field, is_input))
            .collect(),
    }
}

fn property_from_field(field: &Field, is_input: bool) -> TsProperty {
    TsProperty {
        name: field.name.clone(),
        optional: is_input && field.r#type.nullable,
        type_expr: type_expr_from_reference(&field.r#type),
    }
}

fn type_expr_from_reference(type_ref: &TypeReference) -> TsTypeExpr {
    let base = match type_ref.base.as_str() {
        "ID" | "String" => TsTypeExpr::String,
        "Int" | "Float" => TsTypeExpr::Number,
        "Boolean" => TsTypeExpr::Boolean,
        name => TsTypeExpr::Reference(ts_type_name(name)),
    };

    let mut type_expr = if type_ref.is_list {
        let item = match type_ref.list_item_nullable {
            Some(true) | None => TsTypeExpr::union(vec![base, TsTypeExpr::Null]),
            Some(false) => base,
        };
        TsTypeExpr::Array(Box::new(item))
    } else {
        base
    };

    if type_ref.nullable {
        type_expr = TsTypeExpr::union(vec![type_expr, TsTypeExpr::Null]);
    }

    type_expr
}

fn string_literal_union(values: &[String]) -> TsTypeExpr {
    TsTypeExpr::union(
        values
            .iter()
            .map(|value| TsTypeExpr::StringLiteral(value.clone()))
            .collect(),
    )
}

fn type_reference_union(values: &[String]) -> TsTypeExpr {
    TsTypeExpr::union(
        values
            .iter()
            .map(|value| TsTypeExpr::Reference(ts_type_name(value)))
            .collect(),
    )
}

fn is_builtin_scalar(name: &str) -> bool {
    matches!(name, "ID" | "String" | "Int" | "Float" | "Boolean")
}

fn print_program(program: &TsProgram) -> String {
    let mut out = String::from("/* @generated by Wesley. Do not edit. */\n");

    for declaration in &program.declarations {
        out.push('\n');
        print_declaration(&mut out, declaration);
    }

    out
}

fn print_declaration(out: &mut String, declaration: &TsDeclaration) {
    match declaration {
        TsDeclaration::Interface(interface) => print_interface(out, interface),
        TsDeclaration::TypeAlias(type_alias) => print_type_alias(out, type_alias),
    }
}

fn print_interface(out: &mut String, interface: &TsInterface) {
    let extends = if interface.extends.is_empty() {
        String::new()
    } else {
        format!(" extends {}", interface.extends.join(", "))
    };

    writeln!(out, "export interface {}{} {{", interface.name, extends)
        .expect("writing to string should not fail");

    for property in &interface.properties {
        write!(out, "  {}", property_name(&property.name))
            .expect("writing to string should not fail");
        if property.optional {
            out.push('?');
        }
        out.push_str(": ");
        print_type_expr(out, &property.type_expr, false);
        out.push_str(";\n");
    }

    out.push_str("}\n");
}

fn print_type_alias(out: &mut String, type_alias: &TsTypeAlias) {
    write!(out, "export type {} = ", type_alias.name).expect("writing to string should not fail");
    print_type_expr(out, &type_alias.type_expr, false);
    out.push_str(";\n");
}

fn print_type_expr(out: &mut String, type_expr: &TsTypeExpr, parenthesize_union: bool) {
    match type_expr {
        TsTypeExpr::String => out.push_str("string"),
        TsTypeExpr::Number => out.push_str("number"),
        TsTypeExpr::Boolean => out.push_str("boolean"),
        TsTypeExpr::Unknown => out.push_str("unknown"),
        TsTypeExpr::Never => out.push_str("never"),
        TsTypeExpr::Null => out.push_str("null"),
        TsTypeExpr::Reference(name) => out.push_str(name),
        TsTypeExpr::StringLiteral(value) => print_string_literal(out, value),
        TsTypeExpr::Array(item) => {
            print_type_expr(out, item, true);
            out.push_str("[]");
        }
        TsTypeExpr::Union(types) => {
            if parenthesize_union {
                out.push('(');
            }
            for (index, nested) in types.iter().enumerate() {
                if index > 0 {
                    out.push_str(" | ");
                }
                print_type_expr(out, nested, false);
            }
            if parenthesize_union {
                out.push(')');
            }
        }
    }
}

fn print_string_literal(out: &mut String, value: &str) {
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

fn property_name(name: &str) -> String {
    if is_identifier_name(name) {
        name.to_string()
    } else {
        let mut out = String::new();
        print_string_literal(&mut out, name);
        out
    }
}

fn ts_type_name(name: &str) -> String {
    if is_identifier_name(name) && !is_reserved_type_name(name) {
        return name.to_string();
    }

    let mut sanitized = String::from("_");
    for (index, ch) in name.chars().enumerate() {
        if (index == 0 && is_identifier_start(ch)) || (index > 0 && is_identifier_continue(ch)) {
            sanitized.push(ch);
        } else {
            sanitized.push('_');
        }
    }

    sanitized
}

fn is_identifier_name(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };

    is_identifier_start(first) && chars.all(is_identifier_continue)
}

fn is_identifier_start(ch: char) -> bool {
    ch == '_' || ch == '$' || ch.is_ascii_alphabetic()
}

fn is_identifier_continue(ch: char) -> bool {
    is_identifier_start(ch) || ch.is_ascii_digit()
}

fn is_reserved_type_name(name: &str) -> bool {
    matches!(
        name,
        "any"
            | "as"
            | "boolean"
            | "break"
            | "case"
            | "catch"
            | "class"
            | "const"
            | "continue"
            | "debugger"
            | "declare"
            | "default"
            | "delete"
            | "do"
            | "else"
            | "enum"
            | "export"
            | "extends"
            | "false"
            | "finally"
            | "for"
            | "from"
            | "function"
            | "if"
            | "implements"
            | "import"
            | "in"
            | "infer"
            | "instanceof"
            | "interface"
            | "keyof"
            | "let"
            | "module"
            | "namespace"
            | "never"
            | "new"
            | "null"
            | "number"
            | "object"
            | "package"
            | "private"
            | "protected"
            | "public"
            | "readonly"
            | "require"
            | "return"
            | "satisfies"
            | "static"
            | "string"
            | "super"
            | "switch"
            | "symbol"
            | "this"
            | "throw"
            | "true"
            | "try"
            | "type"
            | "typeof"
            | "undefined"
            | "unique"
            | "unknown"
            | "var"
            | "void"
            | "while"
            | "with"
            | "yield"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use wesley_core::lower_schema_sdl;

    #[test]
    fn emits_typescript_declarations_from_l1_ir() {
        let ir = lower_schema_sdl(
            r#"
            scalar DateTime

            interface Node {
              id: ID!
            }

            type User implements Node {
              id: ID!
              name: String
              createdAt: DateTime!
              tags: [String]
            }

            union SearchResult = User

            enum Role {
              ADMIN
              MEMBER
            }

            input UserFilter {
              ids: [ID!]!
              role: Role
              active: Boolean
            }
            "#,
        )
        .expect("schema should lower");

        let actual = emit_typescript(&ir);

        assert_eq!(
            actual,
            r#"/* @generated by Wesley. Do not edit. */

export type DateTime = unknown;

export interface Node {
  id: string;
}

export type Role = "ADMIN" | "MEMBER";

export type SearchResult = User;

export interface User extends Node {
  id: string;
  name: string | null;
  createdAt: DateTime;
  tags: (string | null)[] | null;
}

export interface UserFilter {
  ids: string[];
  role?: Role | null;
  active?: boolean | null;
}
"#
        );
    }

    #[test]
    fn quotes_non_identifier_property_names_in_the_ast_printer() {
        assert_eq!(property_name("normalName"), "normalName");
        assert_eq!(property_name("not-normal"), "\"not-normal\"");
    }

    #[test]
    fn emits_jedit_shaped_hot_text_fixture() {
        let ir = lower_schema_sdl(include_str!(
            "../../../test/fixtures/consumer-models/jedit-hot-text-core.graphql"
        ))
        .expect("jedit-shaped fixture should lower");

        let actual = emit_typescript(&ir);

        assert!(actual.contains("export interface BufferWorldline {"));
        assert!(actual.contains("export type AnchorKind = "));
        assert!(actual.contains("checkpoints: Checkpoint[];"));
        assert!(actual.contains("createdAtTickId: string | null;"));
        assert!(actual.contains("createInitialCheckpoint?: boolean | null;"));
    }
}
