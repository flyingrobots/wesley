//! Reads directive definitions from a parsed schema document into the L1 IR,
//! and supplies the definitions of the GraphQL built-in directives.

use super::{
    argument_parts_from_input_value, description_from, lowering_error_value,
    parse_error_from_apollo,
};
use crate::domain::error::WesleyError;
use crate::domain::ir::{DirectiveDefinition, DirectiveLocation, FieldArgument};
use apollo_parser::cst::{self, CstNode};
use apollo_parser::Parser;
use std::collections::{BTreeMap, BTreeSet};

/// Directive definitions keyed by canonical name. Iteration is in name order,
/// which is the order the IR records them in.
pub(super) type DirectiveDefinitions = BTreeMap<String, DirectiveDefinition>;

/// The directives the GraphQL specification defines, with the arguments and
/// locations it gives them. `@skip` and `@include` are executable-only, so any
/// use of them in a schema document is at a location they do not allow.
const BUILT_IN_DIRECTIVES_SDL: &str = r#"
directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE
directive @specifiedBy(url: String!) on SCALAR
directive @oneOf on INPUT_OBJECT
directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
"#;

/// Lowers every directive definition in `doc`.
///
/// `repeatable` is the set of repeatable directive names, used for any
/// directives written on the definitions' own arguments.
///
/// # Errors
///
/// Returns a lowering error when two definitions share a canonical name, when
/// a definition repeats an argument or a location, or when a definition is
/// missing a name, an argument type, or its locations.
pub(super) fn directive_definitions_from_document(
    doc: &cst::Document,
    repeatable: &BTreeSet<String>,
) -> Result<DirectiveDefinitions, WesleyError> {
    let mut definitions = DirectiveDefinitions::new();
    for definition in doc.definitions() {
        let cst::Definition::DirectiveDefinition(directive) = definition else {
            continue;
        };
        let lowered = directive_definition_from_node(&directive, repeatable)?;
        if definitions.contains_key(&lowered.name) {
            return Err(lowering_error_value(
                "directive",
                format!("duplicate directive definition '@{}'", lowered.name),
            ));
        }
        definitions.insert(lowered.name.clone(), lowered);
    }

    Ok(definitions)
}

/// Returns the definitions of the GraphQL built-in directives.
///
/// # Errors
///
/// Returns an error only if the built-in definitions themselves fail to parse
/// or lower, which the test suite rules out.
pub(super) fn built_in_directive_definitions() -> Result<DirectiveDefinitions, WesleyError> {
    let cst = Parser::new(BUILT_IN_DIRECTIVES_SDL).parse();
    if let Some(error) = cst.errors().next() {
        return Err(parse_error_from_apollo(BUILT_IN_DIRECTIVES_SDL, error));
    }

    directive_definitions_from_document(&cst.document(), &BTreeSet::new())
}

fn directive_definition_from_node(
    directive: &cst::DirectiveDefinition,
    repeatable: &BTreeSet<String>,
) -> Result<DirectiveDefinition, WesleyError> {
    let name = directive
        .name()
        .map(|name| name.text().to_string())
        .ok_or_else(|| {
            lowering_error_value("directive", "Directive definition missing name".to_string())
        })?;
    let canonical_name = name;

    Ok(DirectiveDefinition {
        arguments: directive_arguments(directive, &canonical_name, repeatable)?,
        locations: directive_locations(directive, &canonical_name)?,
        description: description_from(directive.description()),
        repeatable: directive.repeatable_token().is_some(),
        name: canonical_name,
    })
}

fn directive_arguments(
    directive: &cst::DirectiveDefinition,
    directive_name: &str,
    repeatable: &BTreeSet<String>,
) -> Result<Vec<FieldArgument>, WesleyError> {
    let Some(arguments_definition) = directive.arguments_definition() else {
        return Ok(Vec::new());
    };

    let mut arguments: Vec<FieldArgument> = Vec::new();
    for input_value in arguments_definition.input_value_definitions() {
        let parts = argument_parts_from_input_value(
            input_value,
            "directive",
            "Directive argument missing name",
            |argument| format!("Directive '@{directive_name}' argument '{argument}' missing type"),
            repeatable,
        )?;
        if arguments.iter().any(|argument| argument.name == parts.name) {
            return Err(lowering_error_value(
                "directive",
                format!(
                    "directive definition '@{directive_name}' repeats argument '{}'",
                    parts.name
                ),
            ));
        }
        arguments.push(FieldArgument {
            name: parts.name,
            description: parts.description,
            r#type: parts.r#type,
            default_value: parts.default_value,
            directives: parts.directives,
        });
    }

    Ok(arguments)
}

fn directive_locations(
    directive: &cst::DirectiveDefinition,
    directive_name: &str,
) -> Result<Vec<DirectiveLocation>, WesleyError> {
    let mut locations = BTreeSet::new();
    let declared = directive
        .directive_locations()
        .map(|locations| locations.directive_locations());
    for location in declared.into_iter().flatten() {
        let text = location.syntax().text().to_string();
        let spelling = text.trim();
        let parsed = DirectiveLocation::from_graphql_name(spelling).ok_or_else(|| {
            lowering_error_value(
                "directive",
                format!(
                    "directive definition '@{directive_name}' names unknown location '{spelling}'"
                ),
            )
        })?;
        if !locations.insert(parsed) {
            return Err(lowering_error_value(
                "directive",
                format!("directive definition '@{directive_name}' repeats location {spelling}"),
            ));
        }
    }
    if locations.is_empty() {
        return Err(lowering_error_value(
            "directive",
            format!("directive definition '@{directive_name}' declares no locations"),
        ));
    }

    Ok(locations.into_iter().collect())
}
