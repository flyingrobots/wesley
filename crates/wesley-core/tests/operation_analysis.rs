use indexmap::IndexMap;
use wesley_core::{
    extract_operation_directive_args, resolve_operation_selections,
    resolve_operation_selections_with_schema, OperationDirectiveArgs, WesleyError,
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
