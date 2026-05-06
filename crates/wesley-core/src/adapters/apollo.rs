//! Apollo Parser implementation of the LoweringPort.

use crate::domain::error::WesleyError;
use crate::domain::footprint::FootprintSpec;
use crate::domain::ir::*;
use crate::ports::lowering::LoweringPort;
use apollo_parser::{cst, cst::CstNode, Parser};
use async_trait::async_trait;
use indexmap::IndexMap;
use std::collections::BTreeMap;

/// Adapter that uses `apollo-parser` to lower SDL to IR.
pub struct ApolloLoweringAdapter {
    _max_retries: usize,
}

impl ApolloLoweringAdapter {
    /// Creates a new adapter.
    pub fn new(max_retries: usize) -> Self {
        Self {
            _max_retries: max_retries,
        }
    }
}

#[async_trait]
impl LoweringPort for ApolloLoweringAdapter {
    async fn lower_sdl(&self, sdl: &str) -> Result<WesleyIR, WesleyError> {
        self.parse_and_lower(sdl)
    }
}

/// Represents the consolidated parts of a single GraphQL Type.
struct TypeAggregate {
    name: String,
    kind: TypeKind,
    definitions: Vec<cst::ObjectTypeDefinition>,
    extensions: Vec<cst::ObjectTypeExtension>,
}

impl ApolloLoweringAdapter {
    fn parse_and_lower(&self, sdl: &str) -> Result<WesleyIR, WesleyError> {
        let parser = Parser::new(sdl);
        let cst = parser.parse();

        let errors = cst.errors().collect::<Vec<_>>();
        if !errors.is_empty() {
            let err = &errors[0];
            return Err(WesleyError::ParseError {
                message: err.message().to_string(),
                line: None,
                column: None,
            });
        }

        let doc = cst.document();
        let mut aggregates: BTreeMap<String, TypeAggregate> = BTreeMap::new();

        for def in doc.definitions() {
            match def {
                cst::Definition::ObjectTypeDefinition(obj) => {
                    if let Some(name) = obj.name() {
                        let name_str = name.text().to_string();
                        let agg = aggregates.entry(name_str.clone()).or_insert(TypeAggregate {
                            name: name_str,
                            kind: TypeKind::Object,
                            definitions: Vec::new(),
                            extensions: Vec::new(),
                        });
                        agg.definitions.push(obj);
                    }
                }
                cst::Definition::ObjectTypeExtension(ext) => {
                    if let Some(name) = ext.name() {
                        let name_str = name.text().to_string();
                        let agg = aggregates.entry(name_str.clone()).or_insert(TypeAggregate {
                            name: name_str,
                            kind: TypeKind::Object,
                            definitions: Vec::new(),
                            extensions: Vec::new(),
                        });
                        agg.extensions.push(ext);
                    }
                }
                _ => {}
            }
        }

        let mut types = Vec::new();
        for agg in aggregates.values() {
            types.push(self.build_type_from_aggregate(agg)?);
        }

        Ok(WesleyIR {
            version: "1.0.0".to_string(),
            metadata: None,
            types,
        })
    }

    fn build_type_from_aggregate(
        &self,
        agg: &TypeAggregate,
    ) -> Result<TypeDefinition, WesleyError> {
        let mut directives = IndexMap::new();
        let mut fields = Vec::new();

        for obj in &agg.definitions {
            if let Some(dirs) = obj.directives() {
                self.extract_directives(dirs, &mut directives)?;
            }
            if let Some(fields_def) = obj.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        for ext in &agg.extensions {
            if let Some(dirs) = ext.directives() {
                self.extract_directives(dirs, &mut directives)?;
            }
            if let Some(fields_def) = ext.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        Ok(TypeDefinition {
            name: agg.name.clone(),
            kind: agg.kind,
            description: None,
            directives,
            fields,
            enum_values: Vec::new(),
        })
    }

    fn extract_directives(
        &self,
        dirs: cst::Directives,
        map: &mut IndexMap<String, serde_json::Value>,
    ) -> Result<(), WesleyError> {
        for dir in dirs.directives() {
            let dir_name = dir
                .name()
                .ok_or(WesleyError::LoweringError {
                    message: "Directive missing name".to_string(),
                    area: "directive".to_string(),
                })?
                .text()
                .to_string();

            let mut args_map = serde_json::Map::new();
            if let Some(args) = dir.arguments() {
                for arg in args.arguments() {
                    let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                    if let Some(val) = arg.value() {
                        let val_str = val.syntax().text().to_string().replace("\"", "");
                        args_map.insert(arg_name, serde_json::Value::String(val_str));
                    }
                }
            }

            let val = if args_map.is_empty() {
                serde_json::Value::Bool(true)
            } else {
                serde_json::Value::Object(args_map)
            };

            map.insert(dir_name, val);
        }
        Ok(())
    }

    fn build_field(&self, field_def: cst::FieldDefinition) -> Result<Field, WesleyError> {
        let name = field_def
            .name()
            .ok_or(WesleyError::LoweringError {
                message: "Field missing name".to_string(),
                area: "field".to_string(),
            })?
            .text()
            .to_string();

        let type_node = field_def.ty().ok_or(WesleyError::LoweringError {
            message: "Field missing type".to_string(),
            area: "field".to_string(),
        })?;

        let mut base = String::new();
        let mut is_list = false;
        let mut nullable = true;

        match type_node {
            cst::Type::NamedType(nt) => {
                base = nt.name().map(|n| n.text().to_string()).unwrap_or_default();
            }
            cst::Type::NonNullType(nnt) => {
                nullable = false;
                if let Some(nt) = nnt.named_type() {
                    base = nt.name().map(|n| n.text().to_string()).unwrap_or_default();
                } else if let Some(lt) = nnt.list_type() {
                    is_list = true;
                    if let Some(item_type) = lt.ty() {
                        base = item_type
                            .syntax()
                            .text()
                            .to_string()
                            .replace("!", "")
                            .replace("[", "")
                            .replace("]", "");
                    }
                }
            }
            cst::Type::ListType(lt) => {
                is_list = true;
                if let Some(item_type) = lt.ty() {
                    base = item_type
                        .syntax()
                        .text()
                        .to_string()
                        .replace("!", "")
                        .replace("[", "")
                        .replace("]", "");
                }
            }
        }

        let mut field_directives = IndexMap::new();
        if let Some(dirs) = field_def.directives() {
            self.extract_directives(dirs, &mut field_directives)?;
        }

        Ok(Field {
            name,
            r#type: TypeReference {
                base,
                nullable,
                is_list,
                list_item_nullable: None,
            },
            directives: field_directives,
            description: None,
        })
    }
}

/// Extracts declared and observed footprint data from a single GraphQL operation.
pub fn extract_footprint(operation_sdl: &str) -> Result<FootprintSpec, WesleyError> {
    let parser = Parser::new(operation_sdl);
    let cst = parser.parse();

    let errors = cst.errors().collect::<Vec<_>>();
    if !errors.is_empty() {
        let err = &errors[0];
        return Err(WesleyError::ParseError {
            message: err.message().to_string(),
            line: None,
            column: None,
        });
    }

    let doc = cst.document();
    let mut operations = Vec::new();
    let mut fragments = BTreeMap::new();

    for def in doc.definitions() {
        match def {
            cst::Definition::OperationDefinition(op) => {
                operations.push(op);
            }
            cst::Definition::FragmentDefinition(fragment) => {
                let name = fragment_name(&fragment)?;
                if fragments.insert(name.clone(), fragment).is_some() {
                    return footprint_error(format!("Duplicate fragment definition '{name}'"));
                }
            }
            _ => {}
        }
    }

    match operations.len() {
        0 => footprint_error("No GraphQL operation found".to_string()),
        1 => extract_footprint_from_operation(&operations[0], &fragments),
        count => footprint_error(format!(
            "Expected exactly one GraphQL operation, found {count}"
        )),
    }
}

fn extract_footprint_from_operation(
    op: &cst::OperationDefinition,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
) -> Result<FootprintSpec, WesleyError> {
    let (declared_reads, declared_writes) = extract_declared_footprint(op)?;
    let mut actual_selections = Vec::new();

    if let Some(selection_set) = op.selection_set() {
        collect_selection_paths(
            &selection_set,
            "",
            fragments,
            &mut Vec::new(),
            &mut actual_selections,
        )?;
    }

    Ok(FootprintSpec {
        declared_reads,
        declared_writes,
        actual_selections,
    })
}

fn extract_declared_footprint(
    op: &cst::OperationDefinition,
) -> Result<(Vec<String>, Vec<String>), WesleyError> {
    let mut declared_reads = Vec::new();
    let mut declared_writes = Vec::new();

    let Some(dirs) = op.directives() else {
        return Ok((declared_reads, declared_writes));
    };

    for dir in dirs.directives() {
        let dir_name = required_name(dir.name(), "Directive missing name")?;
        if dir_name != "wes_footprint" {
            continue;
        }

        let Some(args) = dir.arguments() else {
            continue;
        };

        for arg in args.arguments() {
            let arg_name = required_name(arg.name(), "Directive argument missing name")?;
            match arg_name.as_str() {
                "reads" => declared_reads.extend(extract_string_list_arg(&arg_name, arg.value())?),
                "writes" => {
                    declared_writes.extend(extract_string_list_arg(&arg_name, arg.value())?)
                }
                _ => {}
            }
        }
    }

    Ok((declared_reads, declared_writes))
}

fn extract_string_list_arg(
    arg_name: &str,
    value: Option<cst::Value>,
) -> Result<Vec<String>, WesleyError> {
    let value = value.ok_or_else(|| {
        footprint_error_value(format!(
            "@wes_footprint argument '{arg_name}' is missing a value"
        ))
    })?;

    let cst::Value::ListValue(list) = value else {
        return footprint_error(format!(
            "@wes_footprint argument '{arg_name}' must be a list of strings"
        ));
    };

    let mut values = Vec::new();
    for value in list.values() {
        let cst::Value::StringValue(string_value) = value else {
            return footprint_error(format!(
                "@wes_footprint argument '{arg_name}' must be a list of strings"
            ));
        };
        values.push(parse_string_value(string_value)?);
    }

    Ok(values)
}

fn collect_selection_paths(
    selection_set: &cst::SelectionSet,
    prefix: &str,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
    actual_selections: &mut Vec<String>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                let field_name = required_name(field.name(), "Field selection missing name")?;
                let path = if prefix.is_empty() {
                    field_name
                } else {
                    format!("{prefix}.{field_name}")
                };

                push_unique(actual_selections, path.clone());

                if let Some(nested_selection_set) = field.selection_set() {
                    collect_selection_paths(
                        &nested_selection_set,
                        &path,
                        fragments,
                        active_fragments,
                        actual_selections,
                    )?;
                }
            }
            cst::Selection::FragmentSpread(spread) => {
                let name = spread
                    .fragment_name()
                    .and_then(|fragment_name| fragment_name.name())
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        footprint_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return footprint_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = fragments.get(&name).ok_or_else(|| {
                    footprint_error_value(format!("Unknown fragment spread '{name}'"))
                })?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    collect_selection_paths(
                        &fragment_selection_set,
                        prefix,
                        fragments,
                        active_fragments,
                        actual_selections,
                    )?;
                }
                active_fragments.pop();
            }
            cst::Selection::InlineFragment(fragment) => {
                if let Some(inline_selection_set) = fragment.selection_set() {
                    collect_selection_paths(
                        &inline_selection_set,
                        prefix,
                        fragments,
                        active_fragments,
                        actual_selections,
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn push_unique(values: &mut Vec<String>, value: String) {
    if !values.contains(&value) {
        values.push(value);
    }
}

fn fragment_name(fragment: &cst::FragmentDefinition) -> Result<String, WesleyError> {
    fragment
        .fragment_name()
        .and_then(|fragment_name| fragment_name.name())
        .map(|name| name.text().to_string())
        .ok_or_else(|| footprint_error_value("Fragment definition missing name".to_string()))
}

fn required_name(name: Option<cst::Name>, message: &str) -> Result<String, WesleyError> {
    name.map(|name| name.text().to_string())
        .ok_or_else(|| footprint_error_value(message.to_string()))
}

fn parse_string_value(value: cst::StringValue) -> Result<String, WesleyError> {
    let raw = value.syntax().text().to_string();
    if let Some(block_string) = raw
        .strip_prefix("\"\"\"")
        .and_then(|s| s.strip_suffix("\"\"\""))
    {
        return Ok(block_string.to_string());
    }

    serde_json::from_str::<String>(&raw).map_err(|err| {
        footprint_error_value(format!("Invalid string literal in @wes_footprint: {err}"))
    })
}

fn footprint_error<T>(message: String) -> Result<T, WesleyError> {
    Err(footprint_error_value(message))
}

fn footprint_error_value(message: String) -> WesleyError {
    WesleyError::LoweringError {
        message,
        area: "footprint".to_string(),
    }
}
