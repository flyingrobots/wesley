//! Holds every directive usage in a schema document to the definition it
//! names: used at a location it allows, given only declared, well-typed
//! arguments with every required one present, and repeated at one site only
//! when its definition is repeatable.
//!
//! Definitions come from the document itself, then from the GraphQL built-ins.
//! A directive with neither, including a Wesley core directive (see
//! `canonical_core_directive_name`) the document does not define, passes
//! through unchecked apart from repetition: there is no definition to hold it
//! to, and schemas that take their directive definitions from elsewhere rely
//! on that.

use super::directive_definitions::{built_in_directive_definitions, DirectiveDefinitions};
use super::directive_literal::{check_literal, InputType, TypeIndex};
use super::{canonical_core_directive_name, lowering_error_value};
use crate::domain::error::WesleyError;
use crate::domain::ir::{
    DirectiveDefinition, DirectiveLocation, FieldArgument, TypeDefinition, TypeKind,
};
use apollo_parser::cst;
use std::collections::{BTreeMap, BTreeSet};

/// Checks every directive usage in `doc` against `declared`, the document's
/// own directive definitions, and against the built-in directives.
///
/// `types` are the document's lowered types, used to check argument literals
/// and the argument types and defaults of each definition.
///
/// # Errors
///
/// Returns a lowering error in the `directive` area naming the directive and
/// the site of the first unlawful usage or definition found.
pub(super) fn check_directive_usages(
    doc: &cst::Document,
    declared: &DirectiveDefinitions,
    types: &[TypeDefinition],
) -> Result<(), WesleyError> {
    let built_in = built_in_directive_definitions()?;
    let type_index = types
        .iter()
        .map(|definition| (definition.name.as_str(), definition))
        .collect::<TypeIndex<'_>>();
    let mut checker = UsageChecker {
        declared,
        built_in: &built_in,
        types: &type_index,
        seen: BTreeMap::new(),
    };

    doc.definitions()
        .try_for_each(|definition| checker.check_definition(definition))
}

/// One place a directive can be written: a location and the schema
/// coordinate of the thing it is written on.
struct Site {
    location: DirectiveLocation,
    coordinate: String,
}

impl Site {
    fn named(location: DirectiveLocation, name: Option<cst::Name>) -> Result<Self, WesleyError> {
        Ok(Self {
            location,
            coordinate: required_name(name, "type")?,
        })
    }

    fn member(&self, location: DirectiveLocation, member: String) -> Self {
        Self {
            location,
            coordinate: format!("{}.{member}", self.coordinate),
        }
    }

    fn describe(&self) -> String {
        format!("{} '{}'", self.location.as_str(), self.coordinate)
    }
}

struct UsageChecker<'a> {
    declared: &'a DirectiveDefinitions,
    built_in: &'a DirectiveDefinitions,
    types: &'a TypeIndex<'a>,
    seen: BTreeMap<(DirectiveLocation, String), BTreeSet<String>>,
}

impl UsageChecker<'_> {
    fn check_definition(&mut self, definition: cst::Definition) -> Result<(), WesleyError> {
        use cst::Definition as D;
        use DirectiveLocation as L;

        match definition {
            D::SchemaDefinition(node) => self.check_site(node.directives(), &schema_site()),
            D::ScalarTypeDefinition(node) => {
                self.check_site(node.directives(), &Site::named(L::Scalar, node.name())?)
            }
            D::UnionTypeDefinition(node) => {
                self.check_site(node.directives(), &Site::named(L::Union, node.name())?)
            }
            D::ObjectTypeDefinition(node) => self.check_fields_owner(
                &Site::named(L::Object, node.name())?,
                node.directives(),
                node.fields_definition(),
            ),
            D::InterfaceTypeDefinition(node) => self.check_fields_owner(
                &Site::named(L::Interface, node.name())?,
                node.directives(),
                node.fields_definition(),
            ),
            D::EnumTypeDefinition(node) => self.check_enum(
                &Site::named(L::Enum, node.name())?,
                node.directives(),
                node.enum_values_definition(),
            ),
            D::InputObjectTypeDefinition(node) => self.check_input_object(
                &Site::named(L::InputObject, node.name())?,
                node.directives(),
                node.input_fields_definition(),
            ),
            D::DirectiveDefinition(node) => self.check_directive_definition(&node),
            D::OperationDefinition(_) | D::FragmentDefinition(_) => Ok(()),
            extension => self.check_extension(extension),
        }
    }

    /// Checks schema and type extensions, which take directives at the same
    /// locations as the definitions they extend.
    fn check_extension(&mut self, extension: cst::Definition) -> Result<(), WesleyError> {
        use cst::Definition as D;
        use DirectiveLocation as L;

        match extension {
            D::SchemaExtension(node) => self.check_site(node.directives(), &schema_site()),
            D::ScalarTypeExtension(node) => {
                self.check_site(node.directives(), &Site::named(L::Scalar, node.name())?)
            }
            D::UnionTypeExtension(node) => {
                self.check_site(node.directives(), &Site::named(L::Union, node.name())?)
            }
            D::ObjectTypeExtension(node) => self.check_fields_owner(
                &Site::named(L::Object, node.name())?,
                node.directives(),
                node.fields_definition(),
            ),
            D::InterfaceTypeExtension(node) => self.check_fields_owner(
                &Site::named(L::Interface, node.name())?,
                node.directives(),
                node.fields_definition(),
            ),
            D::EnumTypeExtension(node) => self.check_enum(
                &Site::named(L::Enum, node.name())?,
                node.directives(),
                node.enum_values_definition(),
            ),
            D::InputObjectTypeExtension(node) => self.check_input_object(
                &Site::named(L::InputObject, node.name())?,
                node.directives(),
                node.input_fields_definition(),
            ),
            // Definitions are dispatched by `check_definition`.
            _ => Ok(()),
        }
    }

    fn check_fields_owner(
        &mut self,
        owner: &Site,
        directives: Option<cst::Directives>,
        fields: Option<cst::FieldsDefinition>,
    ) -> Result<(), WesleyError> {
        self.check_site(directives, owner)?;
        for field in fields
            .iter()
            .flat_map(cst::FieldsDefinition::field_definitions)
        {
            let field_site = owner.member(
                DirectiveLocation::FieldDefinition,
                required_name(field.name(), "field")?,
            );
            self.check_site(field.directives(), &field_site)?;
            let arguments = field.arguments_definition();
            for argument in arguments
                .iter()
                .flat_map(cst::ArgumentsDefinition::input_value_definitions)
            {
                let argument_name = required_name(argument.name(), "field argument")?;
                let argument_site = Site {
                    location: DirectiveLocation::ArgumentDefinition,
                    coordinate: format!("{}({argument_name}:)", field_site.coordinate),
                };
                self.check_site(argument.directives(), &argument_site)?;
            }
        }
        Ok(())
    }

    fn check_enum(
        &mut self,
        owner: &Site,
        directives: Option<cst::Directives>,
        values: Option<cst::EnumValuesDefinition>,
    ) -> Result<(), WesleyError> {
        self.check_site(directives, owner)?;
        for value in values
            .iter()
            .flat_map(cst::EnumValuesDefinition::enum_value_definitions)
        {
            let name = required_name(value.enum_value().and_then(|v| v.name()), "enum value")?;
            let value_site = owner.member(DirectiveLocation::EnumValue, name);
            self.check_site(value.directives(), &value_site)?;
        }
        Ok(())
    }

    fn check_input_object(
        &mut self,
        owner: &Site,
        directives: Option<cst::Directives>,
        fields: Option<cst::InputFieldsDefinition>,
    ) -> Result<(), WesleyError> {
        self.check_site(directives, owner)?;
        for field in fields
            .iter()
            .flat_map(cst::InputFieldsDefinition::input_value_definitions)
        {
            let field_site = owner.member(
                DirectiveLocation::InputFieldDefinition,
                required_name(field.name(), "input field")?,
            );
            self.check_site(field.directives(), &field_site)?;
        }
        Ok(())
    }

    /// Checks the directives written on a definition's arguments, and that
    /// each argument has an input type and a default that fits it.
    fn check_directive_definition(
        &mut self,
        node: &cst::DirectiveDefinition,
    ) -> Result<(), WesleyError> {
        let written = required_name(node.name(), "directive definition")?;
        let name = canonical_core_directive_name(&written).unwrap_or(&written);
        let declared = self.declared;
        let Some(definition) = declared.get(name) else {
            return Err(directive_error(format!(
                "directive definition '@{name}' was not lowered"
            )));
        };
        let arguments = node.arguments_definition();
        for argument in arguments
            .iter()
            .flat_map(cst::ArgumentsDefinition::input_value_definitions)
        {
            let argument_name = required_name(argument.name(), "directive argument")?;
            let argument_site = Site {
                location: DirectiveLocation::ArgumentDefinition,
                coordinate: format!("@{name}({argument_name}:)"),
            };
            self.check_site(argument.directives(), &argument_site)?;
            let declared_argument = find_argument(definition, &argument_name)?;
            self.check_argument_type(name, declared_argument)?;
            if let Some(default) = argument.default_value().and_then(|value| value.value()) {
                let expected = InputType::from_reference(&declared_argument.r#type);
                check_literal(default, &expected, self.types).map_err(|fault| {
                    directive_error(format!(
                        "directive definition '@{name}' argument '{argument_name}' default {}",
                        fault.describe()
                    ))
                })?;
            }
        }
        Ok(())
    }

    fn check_argument_type(
        &self,
        directive_name: &str,
        argument: &FieldArgument,
    ) -> Result<(), WesleyError> {
        let base = argument.r#type.base.as_str();
        if matches!(base, "Int" | "Float" | "String" | "Boolean" | "ID") {
            return Ok(());
        }
        match self.types.get(base).map(|definition| definition.kind) {
            Some(TypeKind::Scalar | TypeKind::Enum | TypeKind::InputObject) => Ok(()),
            Some(_) => Err(directive_error(format!(
                "directive definition '@{directive_name}' argument '{}' has non-input type '{base}'",
                argument.name
            ))),
            None => Err(directive_error(format!(
                "directive definition '@{directive_name}' argument '{}' has unknown type '{base}'",
                argument.name
            ))),
        }
    }

    fn check_site(
        &mut self,
        directives: Option<cst::Directives>,
        site: &Site,
    ) -> Result<(), WesleyError> {
        for directive in directives.iter().flat_map(cst::Directives::directives) {
            self.check_usage(&directive, site)?;
        }
        Ok(())
    }

    fn check_usage(&mut self, directive: &cst::Directive, site: &Site) -> Result<(), WesleyError> {
        let written = required_name(directive.name(), "directive")?;
        let core_name = canonical_core_directive_name(&written);
        let name = core_name.unwrap_or(&written).to_string();
        let definition = self
            .declared
            .get(&name)
            .or_else(|| self.built_in.get(&name));

        let repeatable = match definition {
            Some(definition) => {
                check_location(&name, definition, site)?;
                self.check_arguments(&name, directive, definition, site)?;
                // Core directives never repeat, matching how lowering stores them.
                core_name.is_none() && definition.repeatable
            }
            // Wesley's shared directive pack defines `wes_*` directives outside
            // the schema document, and the core aliases predate it, so those
            // pass through unchecked. Like any undeclared directive they may
            // not repeat. Anything else undeclared is unknown.
            None if core_name.is_some() || in_wesley_namespace(&name) => false,
            None => {
                return Err(directive_error(format!(
                    "directive '@{name}' at {} is not defined; declare it with `directive @{name}` or use a GraphQL built-in or a `wes_` directive",
                    site.describe()
                )));
            }
        };

        self.check_repetition(name, repeatable, site)
    }

    fn check_arguments(
        &self,
        name: &str,
        directive: &cst::Directive,
        definition: &DirectiveDefinition,
        site: &Site,
    ) -> Result<(), WesleyError> {
        let at = format!("directive '@{name}' at {}", site.describe());
        let mut supplied = BTreeSet::new();
        let arguments = directive.arguments();
        for argument in arguments.iter().flat_map(cst::Arguments::arguments) {
            let argument_name = required_name(argument.name(), "directive argument")?;
            let Some(declared) = definition
                .arguments
                .iter()
                .find(|candidate| candidate.name == argument_name)
            else {
                return Err(directive_error(format!(
                    "{at} has undeclared argument '{argument_name}'"
                )));
            };
            if !supplied.insert(argument_name.clone()) {
                return Err(directive_error(format!(
                    "{at} repeats argument '{argument_name}'"
                )));
            }
            let value = argument.value().ok_or_else(|| {
                directive_error(format!("{at} argument '{argument_name}' has no value"))
            })?;
            let expected = InputType::from_reference(&declared.r#type);
            check_literal(value, &expected, self.types).map_err(|fault| {
                directive_error(format!(
                    "{at} argument '{argument_name}' {}",
                    fault.describe()
                ))
            })?;
        }

        let missing = definition.arguments.iter().find(|argument| {
            !argument.r#type.nullable
                && argument.default_value.is_none()
                && !supplied.contains(&argument.name)
        });
        match missing {
            Some(argument) => Err(directive_error(format!(
                "{at} is missing required argument '{}' of type '{}'",
                argument.name,
                InputType::from_reference(&argument.r#type).render()
            ))),
            None => Ok(()),
        }
    }

    fn check_repetition(
        &mut self,
        name: String,
        repeatable: bool,
        site: &Site,
    ) -> Result<(), WesleyError> {
        let used = self
            .seen
            .entry((site.location, site.coordinate.clone()))
            .or_default();
        if !used.insert(name.clone()) && !repeatable {
            return Err(directive_error(format!(
                "duplicate non-repeatable directive '@{name}' at {}",
                site.describe()
            )));
        }
        Ok(())
    }
}

/// Whether a directive name belongs to Wesley's reserved directive namespace.
fn in_wesley_namespace(name: &str) -> bool {
    name.starts_with("wes_") || name.starts_with("wesley_")
}

fn check_location(
    name: &str,
    definition: &DirectiveDefinition,
    site: &Site,
) -> Result<(), WesleyError> {
    if definition.locations.contains(&site.location) {
        return Ok(());
    }
    let declared = definition
        .locations
        .iter()
        .map(|location| location.as_str())
        .collect::<Vec<_>>()
        .join(" | ");
    Err(directive_error(format!(
        "directive '@{name}' is not allowed at {}; declared locations: {declared}",
        site.describe()
    )))
}

fn find_argument<'d>(
    definition: &'d DirectiveDefinition,
    argument_name: &str,
) -> Result<&'d FieldArgument, WesleyError> {
    definition
        .arguments
        .iter()
        .find(|argument| argument.name == argument_name)
        .ok_or_else(|| {
            directive_error(format!(
                "directive definition '@{}' argument '{argument_name}' was not lowered",
                definition.name
            ))
        })
}

fn schema_site() -> Site {
    Site {
        location: DirectiveLocation::Schema,
        coordinate: "schema".to_string(),
    }
}

fn required_name(name: Option<cst::Name>, what: &str) -> Result<String, WesleyError> {
    name.map(|name| name.text().to_string())
        .ok_or_else(|| directive_error(format!("{what} is missing a name")))
}

fn directive_error(message: String) -> WesleyError {
    lowering_error_value("directive", message)
}
