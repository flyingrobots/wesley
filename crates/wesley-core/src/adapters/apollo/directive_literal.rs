//! Checks a constant GraphQL literal against a declared input type, following
//! the specification's "Values of Correct Type" rule and input coercion.

use crate::domain::ir::{TypeDefinition, TypeKind, TypeReference};
use apollo_parser::cst;
use std::collections::{BTreeMap, BTreeSet};

/// Schema types by name, as lowered into the IR.
pub(super) type TypeIndex<'a> = BTreeMap<&'a str, &'a TypeDefinition>;

/// A GraphQL input type, with its wrappers made explicit.
pub(super) enum InputType<'a> {
    /// A non-null wrapper.
    NonNull(Box<InputType<'a>>),
    /// A list wrapper.
    List(Box<InputType<'a>>),
    /// A named type.
    Named(&'a str),
}

impl<'a> InputType<'a> {
    /// Rebuilds the wrapper structure recorded in an IR type reference.
    pub(super) fn from_reference(reference: &'a TypeReference) -> Self {
        let (wrappers, leaf_nullable): (Vec<bool>, bool) = if !reference.list_wrappers.is_empty() {
            let wrappers = reference
                .list_wrappers
                .iter()
                .map(|wrapper| wrapper.nullable);
            (wrappers.collect(), reference.leaf_nullable.unwrap_or(true))
        } else if reference.is_list {
            let item_nullable = reference.list_item_nullable.unwrap_or(true);
            (vec![reference.nullable], item_nullable)
        } else {
            (Vec::new(), reference.nullable)
        };

        let mut input_type = wrap_non_null(Self::Named(&reference.base), leaf_nullable);
        for nullable in wrappers.into_iter().rev() {
            input_type = wrap_non_null(Self::List(Box::new(input_type)), nullable);
        }
        input_type
    }

    /// Renders the type in GraphQL syntax, such as `[String!]!`.
    pub(super) fn render(&self) -> String {
        match self {
            Self::NonNull(inner) => format!("{}!", inner.render()),
            Self::List(inner) => format!("[{}]", inner.render()),
            Self::Named(name) => (*name).to_string(),
        }
    }
}

fn wrap_non_null(input_type: InputType<'_>, nullable: bool) -> InputType<'_> {
    if nullable {
        input_type
    } else {
        InputType::NonNull(Box::new(input_type))
    }
}

/// Why a literal does not fit its declared type.
#[derive(Debug)]
pub(super) enum LiteralFault {
    /// The literal is of the wrong kind; `received` describes it.
    Mismatch {
        expected: String,
        received: &'static str,
    },
    /// An enum literal names a value the enum does not declare.
    UnknownEnumValue { value: String, enum_name: String },
    /// An input object literal omits a non-null field that has no default.
    MissingInputField { field: String, field_type: String },
    /// An input object literal names a field the input type does not declare.
    UndeclaredInputField { field: String },
    /// An input object literal supplies the same field twice.
    RepeatedInputField { field: String },
    /// The declared type is not defined in the schema.
    UnknownType { name: String },
    /// The literal is missing a part the parser should have supplied.
    Malformed { detail: &'static str },
}

impl LiteralFault {
    /// Describes the fault as the tail of a sentence about the argument.
    pub(super) fn describe(&self) -> String {
        match self {
            Self::Mismatch { expected, received } => {
                format!("expects '{expected}' but received {received}")
            }
            Self::UnknownEnumValue { value, enum_name } => {
                format!("received unknown enum value '{value}' for '{enum_name}'")
            }
            Self::MissingInputField { field, field_type } => {
                format!("is missing required input field '{field}' of type '{field_type}'")
            }
            Self::UndeclaredInputField { field } => format!("has undeclared input field '{field}'"),
            Self::RepeatedInputField { field } => format!("repeats input field '{field}'"),
            Self::UnknownType { name } => format!("has unknown type '{name}'"),
            Self::Malformed { detail } => format!("is malformed: {detail}"),
        }
    }
}

/// Checks `value` against `expected`.
///
/// # Errors
///
/// Returns the first [`LiteralFault`] found, in source order.
pub(super) fn check_literal(
    value: cst::Value,
    expected: &InputType<'_>,
    types: &TypeIndex<'_>,
) -> Result<(), LiteralFault> {
    match (expected, value) {
        (InputType::NonNull(_), cst::Value::NullValue(_)) => Err(mismatch(expected, "null")),
        (_, cst::Value::NullValue(_)) => Ok(()),
        (InputType::NonNull(inner), value) => check_present(value, inner, expected, types),
        (other, value) => check_present(value, other, expected, types),
    }
}

fn check_present(
    value: cst::Value,
    input_type: &InputType<'_>,
    shown: &InputType<'_>,
    types: &TypeIndex<'_>,
) -> Result<(), LiteralFault> {
    match input_type {
        InputType::NonNull(inner) => check_present(value, inner, shown, types),
        InputType::List(item) => match value {
            cst::Value::ListValue(list) => list
                .values()
                .try_for_each(|item_value| check_literal(item_value, item, types)),
            // Input coercion: a single value is accepted as a list of one.
            single => check_literal(single, item, types),
        },
        InputType::Named(name) => check_named(value, name, shown, types),
    }
}

fn check_named(
    value: cst::Value,
    name: &str,
    shown: &InputType<'_>,
    types: &TypeIndex<'_>,
) -> Result<(), LiteralFault> {
    if !matches!(name, "Int" | "Float" | "String" | "Boolean" | "ID") {
        return check_schema_type(value, name, shown, types);
    }
    let fits = match (name, &value) {
        ("Int", cst::Value::IntValue(int)) => return check_int_range(int, shown),
        ("Float", cst::Value::IntValue(_) | cst::Value::FloatValue(_))
        | ("String", cst::Value::StringValue(_))
        | ("Boolean", cst::Value::BooleanValue(_))
        | ("ID", cst::Value::StringValue(_) | cst::Value::IntValue(_)) => true,
        _ => false,
    };

    if fits {
        Ok(())
    } else {
        Err(mismatch(shown, value_kind(&value)))
    }
}

fn check_int_range(int: &cst::IntValue, shown: &InputType<'_>) -> Result<(), LiteralFault> {
    let text = int.int_token().map(|token| token.text().to_string());
    match text.map(|text| text.parse::<i32>()) {
        Some(Ok(_)) => Ok(()),
        Some(Err(_)) => Err(mismatch(shown, "an integer outside the 32-bit range")),
        None => Err(LiteralFault::Malformed {
            detail: "integer literal has no digits",
        }),
    }
}

fn check_schema_type(
    value: cst::Value,
    name: &str,
    shown: &InputType<'_>,
    types: &TypeIndex<'_>,
) -> Result<(), LiteralFault> {
    let Some(definition) = types.get(name) else {
        return Err(LiteralFault::UnknownType {
            name: name.to_string(),
        });
    };

    match (definition.kind, value) {
        // A custom scalar's literal form is defined by whoever implements it,
        // so any constant literal is accepted, as graphql-js does. Variables
        // never reach here: lowering rejects them in directive arguments.
        (TypeKind::Scalar, _) => Ok(()),
        (TypeKind::Enum, cst::Value::EnumValue(enum_value)) => {
            check_enum_value(&enum_value, definition)
        }
        (TypeKind::InputObject, cst::Value::ObjectValue(object)) => {
            check_input_object(&object, definition, types)
        }
        (_, other) => Err(mismatch(shown, value_kind(&other))),
    }
}

fn check_enum_value(
    enum_value: &cst::EnumValue,
    definition: &TypeDefinition,
) -> Result<(), LiteralFault> {
    let value = enum_value
        .name()
        .map(|name| name.text().to_string())
        .ok_or(LiteralFault::Malformed {
            detail: "enum literal has no name",
        })?;
    if definition.enum_values.contains(&value) {
        Ok(())
    } else {
        Err(LiteralFault::UnknownEnumValue {
            value,
            enum_name: definition.name.clone(),
        })
    }
}

fn check_input_object(
    object: &cst::ObjectValue,
    definition: &TypeDefinition,
    types: &TypeIndex<'_>,
) -> Result<(), LiteralFault> {
    let mut supplied = BTreeSet::new();
    for object_field in object.object_fields() {
        let field = object_field
            .name()
            .map(|name| name.text().to_string())
            .ok_or(LiteralFault::Malformed {
                detail: "input object field has no name",
            })?;
        let Some(declared) = definition.fields.iter().find(|item| item.name == field) else {
            return Err(LiteralFault::UndeclaredInputField { field });
        };
        if !supplied.insert(field.clone()) {
            return Err(LiteralFault::RepeatedInputField { field });
        }
        let field_value = object_field.value().ok_or(LiteralFault::Malformed {
            detail: "input object field has no value",
        })?;
        check_literal(
            field_value,
            &InputType::from_reference(&declared.r#type),
            types,
        )?;
    }

    let missing = definition.fields.iter().find(|field| {
        !field.r#type.nullable && field.default_value.is_none() && !supplied.contains(&field.name)
    });
    match missing {
        Some(field) => Err(LiteralFault::MissingInputField {
            field: field.name.clone(),
            field_type: InputType::from_reference(&field.r#type).render(),
        }),
        None => Ok(()),
    }
}

fn mismatch(expected: &InputType<'_>, received: &'static str) -> LiteralFault {
    LiteralFault::Mismatch {
        expected: expected.render(),
        received,
    }
}

const fn value_kind(value: &cst::Value) -> &'static str {
    match value {
        cst::Value::StringValue(_) => "a String value",
        cst::Value::FloatValue(_) => "a Float value",
        cst::Value::IntValue(_) => "an Int value",
        cst::Value::BooleanValue(_) => "a Boolean value",
        cst::Value::NullValue(_) => "null",
        cst::Value::EnumValue(_) => "an enum value",
        cst::Value::ListValue(_) => "a list value",
        cst::Value::ObjectValue(_) => "an object value",
        cst::Value::Variable(_) => "a variable",
    }
}
