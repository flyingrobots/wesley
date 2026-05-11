use indexmap::IndexMap;
use wesley_core::{
    extract_operation_directive_args, list_schema_operations_sdl, resolve_operation_selections,
    resolve_operation_selections_with_schema, OperationDirectiveArgs, OperationType, WesleyError,
};

#[test]
fn resolves_nested_response_path_selections() {
    let selections = resolve_operation_selections(
        r#"
        mutation AdmitChange {
          admitChange(input: { id: "change-1" }) {
            receipt {
              id
              status
            }
          }
          viewer {
            id
          }
        }
        "#,
    )
    .expect("operation selections should resolve");

    assert_eq!(
        selections,
        vec![
            "admitChange".to_string(),
            "admitChange.receipt".to_string(),
            "admitChange.receipt.id".to_string(),
            "admitChange.receipt.status".to_string(),
            "viewer".to_string(),
            "viewer.id".to_string(),
        ]
    );
}

#[test]
fn expands_fragments_and_inline_fragments() {
    let selections = resolve_operation_selections(
        r#"
        query NodeView {
          node(id: "n1") {
            ...NodeFields
            ... on Issue {
              title
            }
          }
        }

        fragment NodeFields on Node {
          id
        }
        "#,
    )
    .expect("operation selections should resolve");

    assert_eq!(
        selections,
        vec![
            "node".to_string(),
            "node.id".to_string(),
            "node.title".to_string(),
        ]
    );
}

#[test]
fn records_schema_field_names_instead_of_aliases() {
    let selections = resolve_operation_selections(
        r#"
        query AliasedView {
          renamedViewer: viewer {
            profileId: id
          }
        }
        "#,
    )
    .expect("operation selections should resolve");

    assert_eq!(
        selections,
        vec!["viewer".to_string(), "viewer.id".to_string()]
    );
}

#[test]
fn resolves_schema_coordinate_selections() {
    let schema = r#"
        type Query {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
          receipt: Receipt!
        }

        type Receipt {
          status: String!
        }
    "#;
    let operation = r#"
        query SchemaAware {
          viewer {
            id
            receipt {
              status
            }
          }
        }
    "#;

    let selections = resolve_operation_selections_with_schema(schema, operation)
        .expect("schema-aware operation selections should resolve");

    assert_eq!(
        selections,
        vec![
            "Query.viewer".to_string(),
            "Viewer.id".to_string(),
            "Viewer.receipt".to_string(),
            "Receipt.status".to_string(),
        ]
    );
}

#[test]
fn uses_schema_declared_root_operation_types() {
    let schema = r#"
        schema {
          query: RootQuery
        }

        type RootQuery {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
        }
    "#;
    let operation = r#"
        query Rooted {
          viewer {
            id
          }
        }
    "#;

    let selections = resolve_operation_selections_with_schema(schema, operation)
        .expect("schema-aware operation selections should resolve");

    assert_eq!(
        selections,
        vec!["RootQuery.viewer".to_string(), "Viewer.id".to_string()]
    );
}

#[test]
fn lists_schema_operations_with_arguments_results_and_directives() {
    let operations = list_schema_operations_sdl(
        r#"
        schema {
          query: RootQuery
          mutation: RootMutation
        }

        type RootMutation {
          makeThing(
            input: MakeThingInput!
            dryRun: Boolean = false @argPolicy(scope: PUBLIC)
          ): MakeThingResult!
            @wes_op(name: "makeThing")
            @tag
        }

        type RootQuery {
          thing(id: ID!): Thing
        }

        input MakeThingInput {
          name: String!
        }

        type MakeThingResult {
          thing: Thing!
        }

        type Thing {
          id: ID!
        }
        "#,
    )
    .expect("schema operations should resolve");

    assert_eq!(operations.len(), 2);

    let make_thing = operations
        .iter()
        .find(|operation| operation.field_name == "makeThing")
        .expect("mutation operation should exist");
    assert_eq!(make_thing.operation_type, OperationType::Mutation);
    assert_eq!(make_thing.root_type_name, "RootMutation");
    assert_eq!(make_thing.result_type.base, "MakeThingResult");
    assert!(!make_thing.result_type.nullable);
    assert_eq!(make_thing.arguments.len(), 2);
    assert_eq!(make_thing.arguments[0].name, "input");
    assert_eq!(make_thing.arguments[0].r#type.base, "MakeThingInput");
    assert!(!make_thing.arguments[0].r#type.nullable);
    assert_eq!(make_thing.arguments[1].name, "dryRun");
    assert_eq!(
        make_thing.arguments[1].default_value,
        Some(serde_json::json!(false))
    );
    assert_eq!(
        make_thing.arguments[1].directives["argPolicy"]["scope"],
        serde_json::json!("PUBLIC")
    );
    assert_eq!(
        make_thing.directives["wes_op"]["name"],
        serde_json::json!("makeThing")
    );
    assert_eq!(make_thing.directives["tag"], serde_json::json!(true));

    let thing = operations
        .iter()
        .find(|operation| operation.field_name == "thing")
        .expect("query operation should exist");
    assert_eq!(thing.operation_type, OperationType::Query);
    assert_eq!(thing.root_type_name, "RootQuery");
    assert_eq!(thing.result_type.base, "Thing");
    assert!(thing.result_type.nullable);
    assert_eq!(thing.arguments[0].name, "id");
    assert_eq!(thing.arguments[0].r#type.base, "ID");
    assert!(!thing.arguments[0].r#type.nullable);
}

#[test]
fn lists_jedit_hot_text_runtime_schema_operations() {
    let operations = list_schema_operations_sdl(include_str!(
        "../../../test/fixtures/consumer-models/jedit-hot-text-runtime.graphql"
    ))
    .expect("jedit hot text runtime operations should resolve");

    assert_eq!(operations.len(), 5);

    let create_buffer = operations
        .iter()
        .find(|operation| operation.field_name == "createBufferWorldline")
        .expect("createBufferWorldline mutation should exist");
    assert_eq!(create_buffer.operation_type, OperationType::Mutation);
    assert_eq!(create_buffer.root_type_name, "Mutation");
    assert_eq!(create_buffer.arguments.len(), 1);
    assert_eq!(create_buffer.arguments[0].name, "input");
    assert_eq!(
        create_buffer.arguments[0].r#type.base,
        "CreateBufferWorldlineInput"
    );
    assert!(!create_buffer.arguments[0].r#type.nullable);
    assert_eq!(
        create_buffer.result_type.base,
        "CreateBufferWorldlineResult"
    );
    assert!(!create_buffer.result_type.nullable);
    assert_eq!(
        create_buffer.directives["wes_op"]["name"],
        serde_json::json!("createBufferWorldline")
    );
    assert_eq!(
        create_buffer.directives["wes_footprint"]["creates"][0],
        serde_json::json!("BufferWorldline")
    );

    let replace_range = operations
        .iter()
        .find(|operation| operation.field_name == "replaceRangeAsTick")
        .expect("replaceRangeAsTick mutation should exist");
    assert_eq!(replace_range.operation_type, OperationType::Mutation);
    assert_eq!(
        replace_range.arguments[0].r#type.base,
        "ReplaceRangeAsTickInput"
    );
    assert_eq!(replace_range.result_type.base, "ReplaceRangeAsTickResult");
    assert_eq!(
        replace_range.directives["wes_footprint"]["slots"][0]["bindFromArg"],
        serde_json::json!("input.worldlineId")
    );

    let text_window = operations
        .iter()
        .find(|operation| operation.field_name == "textWindow")
        .expect("textWindow query should exist");
    assert_eq!(text_window.operation_type, OperationType::Query);
    assert_eq!(text_window.root_type_name, "Query");
    assert_eq!(text_window.arguments[0].r#type.base, "TextWindowInput");
    assert_eq!(text_window.result_type.base, "TextWindowReading");
    assert_eq!(
        text_window.directives["wes_op"]["name"],
        serde_json::json!("textWindow")
    );
}

#[test]
fn lists_stack_witness_0001_fixture_artifact_shape() {
    let operations = list_schema_operations_sdl(include_str!(
        "../../../test/fixtures/consumer-models/stack-witness-0001-file-history.graphql"
    ))
    .expect("stack witness fixture operations should resolve");
    let vectors: serde_json::Value = serde_json::from_str(include_str!(
        "../../../test/fixtures/consumer-models/stack-witness-0001-vectors.json"
    ))
    .expect("stack witness fixture vectors should parse");

    assert_eq!(operations.len(), 3);
    assert_eq!(
        vectors["artifact"]["artifactId"],
        serde_json::json!("fixture-file-history-v0")
    );
    assert_eq!(
        vectors["artifact"]["schemaId"],
        serde_json::json!("stack-witness-0001.file-history.v0")
    );
    assert_eq!(
        vectors["artifact"]["familyId"],
        serde_json::json!("stack-witness-0001.file-history")
    );
    assert_eq!(vectors["artifact"]["version"], serde_json::json!("0"));
    assert_eq!(
        vectors["fixtureVarsEncoding"],
        serde_json::json!("utf8-semicolon-kv/v0")
    );
    assert_eq!(
        vectors["targetCodec"],
        serde_json::json!("wesley-binary/v0")
    );

    let create_buffer = operations
        .iter()
        .find(|operation| operation.field_name == "createBuffer")
        .expect("createBuffer mutation should exist");
    let create_buffer_vector = vector_for(&vectors, "createBuffer");
    assert_eq!(create_buffer.operation_type, OperationType::Mutation);
    assert_eq!(create_buffer.arguments[0].r#type.base, "CreateBufferInput");
    assert_eq!(create_buffer.result_type.base, "MutationReceipt");
    assert_eq!(
        create_buffer.directives["wes_artifact"]["artifactId"],
        vectors["artifact"]["artifactId"]
    );
    assert_artifact_identity_matches_vector(create_buffer, &vectors);
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["opId"],
        create_buffer_vector["opIdHex"]
    );
    assert_op_id_forms_agree(create_buffer_vector, STACK_WITNESS_CREATE_BUFFER_OP_ID);
    assert_eq!(
        create_buffer_vector["opIdDecimal"],
        serde_json::json!(STACK_WITNESS_CREATE_BUFFER_OP_ID)
    );
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["helperKind"],
        serde_json::json!("EINT")
    );
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["fixtureVarsEncoding"],
        vectors["fixtureVarsEncoding"]
    );
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["targetCodec"],
        vectors["targetCodec"]
    );
    assert_eq!(
        create_buffer_vector["helperShape"]["entrypoint"],
        serde_json::json!("dispatch_intent")
    );
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["fixtureVarsBytes"],
        create_buffer_vector["fixtureVarsBytes"]
    );
    assert_eq!(
        create_buffer.directives["wes_footprint"]["creates"],
        create_buffer_vector["declaredFootprint"]["creates"]
    );
    assert_declared_footprint_matches_vector(create_buffer, create_buffer_vector);
    assert_helper_shape(
        create_buffer_vector,
        "EINT",
        "dispatch_intent",
        &[
            "contract_artifact_id",
            "operation_id",
            "fixture_vars_bytes",
            "declared_footprint",
        ],
    );
    assert_eq!(
        create_buffer.directives["wes_stack_witness"]["fixtureVector"],
        serde_json::json!("stack-witness-0001-vectors.json#createBuffer")
    );

    let replace_range = operations
        .iter()
        .find(|operation| operation.field_name == "replaceRange")
        .expect("replaceRange mutation should exist");
    let replace_range_vector = vector_for(&vectors, "replaceRange");
    assert_eq!(replace_range.operation_type, OperationType::Mutation);
    assert_eq!(replace_range.arguments[0].r#type.base, "ReplaceRangeInput");
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["opId"],
        replace_range_vector["opIdHex"]
    );
    assert_artifact_identity_matches_vector(replace_range, &vectors);
    assert_op_id_forms_agree(replace_range_vector, STACK_WITNESS_REPLACE_RANGE_OP_ID);
    assert_eq!(
        replace_range_vector["opIdDecimal"],
        serde_json::json!(STACK_WITNESS_REPLACE_RANGE_OP_ID)
    );
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["fixtureVarsEncoding"],
        vectors["fixtureVarsEncoding"]
    );
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["targetCodec"],
        vectors["targetCodec"]
    );
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["fixtureVarsBytes"],
        replace_range_vector["fixtureVarsBytes"]
    );
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["fixtureVarsBytes"],
        serde_json::json!(
            "stack-witness-0001/replaceRange;bufferId=demo.txt;basis=B0;coord=utf8-bytes;start=0;end=0;text=hello;artifact=fixture-file-history-v0"
        )
    );
    assert_eq!(
        replace_range.directives["wes_footprint"]["reads"],
        replace_range_vector["declaredFootprint"]["reads"]
    );
    assert_eq!(
        replace_range.directives["wes_footprint"]["writes"],
        replace_range_vector["declaredFootprint"]["writes"]
    );
    assert_declared_footprint_matches_vector(replace_range, replace_range_vector);
    assert_helper_shape(
        replace_range_vector,
        "EINT",
        "dispatch_intent",
        &[
            "contract_artifact_id",
            "operation_id",
            "fixture_vars_bytes",
            "declared_footprint",
        ],
    );
    assert_eq!(
        replace_range.directives["wes_stack_witness"]["fixtureVector"],
        serde_json::json!("stack-witness-0001-vectors.json#replaceRange")
    );

    let text_window = operations
        .iter()
        .find(|operation| operation.field_name == "textWindow")
        .expect("textWindow query should exist");
    let text_window_vector = vector_for(&vectors, "textWindow");
    assert_eq!(text_window.operation_type, OperationType::Query);
    assert_eq!(text_window.arguments[0].r#type.base, "TextWindowInput");
    assert_eq!(text_window.result_type.base, "TextWindowReading");
    assert_eq!(
        text_window.directives["wes_stack_witness"]["opId"],
        text_window_vector["opIdHex"]
    );
    assert_artifact_identity_matches_vector(text_window, &vectors);
    assert_op_id_forms_agree(text_window_vector, STACK_WITNESS_TEXT_WINDOW_QUERY_ID);
    assert_eq!(
        text_window_vector["opIdDecimal"],
        serde_json::json!(STACK_WITNESS_TEXT_WINDOW_QUERY_ID)
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["helperKind"],
        serde_json::json!("QueryView")
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["fixtureVarsEncoding"],
        vectors["fixtureVarsEncoding"]
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["targetCodec"],
        vectors["targetCodec"]
    );
    assert_eq!(
        text_window_vector["helperShape"]["entrypoint"],
        serde_json::json!("observe")
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["fixtureVarsBytes"],
        serde_json::json!(
            "stack-witness-0001/textWindow;bufferId=demo.txt;basis=B1;coord=utf8-bytes;start=0;length=5;artifact=fixture-file-history-v0"
        )
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["payloadCodec"],
        serde_json::json!("QueryBytes")
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["envelope"],
        serde_json::json!("ReadingEnvelope")
    );
    assert_eq!(
        text_window.directives["wes_footprint"]["reads"],
        text_window_vector["declaredFootprint"]["reads"]
    );
    assert_declared_footprint_matches_vector(text_window, text_window_vector);
    assert_helper_shape(
        text_window_vector,
        "QueryView",
        "observe",
        &[
            "contract_artifact_id",
            "query_id",
            "fixture_vars_bytes",
            "reading_envelope",
            "query_bytes",
        ],
    );
    assert_eq!(
        text_window.directives["wes_stack_witness"]["fixtureVector"],
        serde_json::json!("stack-witness-0001-vectors.json#textWindow")
    );
    assert_eq!(
        text_window_vector["expectedQueryBytesHex"],
        serde_json::json!("68656c6c6f")
    );
}

#[test]
fn extracts_wes_footprint_directive_args_as_generic_directive_data() {
    let directives = extract_operation_directive_args(
        r#"
        query Honest
          @wes_footprint(
            reads: ["viewer", "viewer.id"]
            writes: []
            strict: true
            level: 2
          ) {
          viewer {
            id
          }
        }
        "#,
        "wes_footprint",
    )
    .expect("operation directive arguments should extract");

    let mut expected_args = IndexMap::new();
    expected_args.insert(
        "reads".to_string(),
        serde_json::json!(["viewer", "viewer.id"]),
    );
    expected_args.insert("writes".to_string(), serde_json::json!([]));
    expected_args.insert("strict".to_string(), serde_json::json!(true));
    expected_args.insert("level".to_string(), serde_json::json!(2));

    assert_eq!(
        directives,
        vec![OperationDirectiveArgs {
            directive_name: "wes_footprint".to_string(),
            arguments: expected_args,
        }]
    );
}

#[test]
fn extracts_non_echo_directive_args() {
    let directives = extract_operation_directive_args(
        r#"
        query Cached @cacheControl(maxAge: 60, scope: PUBLIC, inheritMaxAge: false) {
          viewer {
            id
          }
        }
        "#,
        "cacheControl",
    )
    .expect("operation directive arguments should extract");

    assert_eq!(directives.len(), 1);
    assert_eq!(directives[0].directive_name, "cacheControl");
    assert_eq!(directives[0].arguments["maxAge"], serde_json::json!(60));
    assert_eq!(
        directives[0].arguments["scope"],
        serde_json::json!("PUBLIC")
    );
    assert_eq!(
        directives[0].arguments["inheritMaxAge"],
        serde_json::json!(false)
    );
}

#[test]
fn missing_directive_returns_empty_directive_args() {
    let directives = extract_operation_directive_args(
        r#"
        query Plain {
          viewer {
            id
          }
        }
        "#,
        "wes_footprint",
    )
    .expect("operation directive arguments should extract");

    assert!(directives.is_empty());
}

#[test]
fn rejects_multiple_operations() {
    let error = resolve_operation_selections(
        r#"
        query A { viewer { id } }
        query B { viewer { id } }
        "#,
    )
    .expect_err("multiple operations should fail");

    assert!(matches!(
        error,
        WesleyError::LoweringError { area, .. } if area == "operation"
    ));
}

#[test]
fn rejects_unknown_fragment_spreads() {
    let error = resolve_operation_selections(
        r#"
        query BadFragment {
          viewer {
            ...MissingFields
          }
        }
        "#,
    )
    .expect_err("unknown fragment should fail");

    assert!(matches!(
        error,
        WesleyError::LoweringError { area, .. } if area == "operation"
    ));
}

#[test]
fn rejects_cyclic_fragment_spreads() {
    let error = resolve_operation_selections(
        r#"
        query Cyclic {
          viewer {
            ...A
          }
        }

        fragment A on Viewer {
          ...B
        }

        fragment B on Viewer {
          ...A
        }
        "#,
    )
    .expect_err("cyclic fragment should fail");

    assert!(matches!(
        error,
        WesleyError::LoweringError { area, .. } if area == "operation"
    ));
}

#[test]
fn rejects_schema_coordinate_for_unknown_selected_field() {
    let schema = r#"
        type Query {
          viewer: Viewer!
        }

        type Viewer {
          id: ID!
        }
    "#;
    let operation = r#"
        query BadField {
          viewer {
            missing
          }
        }
    "#;

    let error = resolve_operation_selections_with_schema(schema, operation)
        .expect_err("unknown selected field should fail");

    assert!(matches!(
        error,
        WesleyError::LoweringError { area, .. } if area == "operation"
    ));
}

#[test]
fn rejects_invalid_operation_syntax() {
    let error = resolve_operation_selections("mutation {").expect_err("invalid syntax should fail");

    assert!(matches!(error, WesleyError::ParseError { .. }));
}

fn vector_for<'a>(vectors: &'a serde_json::Value, name: &str) -> &'a serde_json::Value {
    vectors["operations"]
        .as_array()
        .expect("fixture operations should be an array")
        .iter()
        .find(|operation| operation["name"].as_str() == Some(name))
        .expect("fixture operation vector should exist")
}

const STACK_WITNESS_CREATE_BUFFER_OP_ID: u32 = 0x5357_0001;
const STACK_WITNESS_REPLACE_RANGE_OP_ID: u32 = 0x5357_0002;
const STACK_WITNESS_TEXT_WINDOW_QUERY_ID: u32 = 0x5357_1001;

fn assert_artifact_identity_matches_vector(
    operation: &wesley_core::SchemaOperation,
    vectors: &serde_json::Value,
) {
    let artifact = &operation.directives["wes_artifact"];
    assert_eq!(artifact["familyId"], vectors["artifact"]["familyId"]);
    assert_eq!(artifact["schemaId"], vectors["artifact"]["schemaId"]);
    assert_eq!(artifact["artifactId"], vectors["artifact"]["artifactId"]);
    assert_eq!(artifact["version"], vectors["artifact"]["version"]);
}

fn assert_declared_footprint_matches_vector(
    operation: &wesley_core::SchemaOperation,
    vector: &serde_json::Value,
) {
    let footprint = &operation.directives["wes_footprint"];
    assert_eq!(footprint["reads"], vector["declaredFootprint"]["reads"]);
    assert_eq!(footprint["writes"], vector["declaredFootprint"]["writes"]);
    assert_eq!(footprint["creates"], vector["declaredFootprint"]["creates"]);
    assert_eq!(footprint["forbids"], vector["declaredFootprint"]["forbids"]);
}

fn assert_helper_shape(vector: &serde_json::Value, frame: &str, entrypoint: &str, fields: &[&str]) {
    assert_eq!(vector["helperShape"]["frame"], serde_json::json!(frame));
    assert_eq!(
        vector["helperShape"]["entrypoint"],
        serde_json::json!(entrypoint)
    );
    assert_eq!(
        vector["helperShape"]["fields"],
        serde_json::Value::Array(
            fields
                .iter()
                .map(|field| serde_json::json!(field))
                .collect()
        )
    );
}

fn assert_op_id_forms_agree(vector: &serde_json::Value, expected: u32) {
    let hex = vector["opIdHex"]
        .as_str()
        .expect("opIdHex should be a string")
        .strip_prefix("0x")
        .expect("opIdHex should use 0x prefix");
    let parsed = u32::from_str_radix(hex, 16).expect("opIdHex should parse as u32");
    assert_eq!(parsed, expected);
    assert_eq!(vector["opIdDecimal"], serde_json::json!(parsed));
}
