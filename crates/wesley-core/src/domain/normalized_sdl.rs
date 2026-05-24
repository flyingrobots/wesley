use crate::domain::ir::{Field, FieldArgument, TypeDefinition, TypeKind, TypeReference, WesleyIR};
use indexmap::IndexMap;

pub(crate) fn render_normalized_sdl(ir: &WesleyIR) -> String {
    let mut types = ir.types.iter().collect::<Vec<_>>();
    types.sort_by(|left, right| left.name.cmp(&right.name));

    types
        .into_iter()
        .map(render_type_definition)
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn render_type_definition(definition: &TypeDefinition) -> String {
    let mut lines = Vec::new();
    push_description(&mut lines, "", definition.description.as_deref());

    match definition.kind {
        TypeKind::Scalar => {
            lines.push(format!(
                "scalar {}{}",
                definition.name,
                render_directives(&definition.directives)
            ));
        }
        TypeKind::Enum => {
            lines.push(format!(
                "enum {}{} {{",
                definition.name,
                render_directives(&definition.directives)
            ));
            let mut values = definition.enum_values.clone();
            values.sort();
            for value in values {
                lines.push(format!("  {value}"));
            }
            lines.push("}".to_string());
        }
        TypeKind::Union => {
            let mut members = definition.union_members.clone();
            members.sort();
            let member_text = if members.is_empty() {
                String::new()
            } else {
                format!(" = {}", members.join(" | "))
            };
            lines.push(format!(
                "union {}{}{}",
                definition.name,
                render_directives(&definition.directives),
                member_text
            ));
        }
        TypeKind::Object | TypeKind::Interface | TypeKind::InputObject => {
            let keyword = match definition.kind {
                TypeKind::Object => "type",
                TypeKind::Interface => "interface",
                TypeKind::InputObject => "input",
                TypeKind::Enum | TypeKind::Scalar | TypeKind::Union => unreachable!(),
            };
            let implements = render_implements(&definition.implements);
            lines.push(format!(
                "{keyword} {}{}{} {{",
                definition.name,
                implements,
                render_directives(&definition.directives)
            ));
            let mut fields = definition.fields.iter().collect::<Vec<_>>();
            fields.sort_by(|left, right| left.name.cmp(&right.name));
            for field in fields {
                push_description(&mut lines, "  ", field.description.as_deref());
                lines.push(render_field(
                    field,
                    definition.kind == TypeKind::InputObject,
                ));
            }
            lines.push("}".to_string());
        }
    }

    lines.join("\n")
}

fn render_implements(implements: &[String]) -> String {
    if implements.is_empty() {
        return String::new();
    }

    let mut sorted = implements.to_vec();
    sorted.sort();
    format!(" implements {}", sorted.join(" & "))
}

fn render_field(field: &Field, input_field: bool) -> String {
    let arguments = if input_field {
        String::new()
    } else {
        render_arguments(&field.arguments)
    };
    let default_value = field
        .default_value
        .as_ref()
        .map(|value| format!(" = {}", render_graphql_value(value)))
        .unwrap_or_default();

    format!(
        "  {}{}: {}{}{}",
        field.name,
        arguments,
        render_type_reference(&field.r#type),
        default_value,
        render_directives(&field.directives)
    )
}

fn render_arguments(arguments: &[FieldArgument]) -> String {
    if arguments.is_empty() {
        return String::new();
    }

    let mut sorted = arguments.iter().collect::<Vec<_>>();
    sorted.sort_by(|left, right| left.name.cmp(&right.name));
    let rendered = sorted
        .into_iter()
        .map(|argument| {
            let default_value = argument
                .default_value
                .as_ref()
                .map(|value| format!(" = {}", render_graphql_value(value)))
                .unwrap_or_default();
            format!(
                "{}: {}{}{}",
                argument.name,
                render_type_reference(&argument.r#type),
                default_value,
                render_directives(&argument.directives)
            )
        })
        .collect::<Vec<_>>()
        .join(", ");

    format!("({rendered})")
}

fn render_type_reference(type_reference: &TypeReference) -> String {
    if type_reference.list_wrappers.is_empty() {
        if type_reference.is_list {
            let inner = format!(
                "{}{}",
                type_reference.base,
                bang_if_false(type_reference.list_item_nullable.unwrap_or(true))
            );
            return format!("[{inner}]{}", bang_if_false(type_reference.nullable));
        }

        return format!(
            "{}{}",
            type_reference.base,
            bang_if_false(type_reference.nullable)
        );
    }

    let mut rendered = format!(
        "{}{}",
        type_reference.base,
        bang_if_false(type_reference.leaf_nullable.unwrap_or(true))
    );
    for wrapper in type_reference.list_wrappers.iter().rev() {
        rendered = format!("[{rendered}]{}", bang_if_false(wrapper.nullable));
    }

    rendered
}

fn render_directives(directives: &IndexMap<String, serde_json::Value>) -> String {
    if directives.is_empty() {
        return String::new();
    }

    let mut rendered = Vec::new();
    for name in sorted_directive_names(directives) {
        let value = directives
            .get(name)
            .expect("sorted directive name should exist in directives");
        match value {
            serde_json::Value::Array(values) => {
                for value in values {
                    rendered.push(render_directive(name, value));
                }
            }
            value => rendered.push(render_directive(name, value)),
        }
    }

    format!(" {}", rendered.join(" "))
}

fn render_directive(name: &str, value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Bool(true) => format!("@{name}"),
        serde_json::Value::Object(arguments) if arguments.is_empty() => format!("@{name}"),
        serde_json::Value::Object(arguments) => {
            let mut keys = arguments.keys().collect::<Vec<_>>();
            keys.sort();
            let rendered_arguments = keys
                .into_iter()
                .map(|key| {
                    let value = arguments
                        .get(key)
                        .expect("sorted directive argument should exist");
                    format!("{key}: {}", render_graphql_value(value))
                })
                .collect::<Vec<_>>()
                .join(", ");
            format!("@{name}({rendered_arguments})")
        }
        value => format!("@{name}(value: {})", render_graphql_value(value)),
    }
}

fn render_graphql_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(value) => value.to_string(),
        serde_json::Value::Number(value) => value.to_string(),
        serde_json::Value::String(value) => {
            serde_json::to_string(value).expect("string JSON serialization should not fail")
        }
        serde_json::Value::Array(values) => {
            let rendered = values
                .iter()
                .map(render_graphql_value)
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{rendered}]")
        }
        serde_json::Value::Object(fields) => {
            if fields.is_empty() {
                return "{}".to_string();
            }

            let mut keys = fields.keys().collect::<Vec<_>>();
            keys.sort();
            let rendered = keys
                .into_iter()
                .map(|key| {
                    let value = fields.get(key).expect("sorted object field should exist");
                    format!("{key}: {}", render_graphql_value(value))
                })
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{ {rendered} }}")
        }
    }
}

fn sorted_directive_names(directives: &IndexMap<String, serde_json::Value>) -> Vec<&String> {
    let mut names = directives.keys().collect::<Vec<_>>();
    names.sort();
    names
}

fn push_description(lines: &mut Vec<String>, indent: &str, description: Option<&str>) {
    if let Some(description) = description {
        let escaped = description.replace("\"\"\"", "\\\"\\\"\\\"");
        lines.push(format!("{indent}\"\"\"{escaped}\"\"\""));
    }
}

fn bang_if_false(nullable: bool) -> &'static str {
    if nullable {
        ""
    } else {
        "!"
    }
}
