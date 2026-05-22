//! Apollo Parser implementation of the LoweringPort.

use crate::domain::error::WesleyError;
use crate::domain::ir::*;
use crate::domain::operation::{
    OperationArgument, OperationDirectiveArgs, OperationType, SchemaOperation,
};
use crate::domain::optic::{
    CodecField, CodecShape, DirectiveRecord, EvidenceKind, Footprint, IdentityRequirement,
    LawClaimTemplate, OperationKind, OpticAdmissionRequirements,
    OpticAdmissionRequirementsArtifact, OpticArtifact, OpticOperation, OpticRegistrationDescriptor,
    PermissionAction, PermissionRequirement, RootArgumentBinding, SelectionArgumentBinding,
    OPTIC_ADMISSION_REQUIREMENTS_ARTIFACT_CODEC,
};
use crate::domain::schema_delta::{diff_schema_ir, SchemaDelta};
use crate::ports::lowering::LoweringPort;
use apollo_parser::{cst, Parser};
use async_trait::async_trait;
use indexmap::IndexMap;
use std::collections::{BTreeMap, BTreeSet, HashMap};

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

/// Computes the structural L1 delta between two GraphQL SDL documents.
pub fn diff_schema_sdl(old_sdl: &str, new_sdl: &str) -> Result<SchemaDelta, WesleyError> {
    let adapter = ApolloLoweringAdapter::new(0);
    let old_ir = adapter.parse_and_lower(old_sdl)?;
    let new_ir = adapter.parse_and_lower(new_sdl)?;

    Ok(diff_schema_ir(&old_ir, &new_ir))
}

/// Lists schema root operations from GraphQL SDL.
pub fn list_schema_operations_sdl(schema_sdl: &str) -> Result<Vec<SchemaOperation>, WesleyError> {
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

    let doc = cst.document();
    let mut root_types = RootTypes::default();
    for def in doc.definitions() {
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

    let mut operations = Vec::new();
    for def in doc.definitions() {
        match def {
            cst::Definition::ObjectTypeDefinition(node) => {
                collect_schema_operations_from_object(
                    node.name(),
                    node.fields_definition(),
                    &root_types,
                    &mut operations,
                )?;
            }
            cst::Definition::ObjectTypeExtension(node) => {
                collect_schema_operations_from_object(
                    node.name(),
                    node.fields_definition(),
                    &root_types,
                    &mut operations,
                )?;
            }
            _ => {}
        }
    }

    Ok(operations)
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
            let canonical_name = canonical_directive_name(&dir_name).to_string();

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

            if map.contains_key(&canonical_name) {
                return Err(lowering_error_value(
                    "directive",
                    format!("Duplicate directive '@{canonical_name}'"),
                ));
            }

            map.insert(canonical_name, val);
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
            arguments: field_arguments_from_definition(field_def.arguments_definition())?,
            default_value: None,
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
        let default_value = field_def
            .default_value()
            .and_then(|default_value| default_value.value())
            .map(directive_value_to_json)
            .transpose()?;

        Ok(Field {
            name,
            r#type: self.build_type_reference(type_node)?,
            arguments: Vec::new(),
            default_value,
            directives: field_directives,
            description: description_from(field_def.description()),
        })
    }

    fn build_type_reference(&self, type_node: cst::Type) -> Result<TypeReference, WesleyError> {
        type_reference_from_type(type_node, true)
    }
}

fn aggregate_for(
    aggregates: &mut BTreeMap<String, TypeAggregate>,
    name: String,
    kind: TypeKind,
) -> Result<&mut TypeAggregate, WesleyError> {
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

#[derive(Debug)]
struct TypeReferenceShape {
    base: String,
    nullable: bool,
    list_wrappers: Vec<TypeListWrapper>,
    leaf_nullable: bool,
}

fn type_reference_from_type(
    type_node: cst::Type,
    nullable: bool,
) -> Result<TypeReference, WesleyError> {
    let shape = type_reference_shape_from_type(type_node, nullable)?;
    let is_list = !shape.list_wrappers.is_empty();
    let list_item_nullable = if is_list {
        Some(
            shape
                .list_wrappers
                .get(1)
                .map(|wrapper| wrapper.nullable)
                .unwrap_or(shape.leaf_nullable),
        )
    } else {
        None
    };
    let has_nested_lists = shape.list_wrappers.len() > 1;

    Ok(TypeReference {
        base: shape.base,
        nullable: shape.nullable,
        is_list,
        list_item_nullable,
        list_wrappers: if has_nested_lists {
            shape.list_wrappers
        } else {
            Vec::new()
        },
        leaf_nullable: if has_nested_lists {
            Some(shape.leaf_nullable)
        } else {
            None
        },
    })
}

fn type_reference_shape_from_type(
    type_node: cst::Type,
    nullable: bool,
) -> Result<TypeReferenceShape, WesleyError> {
    match type_node {
        cst::Type::NamedType(named_type) => Ok(TypeReferenceShape {
            base: named_type_name_for_lowering(named_type, "Type reference missing name")?,
            nullable,
            list_wrappers: Vec::new(),
            leaf_nullable: nullable,
        }),
        cst::Type::ListType(list_type) => {
            let item_type = list_type.ty().ok_or_else(|| {
                lowering_error_value("type", "List type missing item type".to_string())
            })?;
            let item_ref = type_reference_shape_from_type(item_type, true)?;
            let mut list_wrappers = vec![TypeListWrapper { nullable }];
            list_wrappers.extend(item_ref.list_wrappers);

            Ok(TypeReferenceShape {
                base: item_ref.base,
                nullable,
                list_wrappers,
                leaf_nullable: item_ref.leaf_nullable,
            })
        }
        cst::Type::NonNullType(non_null_type) => {
            if let Some(named_type) = non_null_type.named_type() {
                Ok(TypeReferenceShape {
                    base: named_type_name_for_lowering(
                        named_type,
                        "Non-null type reference missing name",
                    )?,
                    nullable: false,
                    list_wrappers: Vec::new(),
                    leaf_nullable: false,
                })
            } else if let Some(list_type) = non_null_type.list_type() {
                let item_type = list_type.ty().ok_or_else(|| {
                    lowering_error_value("type", "Non-null list type missing item type".to_string())
                })?;
                let item_ref = type_reference_shape_from_type(item_type, true)?;
                let mut list_wrappers = vec![TypeListWrapper { nullable: false }];
                list_wrappers.extend(item_ref.list_wrappers);

                Ok(TypeReferenceShape {
                    base: item_ref.base,
                    nullable: false,
                    list_wrappers,
                    leaf_nullable: item_ref.leaf_nullable,
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

fn field_arguments_from_definition(
    arguments_definition: Option<cst::ArgumentsDefinition>,
) -> Result<Vec<FieldArgument>, WesleyError> {
    let Some(arguments_definition) = arguments_definition else {
        return Ok(Vec::new());
    };

    arguments_definition
        .input_value_definitions()
        .map(field_argument_from_input_value)
        .collect()
}

fn field_argument_from_input_value(
    input_value: cst::InputValueDefinition,
) -> Result<FieldArgument, WesleyError> {
    let name = input_value
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| {
            lowering_error_value("field argument", "Field argument missing name".into())
        })?;
    let type_node = input_value.ty().ok_or_else(|| {
        lowering_error_value(
            "field argument",
            format!("Field argument '{name}' missing type"),
        )
    })?;
    let default_value = input_value
        .default_value()
        .and_then(|default_value| default_value.value())
        .map(directive_value_to_json)
        .transpose()?;

    let mut directives = IndexMap::new();
    if let Some(dirs) = input_value.directives() {
        ApolloLoweringAdapter::new(0).extract_directives(dirs, &mut directives)?;
    }

    Ok(FieldArgument {
        name,
        description: description_from(input_value.description()),
        r#type: type_reference_from_type(type_node, true)?,
        default_value,
        directives,
    })
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
                "Directive argument values cannot be variables: {}",
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

fn canonical_directive_name(name: &str) -> &str {
    match name {
        "wesley_table" | "table" => "wes_table",
        "wesley_pk" | "pk" | "primaryKey" => "wes_pk",
        "wesley_fk" | "fk" | "foreignKey" => "wes_fk",
        "wesley_unique" | "unique" => "wes_unique",
        "wesley_index" | "index" => "wes_index",
        "wesley_tenant" | "tenant" => "wes_tenant",
        "wesley_default" | "default" => "wes_default",
        "wesley_rls" | "rls" => "wes_rls",
        _ => name,
    }
}

/// Resolves response-path field selections from a single GraphQL operation.
pub fn resolve_operation_selections(operation_sdl: &str) -> Result<Vec<String>, WesleyError> {
    let parsed = parse_operation_document(operation_sdl)?;
    let op = parsed.only_operation()?;
    let mut selections = Vec::new();

    if let Some(selection_set) = op.selection_set() {
        collect_selection_paths(
            &selection_set,
            "",
            &parsed.fragments,
            &mut Vec::new(),
            &mut selections,
        )?;
    }

    Ok(selections)
}

/// Resolves schema-coordinate field selections from a single GraphQL operation.
pub fn resolve_operation_selections_with_schema(
    schema_sdl: &str,
    operation_sdl: &str,
) -> Result<Vec<String>, WesleyError> {
    let adapter = ApolloLoweringAdapter::new(0);
    let ir = adapter.parse_and_lower(schema_sdl)?;
    let root_types = extract_root_types(schema_sdl)?;

    let parsed = parse_operation_document(operation_sdl)?;
    let op = parsed.only_operation()?;
    let mut selections = Vec::new();

    if let Some(selection_set) = op.selection_set() {
        let root_type = root_types.root_for_operation(op)?;
        let schema = SchemaIndex::new(&ir);
        collect_schema_coordinates(
            &selection_set,
            root_type,
            &schema,
            &parsed.fragments,
            &mut Vec::new(),
            &mut selections,
        )?;
    }

    Ok(selections)
}

/// Compiles runtime-provided SDL plus one GraphQL operation into an optic artifact.
///
/// This is a compiler-only entry point. It validates and inspects the declared
/// operation shape, but it does not execute the operation, grant authority, or
/// verify runtime law satisfaction.
pub fn compile_runtime_optic(
    sdl: &str,
    operation_source: &str,
    selected_operation: Option<&str>,
) -> Result<OpticArtifact, WesleyError> {
    let adapter = ApolloLoweringAdapter::new(0);
    let ir = adapter.parse_and_lower(sdl)?;
    let schema_id = compute_registry_hash(&ir).map_err(|err| {
        lowering_error_value(
            "runtime optic",
            format!("Failed to compute schema identity: {err}"),
        )
    })?;
    let schema = SchemaIndex::new(&ir);
    reject_runtime_optic_unsupported_schema_features(&ir)?;
    let root_types = extract_root_types(sdl)?;
    let schema_operations = list_schema_operations_sdl(sdl)?;

    let parsed = parse_operation_document(operation_source)?;
    let op = parsed.selected_operation(selected_operation)?;
    let kind = operation_kind(op)?;
    let root_type = root_types.root_for_operation(op)?;
    let root_field = selected_root_field(op)?;
    let root_field_name = required_name(root_field.name(), "Root field selection missing name")?;
    let schema_operation =
        schema_operation_for_selected_field(&schema_operations, kind, &root_field_name)?;
    reject_runtime_optic_variable_defaults(op)?;
    let variable_types = variable_definition_types(op)?;
    validate_runtime_optic_executable_selection(
        &root_field,
        root_type,
        &schema,
        &parsed.fragments,
    )?;
    let root_arguments =
        root_argument_bindings(&root_field, schema_operation, &variable_types, &schema)?;
    let selection_arguments = selection_argument_bindings(
        &root_field,
        &schema_operation.result_type,
        &schema,
        &parsed.fragments,
        &variable_types,
    )?;

    let operation_name = op.name().map(|name| name.text().to_string());
    let directives =
        directive_records_for_operation(op, root_type, &root_field, &schema, &parsed.fragments)?;
    let root_coordinate = format!("{root_type}.{root_field_name}");
    let declared_footprint = footprint_from_directives(&directives, &root_coordinate)?;
    let variable_shape = variable_codec_shape(op, schema_operation)?;
    let payload_shape = payload_codec_shape(
        &root_field,
        &schema_operation.result_type,
        &schema,
        &parsed.fragments,
    )?;

    let identity_seed = serde_json::json!({
        "kind": kind,
        "name": operation_name,
        "rootArguments": root_arguments,
        "rootField": root_field_name,
        "schemaId": schema_id,
        "selectionArguments": selection_arguments,
        "variableShape": variable_shape,
        "payloadShape": payload_shape,
        "directives": directives,
    });
    let operation_id = stable_json_hash(&identity_seed, "runtime optic operation identity")?;
    let law_claims =
        law_claims_for_operation(&operation_id, &directives, declared_footprint.as_ref())?;
    let requirements = admission_requirements_from_footprint(declared_footprint.as_ref());
    let requirements_artifact = canonical_requirements_artifact(&serde_json::json!({
        "declaredFootprint": &declared_footprint,
        "lawClaims": &law_claims,
        "requirements": &requirements,
    }))?;
    let requirements_digest = requirements_artifact.digest.clone();
    let artifact_hash = stable_json_hash(
        &serde_json::json!({
            "directives": &directives,
            "operationId": &operation_id,
            "payloadShape": &payload_shape,
            "requirementsArtifact": {
                "codec": &requirements_artifact.codec,
                "digest": &requirements_artifact.digest,
            },
            "schemaId": &schema_id,
            "variableShape": &variable_shape,
        }),
        "runtime optic artifact hash",
    )?;
    let artifact_id = artifact_hash.clone();
    let registration = OpticRegistrationDescriptor {
        artifact_id: artifact_id.clone(),
        artifact_hash: artifact_hash.clone(),
        schema_id: schema_id.clone(),
        operation_id: operation_id.clone(),
        requirements_digest: requirements_digest.clone(),
    };

    Ok(OpticArtifact {
        artifact_id,
        artifact_hash,
        schema_id,
        requirements_digest,
        requirements_artifact,
        operation: OpticOperation {
            operation_id,
            name: operation_name,
            kind,
            root_field: root_field_name,
            root_arguments,
            selection_arguments,
            variable_shape,
            payload_shape,
            directives,
            declared_footprint,
            law_claims,
        },
        requirements,
        registration,
    })
}

/// Compiles runtime-provided SDL plus one GraphQL operation into a registration descriptor.
///
/// This returns the cross-process descriptor an application can present to Echo
/// when registering the full artifact. Echo returns the runtime-local opaque
/// `OpticArtifactHandle` after it accepts the artifact.
pub fn compile_runtime_optic_registration(
    sdl: &str,
    operation_source: &str,
    selected_operation: Option<&str>,
) -> Result<OpticRegistrationDescriptor, WesleyError> {
    Ok(compile_runtime_optic(sdl, operation_source, selected_operation)?.registration)
}

/// Extracts arguments from operation directives with the requested directive name.
pub fn extract_operation_directive_args(
    operation_sdl: &str,
    directive_name: &str,
) -> Result<Vec<OperationDirectiveArgs>, WesleyError> {
    let parsed = parse_operation_document(operation_sdl)?;
    let op = parsed.only_operation()?;
    let mut directives = Vec::new();

    let Some(operation_directives) = op.directives() else {
        return Ok(directives);
    };

    for directive in operation_directives.directives() {
        let name = required_name(directive.name(), "Directive missing name")?;
        if name != directive_name {
            continue;
        }

        directives.push(OperationDirectiveArgs {
            directive_name: name,
            arguments: extract_directive_arguments(directive.arguments())?,
        });
    }

    Ok(directives)
}

fn extract_directive_arguments(
    arguments: Option<cst::Arguments>,
) -> Result<IndexMap<String, serde_json::Value>, WesleyError> {
    let mut values = IndexMap::new();

    let Some(arguments) = arguments else {
        return Ok(values);
    };

    for argument in arguments.arguments() {
        let name = required_name(argument.name(), "Directive argument missing name")?;
        let value = argument.value().ok_or_else(|| {
            operation_error_value(format!("Directive argument '{name}' missing value"))
        })?;
        values.insert(name, directive_value_to_json(value)?);
    }

    Ok(values)
}

struct ParsedOperationDocument {
    operations: Vec<cst::OperationDefinition>,
    fragments: BTreeMap<String, cst::FragmentDefinition>,
}

impl ParsedOperationDocument {
    fn only_operation(&self) -> Result<&cst::OperationDefinition, WesleyError> {
        match self.operations.len() {
            0 => operation_error("No GraphQL operation found".to_string()),
            1 => Ok(&self.operations[0]),
            count => operation_error(format!(
                "Expected exactly one GraphQL operation, found {count}"
            )),
        }
    }

    fn selected_operation(
        &self,
        selected_operation: Option<&str>,
    ) -> Result<&cst::OperationDefinition, WesleyError> {
        let Some(selected_operation) = selected_operation else {
            return self.only_operation();
        };

        self.operations
            .iter()
            .find(|operation| {
                operation
                    .name()
                    .map(|name| name.text() == selected_operation)
                    .unwrap_or(false)
            })
            .ok_or_else(|| {
                operation_error_value(format!(
                    "Selected GraphQL operation '{selected_operation}' not found"
                ))
            })
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
                    return operation_error(format!("Duplicate fragment definition '{name}'"));
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
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
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
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
                })?;
                let fragment_parent = fragment_type_condition(fragment)?;
                validate_fragment_type_condition(parent_type, &fragment_parent, schema, &name)?;

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
                validate_fragment_type_condition(parent_type, &inline_parent, schema, "inline")?;

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

fn operation_kind(op: &cst::OperationDefinition) -> Result<OperationKind, WesleyError> {
    let Some(operation_type) = op.operation_type() else {
        return Ok(OperationKind::Query);
    };

    if operation_type.query_token().is_some() {
        Ok(OperationKind::Query)
    } else if operation_type.mutation_token().is_some() {
        Ok(OperationKind::Mutation)
    } else if operation_type.subscription_token().is_some() {
        Ok(OperationKind::Subscription)
    } else {
        operation_error("Unknown GraphQL operation type".to_string())
    }
}

fn selected_root_field(op: &cst::OperationDefinition) -> Result<cst::Field, WesleyError> {
    let selection_set = op.selection_set().ok_or_else(|| {
        operation_error_value("Runtime optic operation missing selection set".to_string())
    })?;
    let mut fields = Vec::new();

    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => fields.push(field),
            cst::Selection::FragmentSpread(_) | cst::Selection::InlineFragment(_) => {
                return operation_error(
                    "Runtime optic v0 requires a concrete top-level field selection".to_string(),
                );
            }
        }
    }

    match fields.len() {
        0 => operation_error("Runtime optic operation selects no root field".to_string()),
        1 => Ok(fields.remove(0)),
        count => operation_error(format!(
            "Runtime optic v0 expects exactly one root field selection, found {count}"
        )),
    }
}

fn schema_operation_for_selected_field<'a>(
    schema_operations: &'a [SchemaOperation],
    kind: OperationKind,
    root_field_name: &str,
) -> Result<&'a SchemaOperation, WesleyError> {
    let operation_type = OperationType::from(kind);
    schema_operations
        .iter()
        .find(|operation| {
            operation.operation_type == operation_type && operation.field_name == root_field_name
        })
        .ok_or_else(|| {
            operation_error_value(format!(
                "Schema root operation '{root_field_name}' not found for {kind:?}"
            ))
        })
}

fn reject_runtime_optic_unsupported_schema_features(ir: &WesleyIR) -> Result<(), WesleyError> {
    for type_def in &ir.types {
        if type_def.kind == TypeKind::Interface && !type_def.implements.is_empty() {
            return operation_error(format!(
                "Runtime optic v0 does not support interface inheritance on '{}'",
                type_def.name
            ));
        }
    }

    Ok(())
}

fn reject_runtime_optic_variable_defaults(
    op: &cst::OperationDefinition,
) -> Result<(), WesleyError> {
    let Some(variable_definitions) = op.variable_definitions() else {
        return Ok(());
    };

    for variable in variable_definitions.variable_definitions() {
        if variable.default_value().is_some() {
            let name = variable
                .variable()
                .and_then(|variable| variable.name())
                .map(|name| name.text().to_string())
                .unwrap_or_else(|| "<unknown>".to_string());
            return operation_error(format!(
                "Runtime optic v0 does not support default value for variable '${name}'"
            ));
        }
    }

    Ok(())
}

fn validate_runtime_optic_executable_selection(
    root_field: &cst::Field,
    root_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
) -> Result<(), WesleyError> {
    validate_runtime_optic_field_selection(
        root_field,
        root_type,
        schema,
        fragments,
        &mut Vec::new(),
    )
}

fn validate_runtime_optic_selection_set(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
) -> Result<(), WesleyError> {
    let mut response_signatures = BTreeMap::new();
    validate_runtime_optic_selection_set_into(
        selection_set,
        parent_type,
        schema,
        fragments,
        active_fragments,
        &mut response_signatures,
    )
}

fn validate_runtime_optic_selection_set_into(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
    response_signatures: &mut BTreeMap<String, RuntimeOpticFieldSignature>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                let (response_name, signature) =
                    runtime_optic_field_signature(&field, parent_type, schema)?;
                if let Some(existing) = response_signatures.get(&response_name) {
                    if existing != &signature {
                        return operation_error(format!(
                            "Runtime optic response name '{response_name}' has conflicting field selections"
                        ));
                    }
                } else {
                    response_signatures.insert(response_name, signature);
                }

                validate_runtime_optic_field_selection(
                    &field,
                    parent_type,
                    schema,
                    fragments,
                    active_fragments,
                )?;
            }
            cst::Selection::FragmentSpread(spread) => {
                let name = spread
                    .fragment_name()
                    .and_then(|fragment_name| fragment_name.name())
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
                })?;
                let fragment_parent = fragment_type_condition(fragment)?;
                validate_fragment_type_condition(parent_type, &fragment_parent, schema, &name)?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    validate_runtime_optic_selection_set_into(
                        &fragment_selection_set,
                        &fragment_parent,
                        schema,
                        fragments,
                        active_fragments,
                        response_signatures,
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
                validate_fragment_type_condition(parent_type, &inline_parent, schema, "inline")?;

                if let Some(inline_selection_set) = fragment.selection_set() {
                    validate_runtime_optic_selection_set_into(
                        &inline_selection_set,
                        &inline_parent,
                        schema,
                        fragments,
                        active_fragments,
                        response_signatures,
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn validate_runtime_optic_field_selection(
    field: &cst::Field,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
) -> Result<(), WesleyError> {
    let field_name = required_name(field.name(), "Field selection missing name")?;
    reject_runtime_optic_unsupported_field_name(&field_name)?;
    let schema_field = schema.field(parent_type, &field_name)?;
    let has_selection_set = field.selection_set().is_some();
    let is_composite = is_composite_output_type(&schema_field.r#type, schema)?;

    match (is_composite, has_selection_set) {
        (true, false) => operation_error(format!(
            "Runtime optic field '{parent_type}.{field_name}' returns composite type '{}' and requires a subselection",
            schema_field.r#type.base
        )),
        (false, true) => operation_error(format!(
            "Runtime optic field '{parent_type}.{field_name}' returns leaf type '{}' and must not have a subselection",
            schema_field.r#type.base
        )),
        _ => {
            if let Some(selection_set) = field.selection_set() {
                validate_runtime_optic_selection_set(
                    &selection_set,
                    &schema_field.r#type.base,
                    schema,
                    fragments,
                    active_fragments,
                )?;
            }
            Ok(())
        }
    }
}

#[derive(Clone, PartialEq)]
struct RuntimeOpticFieldSignature {
    parent_type: String,
    field_name: String,
    arguments_canonical_json: String,
    type_ref: TypeReference,
}

fn runtime_optic_field_signature(
    field: &cst::Field,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
) -> Result<(String, RuntimeOpticFieldSignature), WesleyError> {
    let field_name = required_name(field.name(), "Field selection missing name")?;
    reject_runtime_optic_unsupported_field_name(&field_name)?;
    let response_name = response_field_name(field)?;
    let schema_field = schema.field(parent_type, &field_name)?;

    Ok((
        response_name,
        RuntimeOpticFieldSignature {
            parent_type: parent_type.to_string(),
            field_name,
            arguments_canonical_json: field_arguments_canonical_json(field.arguments())?,
            type_ref: schema_field.r#type.clone(),
        },
    ))
}

fn field_arguments_canonical_json(
    arguments: Option<cst::Arguments>,
) -> Result<String, WesleyError> {
    let mut values = IndexMap::new();

    if let Some(arguments) = arguments {
        for argument in arguments.arguments() {
            let name = required_name(argument.name(), "Field argument missing name")?;
            if values.contains_key(&name) {
                return operation_error(format!(
                    "Runtime optic field argument '{name}' is declared more than once"
                ));
            }
            let value = argument.value().ok_or_else(|| {
                operation_error_value(format!("Field argument '{name}' missing value"))
            })?;
            values.insert(name, executable_value_to_json(value)?);
        }
    }

    stable_json_string(&values, "runtime optic field arguments")
}

fn reject_runtime_optic_unsupported_field_name(field_name: &str) -> Result<(), WesleyError> {
    if field_name == "__typename" {
        return operation_error(
            "Runtime optic v0 does not support __typename selections".to_string(),
        );
    }

    Ok(())
}

fn is_composite_output_type(
    type_ref: &TypeReference,
    schema: &SchemaIndex<'_>,
) -> Result<bool, WesleyError> {
    match schema.type_kind(&type_ref.base) {
        Some(TypeKind::Object | TypeKind::Interface | TypeKind::Union) => Ok(true),
        Some(TypeKind::Enum | TypeKind::Scalar) => Ok(false),
        Some(TypeKind::InputObject) => operation_error(format!(
            "Runtime optic field references input object '{}' as an output type",
            type_ref.base
        )),
        None if is_builtin_scalar(&type_ref.base) => Ok(false),
        None => operation_error(format!(
            "Runtime optic field references unknown output type '{}'",
            type_ref.base
        )),
    }
}

fn directive_records_for_operation(
    op: &cst::OperationDefinition,
    root_type: &str,
    root_field: &cst::Field,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
) -> Result<Vec<DirectiveRecord>, WesleyError> {
    let operation_coordinate = op
        .name()
        .map(|name| format!("Operation.{}", name.text()))
        .unwrap_or_else(|| "Operation.<anonymous>".to_string());
    let mut records = Vec::new();

    push_directive_records(&operation_coordinate, op.directives(), &mut records)?;
    collect_field_directive_records(
        root_field,
        root_type,
        schema,
        fragments,
        &mut Vec::new(),
        "",
        &mut records,
    )?;

    Ok(records)
}

fn collect_field_directive_records(
    field: &cst::Field,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
    context_coordinate: &str,
    records: &mut Vec<DirectiveRecord>,
) -> Result<(), WesleyError> {
    let field_name = required_name(field.name(), "Field selection missing name")?;
    let schema_field = schema.field(parent_type, &field_name)?;
    let coordinate = format!("{parent_type}.{field_name}");
    push_directive_records(&coordinate, field.directives(), records)?;

    if let Some(selection_set) = field.selection_set() {
        let nested_parent = schema_field.r#type.base.as_str();
        schema.require_type(nested_parent)?;
        collect_selection_directive_records(
            &selection_set,
            nested_parent,
            schema,
            fragments,
            active_fragments,
            &coordinate,
            records,
        )?;
    } else if !context_coordinate.is_empty() {
        let _ = context_coordinate;
    }

    Ok(())
}

fn collect_selection_directive_records(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    active_fragments: &mut Vec<String>,
    context_coordinate: &str,
    records: &mut Vec<DirectiveRecord>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                collect_field_directive_records(
                    &field,
                    parent_type,
                    schema,
                    fragments,
                    active_fragments,
                    context_coordinate,
                    records,
                )?;
            }
            cst::Selection::FragmentSpread(spread) => {
                let name = spread
                    .fragment_name()
                    .and_then(|fragment_name| fragment_name.name())
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
                })?;
                let fragment_parent = fragment_type_condition(fragment)?;
                validate_fragment_type_condition(parent_type, &fragment_parent, schema, &name)?;

                let spread_coordinate = if context_coordinate.is_empty() {
                    format!("{parent_type}...{name}")
                } else {
                    format!("{context_coordinate}...{name}")
                };
                push_directive_records(&spread_coordinate, spread.directives(), records)?;
                push_directive_records(
                    &format!("Fragment.{name}"),
                    fragment.directives(),
                    records,
                )?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    collect_selection_directive_records(
                        &fragment_selection_set,
                        &fragment_parent,
                        schema,
                        fragments,
                        active_fragments,
                        context_coordinate,
                        records,
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
                validate_fragment_type_condition(parent_type, &inline_parent, schema, "inline")?;

                let inline_coordinate = if context_coordinate.is_empty() {
                    format!("{parent_type}...on {inline_parent}")
                } else {
                    format!("{context_coordinate}...on {inline_parent}")
                };
                push_directive_records(&inline_coordinate, fragment.directives(), records)?;

                if let Some(inline_selection_set) = fragment.selection_set() {
                    collect_selection_directive_records(
                        &inline_selection_set,
                        &inline_parent,
                        schema,
                        fragments,
                        active_fragments,
                        &inline_coordinate,
                        records,
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn push_directive_records(
    coordinate: &str,
    directives: Option<cst::Directives>,
    records: &mut Vec<DirectiveRecord>,
) -> Result<(), WesleyError> {
    let Some(directives) = directives else {
        return Ok(());
    };

    for directive in directives.directives() {
        let name = required_name(directive.name(), "Directive missing name")?;
        let arguments = extract_executable_directive_arguments(directive.arguments())?;
        let arguments_canonical_json = stable_json_string(&arguments, "runtime optic directive")?;
        records.push(DirectiveRecord {
            coordinate: coordinate.to_string(),
            name,
            arguments_canonical_json,
        });
    }

    Ok(())
}

fn extract_executable_directive_arguments(
    arguments: Option<cst::Arguments>,
) -> Result<IndexMap<String, serde_json::Value>, WesleyError> {
    let mut values = IndexMap::new();

    let Some(arguments) = arguments else {
        return Ok(values);
    };

    for argument in arguments.arguments() {
        let name = required_name(argument.name(), "Directive argument missing name")?;
        let value = argument.value().ok_or_else(|| {
            operation_error_value(format!("Directive argument '{name}' missing value"))
        })?;
        if values
            .insert(name.clone(), executable_value_to_json(value)?)
            .is_some()
        {
            return operation_error(format!(
                "Directive argument '{name}' is declared more than once"
            ));
        }
    }

    Ok(values)
}

fn footprint_from_directives(
    directives: &[DirectiveRecord],
    root_coordinate: &str,
) -> Result<Option<Footprint>, WesleyError> {
    let mut footprint = None;

    for directive in directives
        .iter()
        .filter(|directive| directive.name == "wes_footprint")
    {
        if directive.coordinate != root_coordinate {
            return operation_error(format!(
                "Runtime optic @wes_footprint is only supported on selected root field '{root_coordinate}', found on '{}'",
                directive.coordinate
            ));
        }

        if footprint.is_some() {
            return operation_error("Runtime optic declares multiple footprints".to_string());
        }

        let arguments: serde_json::Value =
            serde_json::from_str(&directive.arguments_canonical_json).map_err(|err| {
                operation_error_value(format!("Invalid canonical footprint arguments: {err}"))
            })?;
        footprint = Some(Footprint {
            reads: required_string_array(&arguments, "reads")?,
            writes: required_string_array(&arguments, "writes")?,
            forbids: optional_string_array(&arguments, "forbids")?,
        });
    }

    Ok(footprint)
}

fn required_string_array(
    arguments: &serde_json::Value,
    name: &str,
) -> Result<Vec<String>, WesleyError> {
    let value = arguments
        .get(name)
        .ok_or_else(|| operation_error_value(format!("Footprint argument '{name}' is required")))?;
    string_array(value, name)
}

fn optional_string_array(
    arguments: &serde_json::Value,
    name: &str,
) -> Result<Vec<String>, WesleyError> {
    let Some(value) = arguments.get(name) else {
        return Ok(Vec::new());
    };

    string_array(value, name)
}

fn string_array(value: &serde_json::Value, name: &str) -> Result<Vec<String>, WesleyError> {
    let serde_json::Value::Array(items) = value else {
        return operation_error(format!(
            "Footprint argument '{name}' must be a string array"
        ));
    };

    let mut labels = Vec::new();
    let mut seen = BTreeSet::new();
    for item in items {
        let label = item
            .as_str()
            .map(|value| value.to_string())
            .ok_or_else(|| {
                operation_error_value(format!(
                    "Footprint argument '{name}' contains a non-string value"
                ))
            })?;
        if !seen.insert(label.clone()) {
            return operation_error(format!(
                "Footprint argument '{name}' contains duplicate label '{label}'"
            ));
        }
        labels.push(label);
    }

    Ok(labels)
}

fn variable_definition_types(
    op: &cst::OperationDefinition,
) -> Result<BTreeMap<String, TypeReference>, WesleyError> {
    let mut variables = BTreeMap::new();

    let Some(variable_definitions) = op.variable_definitions() else {
        return Ok(variables);
    };

    for variable in variable_definitions.variable_definitions() {
        let name = variable
            .variable()
            .and_then(|variable| variable.name())
            .map(|name| name.text().to_string())
            .ok_or_else(|| operation_error_value("Variable definition missing name".to_string()))?;
        let type_node = variable.ty().ok_or_else(|| {
            operation_error_value(format!("Variable definition '{name}' missing type"))
        })?;
        let type_ref = type_reference_from_type(type_node, true)?;

        if variables.insert(name.clone(), type_ref).is_some() {
            return operation_error(format!("Duplicate variable definition '${name}'"));
        }
    }

    Ok(variables)
}

fn root_argument_bindings(
    root_field: &cst::Field,
    schema_operation: &SchemaOperation,
    variable_types: &BTreeMap<String, TypeReference>,
    schema: &SchemaIndex<'_>,
) -> Result<Vec<RootArgumentBinding>, WesleyError> {
    let expected_arguments = schema_operation
        .arguments
        .iter()
        .map(|argument| (argument.name.as_str(), argument))
        .collect::<BTreeMap<_, _>>();
    let mut supplied = BTreeSet::new();
    let mut bindings = Vec::new();

    if let Some(arguments) = root_field.arguments() {
        for argument in arguments.arguments() {
            let name = required_name(argument.name(), "Root field argument missing name")?;
            if !supplied.insert(name.clone()) {
                return operation_error(format!(
                    "Runtime optic root field '{}' declares duplicate argument '{name}'",
                    schema_operation.field_name
                ));
            }

            let expected = expected_arguments.get(name.as_str()).ok_or_else(|| {
                operation_error_value(format!(
                    "Runtime optic root field '{}' declares unknown argument '{name}'",
                    schema_operation.field_name
                ))
            })?;
            let value = argument.value().ok_or_else(|| {
                operation_error_value(format!("Root field argument '{name}' missing value"))
            })?;

            validate_root_argument_value(value.clone(), expected, variable_types, schema)?;
            let value_canonical_json =
                stable_json_string(&executable_value_to_json(value)?, "runtime optic argument")?;
            bindings.push(RootArgumentBinding {
                name,
                type_ref: expected.r#type.clone(),
                value_canonical_json,
            });
        }
    }

    for expected in &schema_operation.arguments {
        if !expected.r#type.nullable
            && expected.default_value.is_none()
            && !supplied.contains(&expected.name)
        {
            return operation_error(format!(
                "Runtime optic root field '{}' missing required argument '{}'",
                schema_operation.field_name, expected.name
            ));
        }
    }

    bindings.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(bindings)
}

fn selection_argument_bindings(
    root_field: &cst::Field,
    result_type: &TypeReference,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
    variable_types: &BTreeMap<String, TypeReference>,
) -> Result<Vec<SelectionArgumentBinding>, WesleyError> {
    let mut bindings = Vec::new();
    let context = SelectionArgumentBindingContext {
        schema,
        fragments,
        variable_types,
    };

    if let Some(selection_set) = root_field.selection_set() {
        collect_selection_argument_bindings(
            &selection_set,
            &result_type.base,
            &context,
            &mut Vec::new(),
            "",
            &mut bindings,
        )?;
    }

    Ok(bindings)
}

struct SelectionArgumentBindingContext<'a> {
    schema: &'a SchemaIndex<'a>,
    fragments: &'a BTreeMap<String, cst::FragmentDefinition>,
    variable_types: &'a BTreeMap<String, TypeReference>,
}

fn collect_selection_argument_bindings(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    context: &SelectionArgumentBindingContext<'_>,
    active_fragments: &mut Vec<String>,
    prefix: &str,
    bindings: &mut Vec<SelectionArgumentBinding>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                let field_name = required_name(field.name(), "Field selection missing name")?;
                let response_name = response_field_name(&field)?;
                let schema_field = context.schema.field(parent_type, &field_name)?;
                let path = if prefix.is_empty() {
                    response_name
                } else {
                    format!("{prefix}.{response_name}")
                };

                append_field_argument_bindings(
                    &field,
                    &path,
                    schema_field,
                    context.variable_types,
                    context.schema,
                    bindings,
                )?;

                if let Some(nested_selection_set) = field.selection_set() {
                    let nested_parent = schema_field.r#type.base.as_str();
                    context.schema.require_type(nested_parent)?;
                    collect_selection_argument_bindings(
                        &nested_selection_set,
                        nested_parent,
                        context,
                        active_fragments,
                        &path,
                        bindings,
                    )?;
                }
            }
            cst::Selection::FragmentSpread(spread) => {
                let name = spread
                    .fragment_name()
                    .and_then(|fragment_name| fragment_name.name())
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = context.fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
                })?;
                let fragment_parent = fragment_type_condition(fragment)?;
                validate_fragment_type_condition(
                    parent_type,
                    &fragment_parent,
                    context.schema,
                    &name,
                )?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    collect_selection_argument_bindings(
                        &fragment_selection_set,
                        &fragment_parent,
                        context,
                        active_fragments,
                        prefix,
                        bindings,
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
                validate_fragment_type_condition(
                    parent_type,
                    &inline_parent,
                    context.schema,
                    "inline",
                )?;

                if let Some(inline_selection_set) = fragment.selection_set() {
                    collect_selection_argument_bindings(
                        &inline_selection_set,
                        &inline_parent,
                        context,
                        active_fragments,
                        prefix,
                        bindings,
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn append_field_argument_bindings(
    field: &cst::Field,
    path: &str,
    schema_field: &Field,
    variable_types: &BTreeMap<String, TypeReference>,
    schema: &SchemaIndex<'_>,
    bindings: &mut Vec<SelectionArgumentBinding>,
) -> Result<(), WesleyError> {
    let expected_arguments = schema_field
        .arguments
        .iter()
        .map(|argument| (argument.name.as_str(), argument))
        .collect::<BTreeMap<_, _>>();
    let mut supplied = BTreeSet::new();
    let mut field_bindings = Vec::new();

    if let Some(arguments) = field.arguments() {
        for argument in arguments.arguments() {
            let name = required_name(argument.name(), "Field argument missing name")?;
            if !supplied.insert(name.clone()) {
                return operation_error(format!(
                    "Runtime optic field '{path}' declares duplicate argument '{name}'"
                ));
            }

            let expected = expected_arguments.get(name.as_str()).ok_or_else(|| {
                operation_error_value(format!(
                    "Runtime optic field '{path}' declares unknown argument '{name}'"
                ))
            })?;
            let value = argument.value().ok_or_else(|| {
                operation_error_value(format!("Field argument '{name}' missing value"))
            })?;

            validate_field_argument_value(value.clone(), expected, variable_types, schema)?;
            let value_canonical_json = stable_json_string(
                &executable_value_to_json(value)?,
                "runtime optic selection argument",
            )?;
            field_bindings.push(SelectionArgumentBinding {
                path: path.to_string(),
                name,
                type_ref: expected.r#type.clone(),
                value_canonical_json,
            });
        }
    }

    for expected in &schema_field.arguments {
        if !expected.r#type.nullable
            && expected.default_value.is_none()
            && !supplied.contains(&expected.name)
        {
            return operation_error(format!(
                "Runtime optic field '{path}' missing required argument '{}'",
                expected.name
            ));
        }
    }

    field_bindings.sort_by(|left, right| left.name.cmp(&right.name));
    bindings.extend(field_bindings);
    Ok(())
}

fn validate_root_argument_value(
    value: cst::Value,
    expected: &OperationArgument,
    variable_types: &BTreeMap<String, TypeReference>,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    validate_argument_value(
        value,
        "Root argument",
        &expected.name,
        &expected.r#type,
        variable_types,
        schema,
    )
}

fn validate_field_argument_value(
    value: cst::Value,
    expected: &FieldArgument,
    variable_types: &BTreeMap<String, TypeReference>,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    validate_argument_value(
        value,
        "Field argument",
        &expected.name,
        &expected.r#type,
        variable_types,
        schema,
    )
}

fn validate_argument_value(
    value: cst::Value,
    argument_context: &str,
    argument_name: &str,
    expected_type: &TypeReference,
    variable_types: &BTreeMap<String, TypeReference>,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    match value {
        cst::Value::Variable(variable) => {
            let variable_name = variable
                .name()
                .map(|name| name.text().to_string())
                .ok_or_else(|| operation_error_value("Variable reference missing name".into()))?;
            let variable_type = variable_types.get(&variable_name).ok_or_else(|| {
                operation_error_value(format!(
                    "{argument_context} '{argument_name}' references undefined variable '${variable_name}'"
                ))
            })?;

            if !variable_type_is_compatible(variable_type, expected_type) {
                return operation_error(format!(
                    "Variable '${variable_name}' has type '{}' but argument '{}' expects '{}'",
                    display_type_ref(variable_type),
                    argument_name,
                    display_type_ref(expected_type)
                ));
            }

            Ok(())
        }
        literal => validate_literal_value(
            literal,
            argument_context,
            argument_name,
            expected_type,
            schema,
        ),
    }
}

fn validate_literal_value(
    value: cst::Value,
    argument_context: &str,
    argument_name: &str,
    expected_type: &TypeReference,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    match value {
        cst::Value::NullValue(_) => {
            if expected_type.nullable {
                Ok(())
            } else {
                operation_error(format!(
                    "{argument_context} '{argument_name}' is non-null but received null",
                ))
            }
        }
        cst::Value::StringValue(_) => validate_named_scalar_literal(
            argument_context,
            argument_name,
            "String",
            expected_type,
            schema,
        ),
        cst::Value::IntValue(_) => {
            if expected_type.base == "Float" && !is_list_type(expected_type) {
                Ok(())
            } else {
                validate_named_scalar_literal(
                    argument_context,
                    argument_name,
                    "Int",
                    expected_type,
                    schema,
                )
            }
        }
        cst::Value::FloatValue(_) => validate_named_scalar_literal(
            argument_context,
            argument_name,
            "Float",
            expected_type,
            schema,
        ),
        cst::Value::BooleanValue(_) => validate_named_scalar_literal(
            argument_context,
            argument_name,
            "Boolean",
            expected_type,
            schema,
        ),
        cst::Value::EnumValue(value) => validate_enum_literal(
            value,
            argument_context,
            argument_name,
            expected_type,
            schema,
        ),
        cst::Value::ListValue(list) => {
            if !is_list_type(expected_type) {
                return literal_type_error(argument_context, argument_name, "List", expected_type);
            }
            let item_type = list_item_type_ref(expected_type);
            for item in list.values() {
                validate_literal_value(item, argument_context, argument_name, &item_type, schema)?;
            }
            Ok(())
        }
        cst::Value::ObjectValue(object) => validate_object_literal(
            object,
            argument_context,
            argument_name,
            expected_type,
            schema,
        ),
        cst::Value::Variable(_) => operation_error(format!(
            "{argument_context} '{argument_name}' received nested variable value"
        )),
    }
}

fn validate_named_scalar_literal(
    argument_context: &str,
    argument_name: &str,
    actual: &str,
    expected_type: &TypeReference,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    let builtin_matches = match actual {
        "String" => matches!(expected_type.base.as_str(), "String" | "ID"),
        "Int" => matches!(expected_type.base.as_str(), "Int" | "Float"),
        "Float" => expected_type.base == "Float",
        "Boolean" => expected_type.base == "Boolean",
        _ => false,
    };

    if builtin_matches && !is_list_type(expected_type) {
        return Ok(());
    }

    if schema.type_kind(&expected_type.base) == Some(TypeKind::Scalar)
        && !is_builtin_scalar(&expected_type.base)
        && !is_list_type(expected_type)
    {
        return Ok(());
    }

    literal_type_error(argument_context, argument_name, actual, expected_type)
}

fn validate_enum_literal(
    value: cst::EnumValue,
    argument_context: &str,
    argument_name: &str,
    expected_type: &TypeReference,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    let name = value
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| operation_error_value("Enum argument value missing name".into()))?;

    if is_list_type(expected_type) {
        return literal_type_error(argument_context, argument_name, "Enum", expected_type);
    }

    match schema.type_kind(&expected_type.base) {
        Some(TypeKind::Enum) => {
            let type_def = schema.require_type(&expected_type.base)?;
            if type_def.enum_values.contains(&name) {
                Ok(())
            } else {
                operation_error(format!(
                    "{argument_context} '{argument_name}' received unknown enum value '{name}' for '{}'",
                    expected_type.base
                ))
            }
        }
        Some(TypeKind::Scalar) if !is_builtin_scalar(&expected_type.base) => Ok(()),
        _ => literal_type_error(argument_context, argument_name, "Enum", expected_type),
    }
}

fn validate_object_literal(
    object: cst::ObjectValue,
    argument_context: &str,
    argument_name: &str,
    expected_type: &TypeReference,
    schema: &SchemaIndex<'_>,
) -> Result<(), WesleyError> {
    if is_list_type(expected_type) {
        return literal_type_error(argument_context, argument_name, "Object", expected_type);
    }

    let type_def = schema.require_type(&expected_type.base)?;
    if type_def.kind == TypeKind::Scalar && !is_builtin_scalar(&expected_type.base) {
        return Ok(());
    }
    if type_def.kind != TypeKind::InputObject {
        return literal_type_error(argument_context, argument_name, "Object", expected_type);
    }

    let expected_fields = type_def
        .fields
        .iter()
        .map(|field| (field.name.as_str(), field))
        .collect::<BTreeMap<_, _>>();
    let mut supplied = BTreeSet::new();

    for field in object.object_fields() {
        let name = field
            .name()
            .map(|name| name.text().to_string())
            .ok_or_else(|| operation_error_value("Object argument field missing name".into()))?;
        if !supplied.insert(name.clone()) {
            return operation_error(format!(
                "{argument_context} '{argument_name}' declares duplicate input field '{name}'"
            ));
        }

        let expected_field = expected_fields.get(name.as_str()).ok_or_else(|| {
            operation_error_value(format!(
                "{argument_context} '{argument_name}' declares unknown input field '{name}'"
            ))
        })?;
        let value = field.value().ok_or_else(|| {
            operation_error_value(format!("Object argument field '{name}' missing value"))
        })?;
        validate_literal_value(value, "Input field", &name, &expected_field.r#type, schema)?;
    }

    for expected_field in &type_def.fields {
        if !expected_field.r#type.nullable
            && expected_field.default_value.is_none()
            && !supplied.contains(&expected_field.name)
        {
            return operation_error(format!(
                "{argument_context} '{argument_name}' missing required input field '{}'",
                expected_field.name
            ));
        }
    }

    Ok(())
}

fn executable_value_to_json(value: cst::Value) -> Result<serde_json::Value, WesleyError> {
    match value {
        cst::Value::Variable(variable) => {
            let name = variable
                .name()
                .map(|name| name.text().to_string())
                .ok_or_else(|| operation_error_value("Variable reference missing name".into()))?;
            Ok(serde_json::json!({ "$variable": name }))
        }
        cst::Value::StringValue(value) => Ok(serde_json::Value::String(String::from(value))),
        cst::Value::FloatValue(value) => {
            let raw = value
                .float_token()
                .map(|token| token.text().to_string())
                .unwrap_or_default();
            let parsed = raw.parse::<f64>().map_err(|err| {
                operation_error_value(format!("Invalid float argument value '{raw}': {err}"))
            })?;
            serde_json::Number::from_f64(parsed)
                .map(serde_json::Value::Number)
                .ok_or_else(|| {
                    operation_error_value(format!("Invalid finite float argument value '{raw}'"))
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
                    operation_error_value(format!("Invalid integer argument value '{raw}': {err}"))
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
                .ok_or_else(|| operation_error_value("Enum argument value missing name".into()))?;
            Ok(serde_json::Value::String(name))
        }
        cst::Value::ListValue(list) => {
            let mut values = Vec::new();
            for value in list.values() {
                values.push(executable_value_to_json(value)?);
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
                        operation_error_value("Object argument field missing name".into())
                    })?;
                let value = field.value().ok_or_else(|| {
                    operation_error_value(format!("Object argument field '{name}' missing value"))
                })?;
                map.insert(name, executable_value_to_json(value)?);
            }
            Ok(serde_json::Value::Object(map))
        }
    }
}

fn literal_type_error(
    argument_context: &str,
    argument_name: &str,
    actual: &str,
    expected: &TypeReference,
) -> Result<(), WesleyError> {
    operation_error(format!(
        "{argument_context} '{argument_name}' received {actual} value but expects '{}'",
        display_type_ref(expected)
    ))
}

fn variable_type_is_compatible(actual: &TypeReference, expected: &TypeReference) -> bool {
    actual.base == expected.base
        && actual.is_list == expected.is_list
        && actual.list_wrappers == expected.list_wrappers
        && (!actual.nullable || expected.nullable)
        && list_items_are_compatible(actual, expected)
}

fn list_items_are_compatible(actual: &TypeReference, expected: &TypeReference) -> bool {
    if matches!(
        (actual.list_item_nullable, expected.list_item_nullable),
        (Some(true), Some(false))
    ) {
        return false;
    }

    !matches!(
        (
            actual.leaf_nullable.or(actual.list_item_nullable),
            expected.leaf_nullable.or(expected.list_item_nullable),
        ),
        (Some(true), Some(false))
    )
}

fn list_item_type_ref(type_ref: &TypeReference) -> TypeReference {
    if !type_ref.list_wrappers.is_empty() {
        let leaf_nullable = type_ref
            .leaf_nullable
            .unwrap_or_else(|| type_ref.list_item_nullable.unwrap_or(true));
        return type_ref_from_list_shape(
            type_ref.base.clone(),
            type_ref.list_wrappers[1..].to_vec(),
            leaf_nullable,
        );
    }

    type_ref_from_list_shape(
        type_ref.base.clone(),
        Vec::new(),
        type_ref.list_item_nullable.unwrap_or(true),
    )
}

fn type_ref_from_list_shape(
    base: String,
    list_wrappers: Vec<TypeListWrapper>,
    leaf_nullable: bool,
) -> TypeReference {
    if list_wrappers.is_empty() {
        return TypeReference {
            base,
            nullable: leaf_nullable,
            is_list: false,
            list_item_nullable: None,
            list_wrappers: Vec::new(),
            leaf_nullable: None,
        };
    }

    let list_item_nullable = Some(
        list_wrappers
            .get(1)
            .map(|wrapper| wrapper.nullable)
            .unwrap_or(leaf_nullable),
    );
    let has_nested_lists = list_wrappers.len() > 1;

    TypeReference {
        base,
        nullable: list_wrappers[0].nullable,
        is_list: true,
        list_item_nullable,
        list_wrappers: if has_nested_lists {
            list_wrappers
        } else {
            Vec::new()
        },
        leaf_nullable: if has_nested_lists {
            Some(leaf_nullable)
        } else {
            None
        },
    }
}

fn display_type_ref(type_ref: &TypeReference) -> String {
    let mut rendered = if type_ref.is_list {
        format!(
            "[{}{}]",
            type_ref.base,
            if type_ref.list_item_nullable == Some(false) {
                "!"
            } else {
                ""
            }
        )
    } else {
        type_ref.base.clone()
    };

    if !type_ref.nullable {
        rendered.push('!');
    }

    rendered
}

fn is_builtin_scalar(name: &str) -> bool {
    matches!(name, "ID" | "String" | "Int" | "Float" | "Boolean")
}

fn variable_codec_shape(
    op: &cst::OperationDefinition,
    schema_operation: &SchemaOperation,
) -> Result<CodecShape, WesleyError> {
    let type_name = op
        .name()
        .map(|name| format!("{}Variables", name.text()))
        .unwrap_or_else(|| format!("{}Variables", schema_operation.field_name));

    let fields = if let Some(variable_definitions) = op.variable_definitions() {
        variable_definitions
            .variable_definitions()
            .map(variable_codec_field)
            .collect::<Result<Vec<_>, _>>()?
    } else {
        schema_operation
            .arguments
            .iter()
            .map(|argument| CodecField {
                name: argument.name.clone(),
                type_ref: argument.r#type.clone(),
                required: argument.default_value.is_none() && !argument.r#type.nullable,
                list: is_list_type(&argument.r#type),
            })
            .collect()
    };

    Ok(CodecShape { type_name, fields })
}

fn variable_codec_field(variable: cst::VariableDefinition) -> Result<CodecField, WesleyError> {
    let name = variable
        .variable()
        .and_then(|variable| variable.name())
        .map(|name| name.text().to_string())
        .ok_or_else(|| operation_error_value("Variable definition missing name".to_string()))?;
    let type_node = variable.ty().ok_or_else(|| {
        operation_error_value(format!("Variable definition '{name}' missing type"))
    })?;
    let type_ref = type_reference_from_type(type_node, true)?;

    Ok(CodecField {
        name,
        required: variable.default_value().is_none() && !type_ref.nullable,
        list: is_list_type(&type_ref),
        type_ref,
    })
}

fn payload_codec_shape(
    root_field: &cst::Field,
    result_type: &TypeReference,
    schema: &SchemaIndex<'_>,
    fragments: &BTreeMap<String, cst::FragmentDefinition>,
) -> Result<CodecShape, WesleyError> {
    let mut fields = Vec::new();
    let context = PayloadCodecContext { schema, fragments };

    if let Some(selection_set) = root_field.selection_set() {
        collect_payload_codec_fields(
            &selection_set,
            &result_type.base,
            &context,
            &mut Vec::new(),
            "",
            !result_type.nullable,
            &mut fields,
        )?;
    }

    Ok(CodecShape {
        type_name: result_type.base.to_string(),
        fields,
    })
}

struct PayloadCodecContext<'a> {
    schema: &'a SchemaIndex<'a>,
    fragments: &'a BTreeMap<String, cst::FragmentDefinition>,
}

fn collect_payload_codec_fields(
    selection_set: &cst::SelectionSet,
    parent_type: &str,
    context: &PayloadCodecContext<'_>,
    active_fragments: &mut Vec<String>,
    prefix: &str,
    parent_path_required: bool,
    fields: &mut Vec<CodecField>,
) -> Result<(), WesleyError> {
    for selection in selection_set.selections() {
        match selection {
            cst::Selection::Field(field) => {
                let field_name = required_name(field.name(), "Field selection missing name")?;
                let response_name = response_field_name(&field)?;
                let schema_field = context.schema.field(parent_type, &field_name)?;
                let path = if prefix.is_empty() {
                    response_name
                } else {
                    format!("{prefix}.{response_name}")
                };
                let field_required = parent_path_required && !schema_field.r#type.nullable;

                push_unique_codec_field(
                    fields,
                    CodecField {
                        name: path.clone(),
                        type_ref: schema_field.r#type.clone(),
                        required: field_required,
                        list: is_list_type(&schema_field.r#type),
                    },
                );

                if let Some(nested_selection_set) = field.selection_set() {
                    let nested_parent = schema_field.r#type.base.as_str();
                    context.schema.require_type(nested_parent)?;
                    collect_payload_codec_fields(
                        &nested_selection_set,
                        nested_parent,
                        context,
                        active_fragments,
                        &path,
                        field_required,
                        fields,
                    )?;
                }
            }
            cst::Selection::FragmentSpread(spread) => {
                let name = spread
                    .fragment_name()
                    .and_then(|fragment_name| fragment_name.name())
                    .map(|name| name.text().to_string())
                    .ok_or_else(|| {
                        operation_error_value("Fragment spread missing name".to_string())
                    })?;

                if active_fragments.contains(&name) {
                    return operation_error(format!(
                        "Cyclic fragment spread detected for fragment '{name}'"
                    ));
                }

                let fragment = context.fragments.get(&name).ok_or_else(|| {
                    operation_error_value(format!("Unknown fragment spread '{name}'"))
                })?;
                let fragment_parent = fragment_type_condition(fragment)?;
                validate_fragment_type_condition(
                    parent_type,
                    &fragment_parent,
                    context.schema,
                    &name,
                )?;

                active_fragments.push(name);
                if let Some(fragment_selection_set) = fragment.selection_set() {
                    collect_payload_codec_fields(
                        &fragment_selection_set,
                        &fragment_parent,
                        context,
                        active_fragments,
                        prefix,
                        parent_path_required,
                        fields,
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
                validate_fragment_type_condition(
                    parent_type,
                    &inline_parent,
                    context.schema,
                    "inline",
                )?;

                if let Some(inline_selection_set) = fragment.selection_set() {
                    collect_payload_codec_fields(
                        &inline_selection_set,
                        &inline_parent,
                        context,
                        active_fragments,
                        prefix,
                        parent_path_required,
                        fields,
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn response_field_name(field: &cst::Field) -> Result<String, WesleyError> {
    field
        .alias()
        .and_then(|alias| alias.name())
        .or_else(|| field.name())
        .map(|name| name.text().to_string())
        .ok_or_else(|| operation_error_value("Field selection missing response name".into()))
}

fn push_unique_codec_field(fields: &mut Vec<CodecField>, field: CodecField) {
    if !fields.iter().any(|existing| existing.name == field.name) {
        fields.push(field);
    }
}

fn law_claims_for_operation(
    operation_id: &str,
    directives: &[DirectiveRecord],
    footprint: Option<&Footprint>,
) -> Result<Vec<LawClaimTemplate>, WesleyError> {
    let mut claims = Vec::new();
    let mut seen = BTreeSet::new();

    push_law_claim(
        &mut claims,
        &mut seen,
        operation_id,
        "shape.valid.v1",
        vec![EvidenceKind::Compiler],
    );
    push_law_claim(
        &mut claims,
        &mut seen,
        operation_id,
        "codec.canonical.v1",
        vec![EvidenceKind::Compiler, EvidenceKind::Codec],
    );

    for law_id in law_ids_from_directives(directives)? {
        push_law_claim(
            &mut claims,
            &mut seen,
            operation_id,
            &law_id,
            vec![EvidenceKind::HostPolicy, EvidenceKind::DomainVerifier],
        );
    }

    if footprint.is_some() {
        push_law_claim(
            &mut claims,
            &mut seen,
            operation_id,
            "footprint.closed.v1",
            vec![EvidenceKind::RuntimeTrace],
        );
    }

    Ok(claims)
}

fn admission_requirements_from_footprint(
    footprint: Option<&Footprint>,
) -> OpticAdmissionRequirements {
    let mut required_permissions = Vec::new();
    let mut forbidden_resources = Vec::new();

    if let Some(footprint) = footprint {
        for resource in &footprint.reads {
            required_permissions.push(PermissionRequirement {
                action: PermissionAction::Read,
                resource: resource.clone(),
                source: "wes_footprint.reads".to_string(),
            });
        }

        for resource in &footprint.writes {
            required_permissions.push(PermissionRequirement {
                action: PermissionAction::Write,
                resource: resource.clone(),
                source: "wes_footprint.writes".to_string(),
            });
        }

        forbidden_resources = footprint.forbids.clone();
    }

    OpticAdmissionRequirements {
        identity: IdentityRequirement {
            required: true,
            accepted_principal_kinds: Vec::new(),
        },
        required_permissions,
        forbidden_resources,
    }
}

fn push_law_claim(
    claims: &mut Vec<LawClaimTemplate>,
    seen: &mut BTreeSet<String>,
    operation_id: &str,
    law_id: &str,
    required_evidence: Vec<EvidenceKind>,
) {
    if !seen.insert(law_id.to_string()) {
        return;
    }

    let claim_id = compute_content_hash(&format!("law-claim:{operation_id}:{law_id}"));
    claims.push(LawClaimTemplate {
        law_id: law_id.to_string(),
        claim_id,
        operation_id: operation_id.to_string(),
        required_evidence,
    });
}

fn law_ids_from_directives(directives: &[DirectiveRecord]) -> Result<Vec<String>, WesleyError> {
    let mut law_ids = Vec::new();

    for directive in directives
        .iter()
        .filter(|directive| directive.name == "wes_law")
    {
        let arguments: serde_json::Value =
            serde_json::from_str(&directive.arguments_canonical_json).map_err(|err| {
                operation_error_value(format!("Invalid canonical law arguments: {err}"))
            })?;
        let law_id = arguments
            .get("id")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                operation_error_value("Directive 'wes_law' requires string argument 'id'".into())
            })?;
        law_ids.push(law_id.to_string());
    }

    Ok(law_ids)
}

fn is_list_type(type_ref: &TypeReference) -> bool {
    type_ref.is_list || !type_ref.list_wrappers.is_empty()
}

fn stable_json_hash<T: serde::Serialize>(value: &T, area: &str) -> Result<String, WesleyError> {
    let canonical = stable_json_string(value, area)?;
    Ok(compute_content_hash(&canonical))
}

fn canonical_requirements_artifact<T: serde::Serialize>(
    value: &T,
) -> Result<OpticAdmissionRequirementsArtifact, WesleyError> {
    let canonical = stable_json_string(value, "runtime optic requirements artifact")?;
    let bytes = canonical.into_bytes();
    let digest = compute_content_hash_bytes(&bytes);

    Ok(OpticAdmissionRequirementsArtifact {
        digest,
        codec: OPTIC_ADMISSION_REQUIREMENTS_ARTIFACT_CODEC.to_string(),
        bytes,
    })
}

fn stable_json_string<T: serde::Serialize>(value: &T, area: &str) -> Result<String, WesleyError> {
    to_canonical_json(value)
        .map_err(|err| lowering_error_value(area, format!("Failed to serialize JSON: {err}")))
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
            .ok_or_else(|| operation_error_value(format!("Unknown selection parent type '{name}'")))
    }

    fn type_kind(&self, name: &str) -> Option<TypeKind> {
        self.types.get(name).map(|type_def| type_def.kind)
    }

    fn possible_runtime_types(&self, name: &str) -> Result<BTreeSet<String>, WesleyError> {
        let type_def = self.require_type(name)?;
        match type_def.kind {
            TypeKind::Object => Ok(BTreeSet::from([name.to_string()])),
            TypeKind::Interface => Ok(self
                .types
                .values()
                .filter(|candidate| {
                    candidate.kind == TypeKind::Object
                        && candidate
                            .implements
                            .iter()
                            .any(|interface| interface == name)
                })
                .map(|candidate| candidate.name.clone())
                .collect()),
            TypeKind::Union => Ok(type_def.union_members.iter().cloned().collect()),
            _ => operation_error(format!("Type '{name}' is not a composite fragment parent")),
        }
    }

    fn field(&self, parent_type: &str, field_name: &str) -> Result<&'a Field, WesleyError> {
        let type_def = self.require_type(parent_type)?;
        type_def
            .fields
            .iter()
            .find(|field| field.name == field_name)
            .ok_or_else(|| {
                operation_error_value(format!(
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

impl Default for RootTypes {
    fn default() -> Self {
        Self {
            query: "Query".to_string(),
            mutation: "Mutation".to_string(),
            subscription: "Subscription".to_string(),
        }
    }
}

impl RootTypes {
    fn operation_types_for_type(&self, type_name: &str) -> Vec<OperationType> {
        let mut operation_types = Vec::new();

        if self.query == type_name {
            operation_types.push(OperationType::Query);
        }
        if self.mutation == type_name {
            operation_types.push(OperationType::Mutation);
        }
        if self.subscription == type_name {
            operation_types.push(OperationType::Subscription);
        }

        operation_types
    }

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
            operation_error("Unknown GraphQL operation type".to_string())
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

    let mut root_types = RootTypes::default();

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

fn collect_schema_operations_from_object(
    name: Option<cst::Name>,
    fields_definition: Option<cst::FieldsDefinition>,
    root_types: &RootTypes,
    operations: &mut Vec<SchemaOperation>,
) -> Result<(), WesleyError> {
    let type_name = type_node_name(name, "Object type missing name")?;
    let operation_types = root_types.operation_types_for_type(&type_name);
    if operation_types.is_empty() {
        return Ok(());
    }

    let Some(fields_definition) = fields_definition else {
        return Ok(());
    };

    for field_def in fields_definition.field_definitions() {
        for operation_type in &operation_types {
            operations.push(schema_operation_from_field(
                *operation_type,
                &type_name,
                field_def.clone(),
            )?);
        }
    }

    Ok(())
}

fn schema_operation_from_field(
    operation_type: OperationType,
    root_type_name: &str,
    field_def: cst::FieldDefinition,
) -> Result<SchemaOperation, WesleyError> {
    let field_name = field_def
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| {
            lowering_error_value("schema operation", "Root field missing name".into())
        })?;
    let result_type = field_def.ty().ok_or_else(|| {
        lowering_error_value(
            "schema operation",
            format!("Root field '{field_name}' missing result type"),
        )
    })?;

    let mut directives = IndexMap::new();
    if let Some(dirs) = field_def.directives() {
        ApolloLoweringAdapter::new(0).extract_directives(dirs, &mut directives)?;
    }

    Ok(SchemaOperation {
        operation_type,
        root_type_name: root_type_name.to_string(),
        field_name,
        arguments: operation_arguments_from_definition(field_def.arguments_definition())?,
        result_type: type_reference_from_type(result_type, true)?,
        directives,
    })
}

fn operation_arguments_from_definition(
    arguments_definition: Option<cst::ArgumentsDefinition>,
) -> Result<Vec<OperationArgument>, WesleyError> {
    let Some(arguments_definition) = arguments_definition else {
        return Ok(Vec::new());
    };

    arguments_definition
        .input_value_definitions()
        .map(operation_argument_from_input_value)
        .collect()
}

fn operation_argument_from_input_value(
    input_value: cst::InputValueDefinition,
) -> Result<OperationArgument, WesleyError> {
    let name = input_value
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| {
            lowering_error_value("schema operation", "Operation argument missing name".into())
        })?;
    let type_node = input_value.ty().ok_or_else(|| {
        lowering_error_value(
            "schema operation",
            format!("Operation argument '{name}' missing type"),
        )
    })?;
    let default_value = input_value
        .default_value()
        .and_then(|default_value| default_value.value())
        .map(directive_value_to_json)
        .transpose()?;

    let mut directives = IndexMap::new();
    if let Some(dirs) = input_value.directives() {
        ApolloLoweringAdapter::new(0).extract_directives(dirs, &mut directives)?;
    }

    Ok(OperationArgument {
        name,
        r#type: type_reference_from_type(type_node, true)?,
        default_value,
        directives,
    })
}

fn update_root_types(
    root_defs: cst::CstChildren<cst::RootOperationTypeDefinition>,
    root_types: &mut RootTypes,
) -> Result<(), WesleyError> {
    for root_def in root_defs {
        let operation_type = root_def.operation_type().ok_or_else(|| {
            operation_error_value("Schema root operation missing operation type".to_string())
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
        .ok_or_else(|| operation_error_value("Fragment definition missing name".to_string()))
}

fn fragment_type_condition(fragment: &cst::FragmentDefinition) -> Result<String, WesleyError> {
    let type_condition = fragment.type_condition().ok_or_else(|| {
        operation_error_value("Fragment definition missing type condition".to_string())
    })?;
    named_type_name(
        type_condition.named_type(),
        "Fragment definition missing type condition",
    )
}

fn validate_fragment_type_condition(
    parent_type: &str,
    condition_type: &str,
    schema: &SchemaIndex<'_>,
    context: &str,
) -> Result<(), WesleyError> {
    let parent_possible = schema.possible_runtime_types(parent_type)?;
    let condition_possible = schema.possible_runtime_types(condition_type)?;

    if parent_possible.is_disjoint(&condition_possible) {
        return operation_error(format!(
            "Fragment '{context}' type condition '{condition_type}' cannot apply to parent type '{parent_type}'"
        ));
    }

    Ok(())
}

fn named_type_name(name: Option<cst::NamedType>, message: &str) -> Result<String, WesleyError> {
    name.and_then(|named_type| named_type.name())
        .map(|name| name.text().to_string())
        .ok_or_else(|| operation_error_value(message.to_string()))
}

fn required_name(name: Option<cst::Name>, message: &str) -> Result<String, WesleyError> {
    name.map(|name| name.text().to_string())
        .ok_or_else(|| operation_error_value(message.to_string()))
}

fn operation_error<T>(message: String) -> Result<T, WesleyError> {
    Err(operation_error_value(message))
}

fn operation_error_value(message: String) -> WesleyError {
    WesleyError::LoweringError {
        message,
        area: "operation".to_string(),
    }
}
