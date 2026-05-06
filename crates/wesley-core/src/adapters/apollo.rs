//! Apollo Parser implementation of the LoweringPort.

use crate::domain::error::WesleyError;
use crate::domain::footprint::{FootprintCheck, FootprintSpec};
use crate::domain::ir::*;
use crate::ports::lowering::LoweringPort;
use apollo_parser::{cst, cst::CstNode, Parser};
use async_trait::async_trait;
use indexmap::IndexMap;
use std::collections::{BTreeMap, HashMap};

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

/// Checks whether an operation's declared footprint covers its selection paths.
pub fn check_footprint(operation_sdl: &str) -> Result<FootprintCheck, WesleyError> {
    let spec = extract_footprint(operation_sdl)?;
    check_spec(spec)
}

/// Checks whether an operation's declared footprint covers schema coordinates.
pub fn check_footprint_with_schema(
    schema_sdl: &str,
    operation_sdl: &str,
) -> Result<FootprintCheck, WesleyError> {
    let adapter = ApolloLoweringAdapter::new(0);
    let ir = adapter.parse_and_lower(schema_sdl)?;
    let root_types = extract_root_types(schema_sdl)?;

    let parsed = parse_operation_document(operation_sdl)?;
    let op = parsed.only_operation()?;
    let (declared_reads, declared_writes) = extract_declared_footprint(op)?;
    let mut actual_selections = Vec::new();

    if let Some(selection_set) = op.selection_set() {
        let root_type = root_types.root_for_operation(op)?;
        let schema = SchemaIndex::new(&ir);
        collect_schema_coordinates(
            &selection_set,
            root_type,
            &schema,
            &parsed.fragments,
            &mut Vec::new(),
            &mut actual_selections,
        )?;
    }

    check_spec(FootprintSpec {
        declared_reads,
        declared_writes,
        actual_selections,
    })
}

fn check_spec(spec: FootprintSpec) -> Result<FootprintCheck, WesleyError> {
    let declared = declared_paths(&spec);

    let undeclared_selections = spec
        .actual_selections
        .iter()
        .filter(|selection| !declared.contains(*selection))
        .cloned()
        .collect::<Vec<_>>();

    let unused_declarations = declared
        .into_iter()
        .filter(|declaration| !spec.actual_selections.contains(declaration))
        .collect::<Vec<_>>();

    Ok(FootprintCheck {
        spec,
        undeclared_selections,
        unused_declarations,
    })
}

fn declared_paths(spec: &FootprintSpec) -> Vec<String> {
    let mut declared = Vec::new();
    for path in spec
        .declared_reads
        .iter()
        .chain(spec.declared_writes.iter())
    {
        push_unique(&mut declared, path.clone());
    }
    declared
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

struct ParsedOperationDocument {
    operations: Vec<cst::OperationDefinition>,
    fragments: BTreeMap<String, cst::FragmentDefinition>,
}

impl ParsedOperationDocument {
    fn only_operation(&self) -> Result<&cst::OperationDefinition, WesleyError> {
        match self.operations.len() {
            0 => footprint_error("No GraphQL operation found".to_string()),
            1 => Ok(&self.operations[0]),
            count => footprint_error(format!(
                "Expected exactly one GraphQL operation, found {count}"
            )),
        }
    }
}

fn parse_operation_document(operation_sdl: &str) -> Result<ParsedOperationDocument, WesleyError> {
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

    Ok(ParsedOperationDocument {
        operations,
        fragments,
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

fn collect_schema_coordinates(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
    actual_selections: &mut Vec<String>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                let field_name = required_name(field.name(), "Field selection missing name")?;
                let schema_field = schema.field(parent_type, &field_name)?;
                let coordinate = format!("{parent_type}.{field_name}");
                push_unique(actual_selections, coordinate);

                if let Some(nested_selection_set) = field.selection_set() {
                    let nested_parent = schema_field.r#type.base.as_str();
                    schema.require_type(nested_parent)?;
                    collect_schema_coordinates(
                        &nested_selection_set,
                        nested_parent,
                        schema,
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
                let fragment_parent = fragment_type_condition(fragment)?;
                schema.require_type(&fragment_parent)?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    collect_schema_coordinates(
                        &fragment_selection_set,
                        &fragment_parent,
                        schema,
                        fragments,
                        active_fragments,
                        actual_selections,
                    )?;
                }
                active_fragments.pop();
            }
            cst::Selection::InlineFragment(fragment) => {
                let inline_parent = if let Some(type_condition) = fragment.type_condition() {
                    named_type_name(type_condition.named_type(), "Inline fragment missing type")?
                } else {
                    parent_type.to_string()
                };
                schema.require_type(&inline_parent)?;

                if let Some(inline_selection_set) = fragment.selection_set() {
                    collect_schema_coordinates(
                        &inline_selection_set,
                        &inline_parent,
                        schema,
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

struct SchemaIndex<'a> {
    types: HashMap<&'a str, &'a TypeDefinition>,
}

impl<'a> SchemaIndex<'a> {
    fn new(ir: &'a WesleyIR) -> Self {
        let types = ir
            .types
            .iter()
            .map(|type_def| (type_def.name.as_str(), type_def))
            .collect::<HashMap<_, _>>();
        Self { types }
    }

    fn require_type(&self, name: &str) -> Result<&'a TypeDefinition, WesleyError> {
        self.types.get(name).copied().ok_or_else(|| {
            footprint_error_value(format!("Unknown selection parent type '{name}'"))
        })
    }

    fn field(&self, parent_type: &str, field_name: &str) -> Result<&'a Field, WesleyError> {
        let type_def = self.require_type(parent_type)?;
        type_def
            .fields
            .iter()
            .find(|field| field.name == field_name)
            .ok_or_else(|| {
                footprint_error_value(format!(
                    "Type '{parent_type}' does not define selected field '{field_name}'"
                ))
            })
    }
}

struct RootTypes {
    query: String,
    mutation: String,
    subscription: String,
}

impl RootTypes {
    fn root_for_operation(&self, op: &cst::OperationDefinition) -> Result<&str, WesleyError> {
        let Some(operation_type) = op.operation_type() else {
            return Ok(self.query.as_str());
        };

        if operation_type.query_token().is_some() {
            Ok(self.query.as_str())
        } else if operation_type.mutation_token().is_some() {
            Ok(self.mutation.as_str())
        } else if operation_type.subscription_token().is_some() {
            Ok(self.subscription.as_str())
        } else {
            footprint_error("Unknown GraphQL operation type".to_string())
        }
    }
}

fn extract_root_types(schema_sdl: &str) -> Result<RootTypes, WesleyError> {
    let parser = Parser::new(schema_sdl);
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

    let mut root_types = RootTypes {
        query: "Query".to_string(),
        mutation: "Mutation".to_string(),
        subscription: "Subscription".to_string(),
    };

    for def in cst.document().definitions() {
        match def {
            cst::Definition::SchemaDefinition(schema) => {
                update_root_types(schema.root_operation_type_definitions(), &mut root_types)?;
            }
            cst::Definition::SchemaExtension(schema) => {
                update_root_types(schema.root_operation_type_definitions(), &mut root_types)?;
            }
            _ => {}
        }
    }

    Ok(root_types)
}

fn update_root_types(
    root_defs: cst::CstChildren<cst::RootOperationTypeDefinition>,
    root_types: &mut RootTypes,
) -> Result<(), WesleyError> {
    for root_def in root_defs {
        let operation_type = root_def.operation_type().ok_or_else(|| {
            footprint_error_value("Schema root operation missing operation type".to_string())
        })?;
        let named_type = named_type_name(
            root_def.named_type(),
            "Schema root operation missing named type",
        )?;

        if operation_type.query_token().is_some() {
            root_types.query = named_type;
        } else if operation_type.mutation_token().is_some() {
            root_types.mutation = named_type;
        } else if operation_type.subscription_token().is_some() {
            root_types.subscription = named_type;
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

fn fragment_type_condition(fragment: &cst::FragmentDefinition) -> Result<String, WesleyError> {
    let type_condition = fragment.type_condition().ok_or_else(|| {
        footprint_error_value("Fragment definition missing type condition".to_string())
    })?;
    named_type_name(
        type_condition.named_type(),
        "Fragment definition missing type condition",
    )
}

fn named_type_name(name: Option<cst::NamedType>, message: &str) -> Result<String, WesleyError> {
    name.and_then(|named_type| named_type.name())
        .map(|name| name.text().to_string())
        .ok_or_else(|| footprint_error_value(message.to_string()))
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
