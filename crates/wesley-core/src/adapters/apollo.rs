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

/// Lowers GraphQL SDL into the Wesley L1 IR using the Apollo parser adapter.
pub fn lower_schema_sdl(sdl: &str) -> Result<WesleyIR, WesleyError> {
    ApolloLoweringAdapter::new(0).parse_and_lower(sdl)
}

/// Represents the consolidated parts of a single GraphQL Type.
struct TypeAggregate {
    name: String,
    kind: TypeKind,
    definitions: Vec<TypeDefinitionNode>,
    extensions: Vec<TypeExtensionNode>,
}

enum TypeDefinitionNode {
    Scalar(cst::ScalarTypeDefinition),
    Object(cst::ObjectTypeDefinition),
    Interface(cst::InterfaceTypeDefinition),
    Union(cst::UnionTypeDefinition),
    Enum(cst::EnumTypeDefinition),
    InputObject(cst::InputObjectTypeDefinition),
}

impl TypeDefinitionNode {
    fn name(&self) -> Option<cst::Name> {
        match self {
            TypeDefinitionNode::Scalar(node) => node.name(),
            TypeDefinitionNode::Object(node) => node.name(),
            TypeDefinitionNode::Interface(node) => node.name(),
            TypeDefinitionNode::Union(node) => node.name(),
            TypeDefinitionNode::Enum(node) => node.name(),
            TypeDefinitionNode::InputObject(node) => node.name(),
        }
    }

    fn description(&self) -> Option<cst::Description> {
        match self {
            TypeDefinitionNode::Scalar(node) => node.description(),
            TypeDefinitionNode::Object(node) => node.description(),
            TypeDefinitionNode::Interface(node) => node.description(),
            TypeDefinitionNode::Union(node) => node.description(),
            TypeDefinitionNode::Enum(node) => node.description(),
            TypeDefinitionNode::InputObject(node) => node.description(),
        }
    }
}

enum TypeExtensionNode {
    Scalar(cst::ScalarTypeExtension),
    Object(cst::ObjectTypeExtension),
    Interface(cst::InterfaceTypeExtension),
    Union(cst::UnionTypeExtension),
    Enum(cst::EnumTypeExtension),
    InputObject(cst::InputObjectTypeExtension),
}

impl TypeExtensionNode {
    fn name(&self) -> Option<cst::Name> {
        match self {
            TypeExtensionNode::Scalar(node) => node.name(),
            TypeExtensionNode::Object(node) => node.name(),
            TypeExtensionNode::Interface(node) => node.name(),
            TypeExtensionNode::Union(node) => node.name(),
            TypeExtensionNode::Enum(node) => node.name(),
            TypeExtensionNode::InputObject(node) => node.name(),
        }
    }
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
                cst::Definition::ScalarTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::Scalar(node),
                    TypeKind::Scalar,
                    &mut aggregates,
                )?,
                cst::Definition::ObjectTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::Object(node),
                    TypeKind::Object,
                    &mut aggregates,
                )?,
                cst::Definition::InterfaceTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::Interface(node),
                    TypeKind::Interface,
                    &mut aggregates,
                )?,
                cst::Definition::UnionTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::Union(node),
                    TypeKind::Union,
                    &mut aggregates,
                )?,
                cst::Definition::EnumTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::Enum(node),
                    TypeKind::Enum,
                    &mut aggregates,
                )?,
                cst::Definition::InputObjectTypeDefinition(node) => self.aggregate_definition(
                    TypeDefinitionNode::InputObject(node),
                    TypeKind::InputObject,
                    &mut aggregates,
                )?,
                cst::Definition::ScalarTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::Scalar(node),
                    TypeKind::Scalar,
                    &mut aggregates,
                )?,
                cst::Definition::ObjectTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::Object(node),
                    TypeKind::Object,
                    &mut aggregates,
                )?,
                cst::Definition::InterfaceTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::Interface(node),
                    TypeKind::Interface,
                    &mut aggregates,
                )?,
                cst::Definition::UnionTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::Union(node),
                    TypeKind::Union,
                    &mut aggregates,
                )?,
                cst::Definition::EnumTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::Enum(node),
                    TypeKind::Enum,
                    &mut aggregates,
                )?,
                cst::Definition::InputObjectTypeExtension(node) => self.aggregate_extension(
                    TypeExtensionNode::InputObject(node),
                    TypeKind::InputObject,
                    &mut aggregates,
                )?,
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

    fn aggregate_definition(
        &self,
        node: TypeDefinitionNode,
        kind: TypeKind,
        aggregates: &mut BTreeMap<String, TypeAggregate>,
    ) -> Result<(), WesleyError> {
        let name = type_node_name(node.name(), "Type definition missing name")?;
        let agg = aggregate_for(aggregates, name, kind)?;
        agg.definitions.push(node);
        Ok(())
    }

    fn aggregate_extension(
        &self,
        node: TypeExtensionNode,
        kind: TypeKind,
        aggregates: &mut BTreeMap<String, TypeAggregate>,
    ) -> Result<(), WesleyError> {
        let name = type_node_name(node.name(), "Type extension missing name")?;
        let agg = aggregate_for(aggregates, name, kind)?;
        agg.extensions.push(node);
        Ok(())
    }

    fn build_type_from_aggregate(
        &self,
        agg: &TypeAggregate,
    ) -> Result<TypeDefinition, WesleyError> {
        let mut directives = IndexMap::new();
        let mut implements = Vec::new();
        let mut fields = Vec::new();
        let mut enum_values = Vec::new();
        let mut union_members = Vec::new();
        let mut description = None;

        for def in &agg.definitions {
            if description.is_none() {
                description = description_from(def.description());
            }
            self.merge_definition(
                def,
                &mut directives,
                &mut implements,
                &mut fields,
                &mut enum_values,
                &mut union_members,
            )?;
        }

        for ext in &agg.extensions {
            self.merge_extension(
                ext,
                &mut directives,
                &mut implements,
                &mut fields,
                &mut enum_values,
                &mut union_members,
            )?;
        }

        Ok(TypeDefinition {
            name: agg.name.clone(),
            kind: agg.kind,
            description,
            directives,
            implements,
            fields,
            enum_values,
            union_members,
        })
    }

    fn merge_definition(
        &self,
        def: &TypeDefinitionNode,
        directives: &mut IndexMap<String, serde_json::Value>,
        implements: &mut Vec<String>,
        fields: &mut Vec<Field>,
        enum_values: &mut Vec<String>,
        union_members: &mut Vec<String>,
    ) -> Result<(), WesleyError> {
        match def {
            TypeDefinitionNode::Scalar(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
            }
            TypeDefinitionNode::Object(node) => {
                if let Some(interfaces) = node.implements_interfaces() {
                    collect_implements(interfaces, implements)?;
                }
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.fields_definition() {
                    self.collect_fields(fields_def, fields)?;
                }
            }
            TypeDefinitionNode::Interface(node) => {
                if let Some(interfaces) = node.implements_interfaces() {
                    collect_implements(interfaces, implements)?;
                }
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.fields_definition() {
                    self.collect_fields(fields_def, fields)?;
                }
            }
            TypeDefinitionNode::Union(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(member_types) = node.union_member_types() {
                    collect_union_members(member_types, union_members)?;
                }
            }
            TypeDefinitionNode::Enum(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(values_def) = node.enum_values_definition() {
                    collect_enum_values(values_def, enum_values)?;
                }
            }
            TypeDefinitionNode::InputObject(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.input_fields_definition() {
                    self.collect_input_fields(fields_def, fields)?;
                }
            }
        }

        Ok(())
    }

    fn merge_extension(
        &self,
        ext: &TypeExtensionNode,
        directives: &mut IndexMap<String, serde_json::Value>,
        implements: &mut Vec<String>,
        fields: &mut Vec<Field>,
        enum_values: &mut Vec<String>,
        union_members: &mut Vec<String>,
    ) -> Result<(), WesleyError> {
        match ext {
            TypeExtensionNode::Scalar(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
            }
            TypeExtensionNode::Object(node) => {
                if let Some(interfaces) = node.implements_interfaces() {
                    collect_implements(interfaces, implements)?;
                }
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.fields_definition() {
                    self.collect_fields(fields_def, fields)?;
                }
            }
            TypeExtensionNode::Interface(node) => {
                if let Some(interfaces) = node.implements_interfaces() {
                    collect_implements(interfaces, implements)?;
                }
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.fields_definition() {
                    self.collect_fields(fields_def, fields)?;
                }
            }
            TypeExtensionNode::Union(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(member_types) = node.union_member_types() {
                    collect_union_members(member_types, union_members)?;
                }
            }
            TypeExtensionNode::Enum(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(values_def) = node.enum_values_definition() {
                    collect_enum_values(values_def, enum_values)?;
                }
            }
            TypeExtensionNode::InputObject(node) => {
                if let Some(dirs) = node.directives() {
                    self.extract_directives(dirs, directives)?;
                }
                if let Some(fields_def) = node.input_fields_definition() {
                    self.collect_input_fields(fields_def, fields)?;
                }
            }
        }

        Ok(())
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
                        args_map.insert(arg_name, directive_value_to_json(val)?);
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

    fn collect_fields(
        &self,
        fields_def: cst::FieldsDefinition,
        fields: &mut Vec<Field>,
    ) -> Result<(), WesleyError> {
        for field_def in fields_def.field_definitions() {
            fields.push(self.build_field(field_def)?);
        }

        Ok(())
    }

    fn collect_input_fields(
        &self,
        fields_def: cst::InputFieldsDefinition,
        fields: &mut Vec<Field>,
    ) -> Result<(), WesleyError> {
        for field_def in fields_def.input_value_definitions() {
            fields.push(self.build_input_field(field_def)?);
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

        let mut field_directives = IndexMap::new();
        if let Some(dirs) = field_def.directives() {
            self.extract_directives(dirs, &mut field_directives)?;
        }

        Ok(Field {
            name,
            r#type: self.build_type_reference(type_node)?,
            directives: field_directives,
            description: description_from(field_def.description()),
        })
    }

    fn build_input_field(
        &self,
        field_def: cst::InputValueDefinition,
    ) -> Result<Field, WesleyError> {
        let name = field_def
            .name()
            .ok_or(WesleyError::LoweringError {
                message: "Input field missing name".to_string(),
                area: "field".to_string(),
            })?
            .text()
            .to_string();

        let type_node = field_def.ty().ok_or(WesleyError::LoweringError {
            message: "Input field missing type".to_string(),
            area: "field".to_string(),
        })?;

        let mut field_directives = IndexMap::new();
        if let Some(dirs) = field_def.directives() {
            self.extract_directives(dirs, &mut field_directives)?;
        }

        Ok(Field {
            name,
            r#type: self.build_type_reference(type_node)?,
            directives: field_directives,
            description: description_from(field_def.description()),
        })
    }

    fn build_type_reference(&self, type_node: cst::Type) -> Result<TypeReference, WesleyError> {
        type_reference_from_type(type_node, true)
    }
}

fn aggregate_for<'a>(
    aggregates: &'a mut BTreeMap<String, TypeAggregate>,
    name: String,
    kind: TypeKind,
) -> Result<&'a mut TypeAggregate, WesleyError> {
    use std::collections::btree_map::Entry;

    match aggregates.entry(name.clone()) {
        Entry::Vacant(entry) => Ok(entry.insert(TypeAggregate {
            name,
            kind,
            definitions: Vec::new(),
            extensions: Vec::new(),
        })),
        Entry::Occupied(entry) => {
            let aggregate = entry.into_mut();
            if aggregate.kind != kind {
                return Err(lowering_error_value(
                    "type",
                    format!(
                        "Type '{}' is declared as both {:?} and {:?}",
                        aggregate.name, aggregate.kind, kind
                    ),
                ));
            }
            Ok(aggregate)
        }
    }
}

fn type_node_name(name: Option<cst::Name>, message: &str) -> Result<String, WesleyError> {
    name.map(|name| name.text().to_string())
        .ok_or_else(|| lowering_error_value("type", message.to_string()))
}

fn description_from(description: Option<cst::Description>) -> Option<String> {
    description
        .and_then(|description| description.string_value())
        .map(String::from)
}

fn collect_implements(
    interfaces: cst::ImplementsInterfaces,
    implements: &mut Vec<String>,
) -> Result<(), WesleyError> {
    for named_type in interfaces.named_types() {
        let name = named_type_name_for_lowering(named_type, "Implemented interface missing name")?;
        push_unique(implements, name);
    }

    Ok(())
}

fn collect_union_members(
    member_types: cst::UnionMemberTypes,
    union_members: &mut Vec<String>,
) -> Result<(), WesleyError> {
    for named_type in member_types.named_types() {
        let name = named_type_name_for_lowering(named_type, "Union member missing name")?;
        push_unique(union_members, name);
    }

    Ok(())
}

fn collect_enum_values(
    values_def: cst::EnumValuesDefinition,
    enum_values: &mut Vec<String>,
) -> Result<(), WesleyError> {
    for value_def in values_def.enum_value_definitions() {
        let name = value_def
            .enum_value()
            .and_then(|enum_value| enum_value.name())
            .map(|name| name.text().to_string())
            .ok_or_else(|| lowering_error_value("enum", "Enum value missing name".to_string()))?;
        push_unique(enum_values, name);
    }

    Ok(())
}

fn named_type_name_for_lowering(
    named_type: cst::NamedType,
    message: &str,
) -> Result<String, WesleyError> {
    named_type
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| lowering_error_value("type", message.to_string()))
}

fn type_reference_from_type(
    type_node: cst::Type,
    nullable: bool,
) -> Result<TypeReference, WesleyError> {
    match type_node {
        cst::Type::NamedType(named_type) => Ok(TypeReference {
            base: named_type_name_for_lowering(named_type, "Type reference missing name")?,
            nullable,
            is_list: false,
            list_item_nullable: None,
        }),
        cst::Type::ListType(list_type) => {
            let item_type = list_type.ty().ok_or_else(|| {
                lowering_error_value("type", "List type missing item type".to_string())
            })?;
            let item_ref = type_reference_from_type(item_type, true)?;
            Ok(TypeReference {
                base: item_ref.base,
                nullable,
                is_list: true,
                list_item_nullable: Some(item_ref.nullable),
            })
        }
        cst::Type::NonNullType(non_null_type) => {
            if let Some(named_type) = non_null_type.named_type() {
                Ok(TypeReference {
                    base: named_type_name_for_lowering(
                        named_type,
                        "Non-null type reference missing name",
                    )?,
                    nullable: false,
                    is_list: false,
                    list_item_nullable: None,
                })
            } else if let Some(list_type) = non_null_type.list_type() {
                let item_type = list_type.ty().ok_or_else(|| {
                    lowering_error_value("type", "Non-null list type missing item type".to_string())
                })?;
                let item_ref = type_reference_from_type(item_type, true)?;
                Ok(TypeReference {
                    base: item_ref.base,
                    nullable: false,
                    is_list: true,
                    list_item_nullable: Some(item_ref.nullable),
                })
            } else {
                Err(lowering_error_value(
                    "type",
                    "Non-null type missing inner type".to_string(),
                ))
            }
        }
    }
}

fn directive_value_to_json(value: cst::Value) -> Result<serde_json::Value, WesleyError> {
    match value {
        cst::Value::StringValue(value) => Ok(serde_json::Value::String(String::from(value))),
        cst::Value::FloatValue(value) => {
            let raw = value
                .float_token()
                .map(|token| token.text().to_string())
                .unwrap_or_default();
            let parsed = raw.parse::<f64>().map_err(|err| {
                lowering_error_value(
                    "directive",
                    format!("Invalid float directive argument '{raw}': {err}"),
                )
            })?;
            serde_json::Number::from_f64(parsed)
                .map(serde_json::Value::Number)
                .ok_or_else(|| {
                    lowering_error_value(
                        "directive",
                        format!("Invalid finite float directive argument '{raw}'"),
                    )
                })
        }
        cst::Value::IntValue(value) => {
            let raw = value
                .int_token()
                .map(|token| token.text().to_string())
                .unwrap_or_default();
            raw.parse::<i64>()
                .map(|parsed| serde_json::Value::Number(parsed.into()))
                .map_err(|err| {
                    lowering_error_value(
                        "directive",
                        format!("Invalid integer directive argument '{raw}': {err}"),
                    )
                })
        }
        cst::Value::BooleanValue(value) => Ok(serde_json::Value::Bool(
            value.true_token().is_some() && value.false_token().is_none(),
        )),
        cst::Value::NullValue(_) => Ok(serde_json::Value::Null),
        cst::Value::EnumValue(value) => {
            let name = value
                .name()
                .map(|name| name.text().to_string())
                .ok_or_else(|| {
                    lowering_error_value(
                        "directive",
                        "Enum directive value missing name".to_string(),
                    )
                })?;
            Ok(serde_json::Value::String(name))
        }
        cst::Value::ListValue(list) => {
            let mut values = Vec::new();
            for value in list.values() {
                values.push(directive_value_to_json(value)?);
            }
            Ok(serde_json::Value::Array(values))
        }
        cst::Value::ObjectValue(object) => {
            let mut map = serde_json::Map::new();
            for field in object.object_fields() {
                let name = field
                    .name()
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        lowering_error_value(
                            "directive",
                            "Object directive value field missing name".to_string(),
                        )
                    })?;
                let value = field.value().ok_or_else(|| {
                    lowering_error_value(
                        "directive",
                        format!("Object directive value field '{name}' missing value"),
                    )
                })?;
                map.insert(name, directive_value_to_json(value)?);
            }
            Ok(serde_json::Value::Object(map))
        }
        cst::Value::Variable(variable) => Err(lowering_error_value(
            "directive",
            format!(
                "Directive argument values in SDL cannot be variables: {}",
                variable.text()
            ),
        )),
    }
}

fn lowering_error_value(area: &str, message: String) -> WesleyError {
    WesleyError::LoweringError {
        message,
        area: area.to_string(),
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
        self.types
            .get(name)
            .copied()
            .ok_or_else(|| footprint_error_value(format!("Unknown selection parent type '{name}'")))
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
