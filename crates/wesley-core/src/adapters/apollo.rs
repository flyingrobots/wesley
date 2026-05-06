//! Apollo Parser implementation of the LoweringPort.

use async_trait::async_trait;
use apollo_parser::{cst, Parser, cst::CstNode};
use crate::domain::ir::*;
use crate::domain::error::WesleyError;
use crate::ports::lowering::LoweringPort;
use std::collections::BTreeMap;

/// Adapter that uses `apollo-parser` to lower SDL to IR using Semantic Consolidation.
pub struct ApolloLoweringAdapter {
    _max_retries: usize,
}

impl ApolloLoweringAdapter {
    /// Creates a new adapter.
    pub fn new(max_retries: usize) -> Self {
        Self { _max_retries: max_retries }
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
        
        // STEP 1: Semantic Consolidation
        let mut aggregates: BTreeMap<String, TypeAggregate> = BTreeMap::new();

        for def in doc.definitions() {
            match def {
                cst::Definition::ObjectTypeDefinition(obj) => {
                    if let Some(name) = obj.name() {
                        let name_str = name.text().to_string();
                        let agg = aggregates.entry(name_str.clone()).or_insert(TypeAggregate {
                            name: name_str,
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
                            definitions: Vec::new(),
                            extensions: Vec::new(),
                        });
                        agg.extensions.push(ext);
                    }
                }
                _ => {}
            }
        }

        // STEP 2: Lowering
        let mut tables = Vec::new();
        for agg in aggregates.values() {
            if let Some(table) = self.build_table_from_aggregate(agg)? {
                tables.push(table);
            }
        }

        // STEP 3: Synthesis
        let relationships = self.synthesize_relationships(&tables);

        Ok(WesleyIR {
            version: "1.0.0".to_string(),
            metadata: None,
            tables,
            enums: Vec::new(),
            scalars: Vec::new(),
            relationships,
        })
    }

    fn synthesize_relationships(&self, tables: &[Table]) -> Vec<Relationship> {
        let mut relationships = Vec::new();
        for table in tables {
            for field in &table.fields {
                if let Some(fk) = &field.directives.fk {
                    relationships.push(Relationship {
                        r#type: "one-to-many".to_string(),
                        from: TableFieldRef {
                            table: table.name.clone(),
                            field: field.name.clone(),
                        },
                        to: TableFieldRef {
                            table: fk.target_table.clone(),
                            field: fk.target_field.clone(),
                        },
                    });
                }
            }
        }
        relationships
    }

    fn build_table_from_aggregate(&self, agg: &TypeAggregate) -> Result<Option<Table>, WesleyError> {
        let mut is_table = false;
        let mut table_name = agg.name.clone();
        let mut fields = Vec::new();

        // Process definitions
        for obj in &agg.definitions {
            if let Some(dirs) = obj.directives() {
                for dir in dirs.directives() {
                    if let Some(name) = dir.name() {
                        if name.text() == "wes_table" {
                            is_table = true;
                            if let Some(args) = dir.arguments() {
                                for arg in args.arguments() {
                                    if arg.name().map(|n| n.text().to_string()) == Some("name".to_string()) {
                                        if let Some(cst::Value::StringValue(val)) = arg.value() {
                                            table_name = val.syntax().text().to_string().replace("\"", "");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if let Some(fields_def) = obj.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        // Process extensions
        for ext in &agg.extensions {
            if let Some(dirs) = ext.directives() {
                for dir in dirs.directives() {
                    if let Some(name) = dir.name() {
                        if name.text() == "wes_table" {
                            is_table = true;
                        }
                    }
                }
            }
            if let Some(fields_def) = ext.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        if !is_table && fields.iter().any(|f| f.directives.pk == Some(true)) {
            is_table = true;
        }

        if !is_table {
            return Ok(None);
        }

        // Synthesize indexes from @wes_index field directives
        let mut indexes = Vec::new();
        for field in &fields {
            if field.directives.index == Some(true) {
                indexes.push(Index {
                    fields: vec![field.name.clone()],
                    name: None,
                    table: table_name.clone(),
                    unique: false,
                    using: None,
                });
            }
        }

        Ok(Some(Table {
            name: table_name,
            description: None,
            directives: TableDirectives {
                table: Some(true),
                rls: None,
                tenant: None,
                audit: None,
                soft_delete: None,
            },
            fields,
            indexes,
            constraints: Vec::new(),
        }))
    }

    fn build_field(&self, field_def: cst::FieldDefinition) -> Result<Field, WesleyError> {
        let name = field_def.name().ok_or(WesleyError::LoweringError {
            message: "Field missing name".to_string(),
            area: "field".to_string(),
        })?.text().to_string();

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
                        base = item_type.syntax().text().to_string().replace("!", "").replace("[", "").replace("]", "");
                    }
                }
            }
            cst::Type::ListType(lt) => {
                is_list = true;
                if let Some(item_type) = lt.ty() {
                    base = item_type.syntax().text().to_string().replace("!", "").replace("[", "").replace("]", "");
                }
            }
        }

        let mut directives = FieldDirectives {
            pk: None,
            unique: None,
            index: None,
            default: None,
            fk: None,
        };

        if let Some(dirs) = field_def.directives() {
            for dir in dirs.directives() {
                let dir_name = dir.name().ok_or(WesleyError::LoweringError {
                    message: "Directive missing name".to_string(),
                    area: "directive".to_string(),
                })?.text();

                match dir_name.as_str() {
                    "wes_pk" => directives.pk = Some(true),
                    "wes_unique" => directives.unique = Some(true),
                    "wes_index" => directives.index = Some(true),
                    "wes_default" => {
                        if let Some(args) = dir.arguments() {
                            for arg in args.arguments() {
                                let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                                if arg_name == "value" {
                                    if let Some(val) = arg.value() {
                                        let val_str = val.syntax().text().to_string().replace("\"", "");
                                        directives.default = Some(DefaultValue {
                                            value: serde_json::Value::String(val_str),
                                            is_sql: None,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    "wes_fk" => {
                        if let Some(args) = dir.arguments() {
                            for arg in args.arguments() {
                                let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                                if arg_name == "ref" {
                                    if let Some(cst::Value::StringValue(val)) = arg.value() {
                                        let ref_str = val.syntax().text().to_string().replace("\"", "");
                                        let parts: Vec<&str> = ref_str.split('.').collect();
                                        if parts.len() == 2 {
                                            directives.fk = Some(ForeignKey {
                                                target_table: parts[0].to_string(),
                                                target_field: parts[1].to_string(),
                                                on_delete: None,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(Field {
            name,
            r#type: FieldType {
                base,
                is_list,
                list_item_nullable: None,
            },
            nullable,
            directives,
            description: None,
        })
    }
}
