use wesley_core::{check_footprint, extract_footprint, FootprintSpec, WesleyError};

#[test]
fn extracts_declared_footprint_and_nested_selection_paths() {
    let spec = extract_footprint(
        r#"
        mutation AdmitChange
          @wes_footprint(
            reads: ["viewer.id", "admitChange.receipt.id"]
            writes: ["admitChange", "admitChange.receipt.status"]
          ) {
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
    .expect("operation footprint should extract");

    assert_eq!(
        spec,
        FootprintSpec {
            declared_reads: vec![
                "viewer.id".to_string(),
                "admitChange.receipt.id".to_string(),
            ],
            declared_writes: vec![
                "admitChange".to_string(),
                "admitChange.receipt.status".to_string(),
            ],
            actual_selections: vec![
                "admitChange".to_string(),
                "admitChange.receipt".to_string(),
                "admitChange.receipt.id".to_string(),
                "admitChange.receipt.status".to_string(),
                "viewer".to_string(),
                "viewer.id".to_string(),
            ],
        }
    );
}

#[test]
fn extracts_actual_selections_without_declared_footprint() {
    let spec = extract_footprint(
        r#"
        query {
          viewer {
            id
            displayName
          }
        }
        "#,
    )
    .expect("operation footprint should extract");

    assert_eq!(spec.declared_reads, Vec::<String>::new());
    assert_eq!(spec.declared_writes, Vec::<String>::new());
    assert_eq!(
        spec.actual_selections,
        vec![
            "viewer".to_string(),
            "viewer.id".to_string(),
            "viewer.displayName".to_string(),
        ]
    );
}

#[test]
fn expands_fragment_and_inline_fragment_selections() {
    let spec = extract_footprint(
        r#"
        query NodeView @wes_footprint(reads: ["node.id"], writes: []) {
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
    .expect("operation footprint should extract");

    assert_eq!(spec.declared_reads, vec!["node.id".to_string()]);
    assert_eq!(spec.declared_writes, Vec::<String>::new());
    assert_eq!(
        spec.actual_selections,
        vec![
            "node".to_string(),
            "node.id".to_string(),
            "node.title".to_string(),
        ]
    );
}

#[test]
fn records_schema_field_names_instead_of_aliases() {
    let spec = extract_footprint(
        r#"
        query AliasedView {
          renamedViewer: viewer {
            profileId: id
          }
        }
        "#,
    )
    .expect("operation footprint should extract");

    assert_eq!(
        spec.actual_selections,
        vec!["viewer".to_string(), "viewer.id".to_string()]
    );
}

#[test]
fn checks_declared_footprint_coverage() {
    let check = check_footprint(
        r#"
        query Dishonest @wes_footprint(reads: ["viewer"], writes: ["unusedWrite"]) {
          viewer {
            id
          }
        }
        "#,
    )
    .expect("operation footprint should check");

    assert!(!check.is_honest());
    assert_eq!(check.undeclared_selections, vec!["viewer.id".to_string()]);
    assert_eq!(check.unused_declarations, vec!["unusedWrite".to_string()]);
}

#[test]
fn rejects_invalid_operation_syntax() {
    let error = extract_footprint("mutation {").expect_err("invalid syntax should fail");

    assert!(matches!(error, WesleyError::ParseError { .. }));
}
