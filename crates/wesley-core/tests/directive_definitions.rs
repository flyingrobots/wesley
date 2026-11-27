//! Directive definitions in the L1 IR, and the lowering checks that hold
//! directive usages to them.
//!
//! Oracle: the GraphQL specification (October 2021 and later), sections 3.13
//! "Directives" and 5.7 "Directives" / 5.6 "Values" of the validation rules,
//! for what a lawful usage is; the committed L1 fixtures for what a schema
//! without directive definitions lowers to.

use std::fs;
use std::path::PathBuf;

use indexmap::IndexMap;
use serde_json::json;
use wesley_core::{
    compute_registry_hash, lower_schema_sdl, to_canonical_json, DirectiveDefinition,
    DirectiveLocation, FieldArgument, TypeReference, WesleyError, WesleyIR,
};

fn lower(sdl: &str) -> WesleyIR {
    match lower_schema_sdl(sdl) {
        Ok(ir) => ir,
        Err(error) => panic!("schema should lower, got {error:?}"),
    }
}

fn lowering_refusal(sdl: &str) -> String {
    match lower_schema_sdl(sdl) {
        Err(WesleyError::LoweringError { message, area }) => {
            assert_eq!(
                area, "directive",
                "refusal came from the wrong area: {message}"
            );
            message
        }
        other => panic!("expected a directive lowering error, got {other:?}"),
    }
}

fn scalar(base: &str, nullable: bool) -> TypeReference {
    TypeReference {
        base: base.to_string(),
        nullable,
        is_list: false,
        list_item_nullable: None,
        list_wrappers: Vec::new(),
        leaf_nullable: None,
    }
}

#[test]
fn lowering_rejects_a_directive_used_at_a_location_its_definition_does_not_list() {
    let message = lowering_refusal(
        "directive @retry(max: Int!) on FIELD_DEFINITION\n\
         type A @retry(max: 1) { id: ID }",
    );

    assert_eq!(
        message,
        "directive '@retry' is not allowed at OBJECT 'A'; declared locations: FIELD_DEFINITION"
    );
}

#[test]
fn lowering_holds_directives_on_type_extensions_to_their_definitions() {
    let message = lowering_refusal(
        "directive @retry(max: Int!) on OBJECT\n\
         type A { id: ID }\n\
         extend type A { name: String @retry(max: 1) }",
    );

    assert_eq!(
        message,
        "directive '@retry' is not allowed at FIELD_DEFINITION 'A.name'; declared locations: OBJECT"
    );
}

#[test]
fn lowering_holds_built_in_directives_to_their_specified_locations() {
    let message = lowering_refusal("type A @specifiedBy(url: \"https://example.com\") { id: ID }");

    assert_eq!(
        message,
        "directive '@specifiedBy' is not allowed at OBJECT 'A'; declared locations: SCALAR"
    );
}

#[test]
fn lowering_rejects_an_argument_the_definition_does_not_declare() {
    let message = lowering_refusal(
        "directive @retry(max: Int!) on OBJECT\n\
         type A @retry(max: 1, backoff: 2) { id: ID }",
    );

    assert_eq!(
        message,
        "directive '@retry' at OBJECT 'A' has undeclared argument 'backoff'"
    );
}

#[test]
fn lowering_rejects_a_usage_that_omits_a_required_argument() {
    let message = lowering_refusal(
        "directive @retry(max: Int!) on OBJECT\n\
         type B @retry { id: ID }",
    );

    assert_eq!(
        message,
        "directive '@retry' at OBJECT 'B' is missing required argument 'max' of type 'Int!'"
    );
}

#[test]
fn lowering_rejects_directive_argument_literals_that_do_not_fit_the_declared_type() {
    let prelude = "enum Level { LOW HIGH }\n\
         input Window { from: Int!, to: Int }\n\
         directive @retry(max: Int!) on OBJECT\n\
         directive @ratio(value: Float) on OBJECT\n\
         directive @flag(on: Boolean) on OBJECT\n\
         directive @named(id: ID, label: String) on OBJECT\n\
         directive @audit(level: Level!) on OBJECT\n\
         directive @tags(names: [String!]!) on OBJECT\n\
         directive @window(range: Window) on OBJECT\n";
    let cases = [
        (
            "@retry(max: \"five\")",
            "directive '@retry' at OBJECT 'A' argument 'max' expects 'Int!' but received a String value",
        ),
        (
            "@retry(max: 2.5)",
            "directive '@retry' at OBJECT 'A' argument 'max' expects 'Int!' but received a Float value",
        ),
        (
            "@retry(max: 3000000000)",
            "directive '@retry' at OBJECT 'A' argument 'max' expects 'Int!' but received an integer outside the 32-bit range",
        ),
        (
            "@retry(max: null)",
            "directive '@retry' at OBJECT 'A' argument 'max' expects 'Int!' but received null",
        ),
        (
            "@ratio(value: \"1.5\")",
            "directive '@ratio' at OBJECT 'A' argument 'value' expects 'Float' but received a String value",
        ),
        (
            "@flag(on: 1)",
            "directive '@flag' at OBJECT 'A' argument 'on' expects 'Boolean' but received an Int value",
        ),
        (
            "@named(id: true)",
            "directive '@named' at OBJECT 'A' argument 'id' expects 'ID' but received a Boolean value",
        ),
        (
            "@named(label: LOW)",
            "directive '@named' at OBJECT 'A' argument 'label' expects 'String' but received an enum value",
        ),
        (
            "@audit(level: MEDIUM)",
            "directive '@audit' at OBJECT 'A' argument 'level' received unknown enum value 'MEDIUM' for 'Level'",
        ),
        (
            "@audit(level: \"LOW\")",
            "directive '@audit' at OBJECT 'A' argument 'level' expects 'Level!' but received a String value",
        ),
        (
            "@tags(names: [\"a\", 1])",
            "directive '@tags' at OBJECT 'A' argument 'names' expects 'String!' but received an Int value",
        ),
        (
            "@tags(names: [\"a\", null])",
            "directive '@tags' at OBJECT 'A' argument 'names' expects 'String!' but received null",
        ),
        (
            "@window(range: [1])",
            "directive '@window' at OBJECT 'A' argument 'range' expects 'Window' but received a list value",
        ),
        (
            "@window(range: { to: 2 })",
            "directive '@window' at OBJECT 'A' argument 'range' is missing required input field 'from' of type 'Int!'",
        ),
        (
            "@window(range: { from: 1, until: 2 })",
            "directive '@window' at OBJECT 'A' argument 'range' has undeclared input field 'until'",
        ),
    ];

    for (usage, expected) in cases {
        let sdl = format!("{prelude}type A {usage} {{ id: ID }}");
        assert_eq!(lowering_refusal(&sdl), expected, "usage {usage}");
    }
}

#[test]
fn lowering_accepts_directive_argument_literals_the_specification_coerces() {
    let sdl = "directive @ratio(value: Float!) on OBJECT\n\
         directive @named(id: ID!) on OBJECT\n\
         directive @tags(names: [String!]!) on OBJECT\n\
         type A @ratio(value: 2) @named(id: 7) @tags(names: \"solo\") { id: ID }";

    let ir = lower(sdl);
    let directives = &ir.types[0].directives;

    assert_eq!(directives["ratio"], json!({ "value": 2 }));
    assert_eq!(directives["named"], json!({ "id": 7 }));
    assert_eq!(directives["tags"], json!({ "names": "solo" }));
}

#[test]
fn a_repeatable_directive_may_be_used_twice_at_one_site() {
    let ir = lower(
        "directive @tag(name: String!) repeatable on FIELD_DEFINITION\n\
         type A { id: ID @tag(name: \"x\") @tag(name: \"y\") }",
    );

    assert_eq!(
        ir.types[0].fields[0].directives["tag"],
        json!([{ "name": "x" }, { "name": "y" }])
    );
}

#[test]
fn a_non_repeatable_directive_used_twice_on_an_enum_value_is_rejected() {
    let message = lowering_refusal(
        "directive @wire(value: String!) on ENUM_VALUE\n\
         enum Mode { WHAT_RAN @wire(value: \"a\") @wire(value: \"b\") }",
    );

    assert_eq!(
        message,
        "duplicate non-repeatable directive '@wire' at ENUM_VALUE 'Mode.WHAT_RAN'"
    );
}

#[test]
fn an_omitted_argument_with_a_default_is_accepted_and_the_default_lives_on_the_definition() {
    let ir = lower(
        "directive @retry(max: Int! = 3) on OBJECT\n\
         type A @retry { id: ID }",
    );

    assert_eq!(ir.types[0].directives["retry"], json!(true));
    assert_eq!(
        ir.directive_definitions,
        vec![DirectiveDefinition {
            name: "retry".to_string(),
            description: None,
            arguments: vec![FieldArgument {
                name: "max".to_string(),
                description: None,
                r#type: scalar("Int", false),
                default_value: Some(json!(3)),
                directives: IndexMap::new(),
            }],
            locations: vec![DirectiveLocation::Object],
            repeatable: false,
        }]
    );
}

#[test]
fn directive_definitions_are_recorded_in_canonical_order_whatever_the_source_order() {
    let first = "\"Retries the type\"\n\
         directive @retry(max: Int = 3) repeatable on OBJECT | FIELD_DEFINITION\n\
         directive @audit on FIELD_DEFINITION | INTERFACE | OBJECT\n\
         type A @retry @audit { id: ID @retry(max: 1) }";
    let second = "directive @audit on OBJECT | INTERFACE | FIELD_DEFINITION\n\
         \"Retries the type\"\n\
         directive @retry(max: Int = 3) repeatable on FIELD_DEFINITION | OBJECT\n\
         type A @retry @audit { id: ID @retry(max: 1) }";

    let first_ir = lower(first);
    let second_ir = lower(second);

    assert_eq!(first_ir, second_ir);
    assert_eq!(
        compute_registry_hash(&first_ir).ok(),
        compute_registry_hash(&second_ir).ok()
    );
    let summary = first_ir
        .directive_definitions
        .iter()
        .map(|definition| {
            (
                definition.name.as_str(),
                definition.description.as_deref(),
                definition.locations.clone(),
                definition.repeatable,
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(
        summary,
        vec![
            (
                "audit",
                None,
                vec![
                    DirectiveLocation::FieldDefinition,
                    DirectiveLocation::Interface,
                    DirectiveLocation::Object,
                ],
                false,
            ),
            (
                "retry",
                Some("Retries the type"),
                vec![
                    DirectiveLocation::FieldDefinition,
                    DirectiveLocation::Object
                ],
                true,
            ),
        ]
    );
}

#[test]
fn a_core_directive_alias_definition_is_recorded_under_its_canonical_name() {
    let ir = lower(
        "directive @table(name: String) on OBJECT\n\
         type A @table(name: \"a\") { id: ID }",
    );

    let names = ir
        .directive_definitions
        .iter()
        .map(|definition| definition.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(names, vec!["wes_table"]);
}

#[test]
fn directive_definitions_are_serialized_as_directive_definitions_and_hashed() {
    let three = lower("directive @retry(max: Int = 3) on OBJECT\ntype A @retry { id: ID }");
    let four = lower("directive @retry(max: Int = 4) on OBJECT\ntype A @retry { id: ID }");

    let serialized = match serde_json::to_value(&three) {
        Ok(value) => value,
        Err(error) => panic!("IR should serialize: {error}"),
    };
    assert_eq!(
        serialized["directiveDefinitions"],
        json!([{
            "name": "retry",
            "arguments": [{
                "name": "max",
                "type": { "base": "Int", "nullable": true, "isList": false },
                "defaultValue": 3,
                "directives": {}
            }],
            "locations": ["OBJECT"],
            "repeatable": false
        }])
    );
    assert_ne!(
        compute_registry_hash(&three).ok(),
        compute_registry_hash(&four).ok()
    );
}

#[test]
fn schemas_without_directive_definitions_lower_to_the_committed_l1_fixtures() {
    let fixture_dir =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/ir-parity");
    let mut schemas = match fs::read_dir(&fixture_dir) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension()
                    .is_some_and(|extension| extension == "graphql")
            })
            .collect::<Vec<_>>(),
        Err(error) => panic!("fixture directory should be readable: {error}"),
    };
    schemas.sort();

    let mut checked = 0_usize;
    for schema in &schemas {
        let read = |path: PathBuf| match fs::read_to_string(&path) {
            Ok(text) => text,
            Err(error) => panic!("{} should be readable: {error}", path.display()),
        };
        let ir = lower(&read(schema.clone()));
        assert!(ir.directive_definitions.is_empty(), "{}", schema.display());

        let expected_json: serde_json::Value =
            match serde_json::from_str(&read(schema.with_extension("l1.json"))) {
                Ok(value) => value,
                Err(error) => panic!("{} fixture JSON should parse: {error}", schema.display()),
            };
        assert_eq!(
            to_canonical_json(&ir).ok(),
            to_canonical_json(&expected_json).ok(),
            "{}",
            schema.display()
        );
        assert_eq!(
            compute_registry_hash(&ir).ok(),
            Some(read(schema.with_extension("l1.hash")).trim().to_string()),
            "{}",
            schema.display()
        );
        checked += 1;
    }

    assert_eq!(checked, schemas.len());
    assert!(checked >= 7, "checked {checked} fixtures");
}
