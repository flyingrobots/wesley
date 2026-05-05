//! Apollo Parser implementation of the LoweringPort.

use async_trait::async_trait;
use apollo_parser::{cst, Parser, cst::CstNode};
use crate::domain::ir::*;
use crate::domain::error::WesleyError;
use crate::ports::lowering::LoweringPort;

/// Adapter that uses `apollo-parser` to lower SDL to IR.
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
        let mut tables = Vec::new();

        for def in doc.definitions() {
            if let cst::Definition::ObjectTypeDefinition(obj) = def {
                if let Some(table) = self.build_table(obj)? {
                    tables.push(table);
                }
            }
        }

        Ok(WesleyIR {
            version: "1.0.0".to_string(),
            metadata: None,
            tables,
            enums: Vec::new(),
            scalars: Vec::new(),
            relationships: Vec::new(),
        })
    }

    fn build_table(&self, obj: cst::ObjectTypeDefinition) -> Result<Option<Table>, WesleyError> {
        let name = obj.name().ok_or(WesleyError::LoweringError {
            message: "Object type missing name".to_string(),
            area: "table".to_string(),
        })?.text().to_string();

        let directives = obj.directives();
        let mut is_table = false;
        let mut table_name = name.clone();

        if let Some(dirs) = directives {
            for dir in dirs.directives() {
                let dir_name = dir.name().ok_or(WesleyError::LoweringError {
                    message: "Directive missing name".to_string(),
                    area: "directive".to_string(),
                })?.text();
                
                if dir_name == "wes_table" {
                    is_table = true;
                    if let Some(args) = dir.arguments() {
                        for arg in args.arguments() {
                            let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                            if arg_name == "name" {
                                if let Some(cst::Value::StringValue(val)) = arg.value() {
                                    table_name = val.syntax().text().to_string().replace("\"", "");
                                }
                            }
                        }
                    }
                }
            }
        }

        if !is_table {
            return Ok(None);
        }

        let mut fields = Vec::new();
        if let Some(fields_def) = obj.fields_definition() {
            for field_def in fields_def.field_definitions() {
                fields.push(self.build_field(field_def)?);
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
            indexes: Vec::new(),
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
