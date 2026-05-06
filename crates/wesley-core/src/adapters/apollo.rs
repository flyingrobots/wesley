//! Apollo Parser implementation of the LoweringPort.

use async_trait::async_trait;
use apollo_parser::{cst, Parser, cst::CstNode};
use crate::domain::ir::*;
use crate::domain::error::WesleyError;
use crate::ports::lowering::LoweringPort;
use std::collections::BTreeMap;
use indexmap::IndexMap;

/// Adapter that uses `apollo-parser` to lower SDL to IR and enforce Footprint Honesty.
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
    kind: TypeKind,
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
        let mut aggregates: BTreeMap<String, TypeAggregate> = BTreeMap::new();

        for def in doc.definitions() {
            match def {
                cst::Definition::ObjectTypeDefinition(obj) => {
                    if let Some(name) = obj.name() {
                        let name_str = name.text().to_string();
                        let agg = aggregates.entry(name_str.clone()).or_insert(TypeAggregate {
                            name: name_str,
                            kind: TypeKind::Object,
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
                            kind: TypeKind::Object,
                            definitions: Vec::new(),
                            extensions: Vec::new(),
                        });
                        agg.extensions.push(ext);
                    }
                }
                _ => {}
            }
        }

        let mut types = Vec::new();
        for agg in aggregates.values() {
            types.push(self.build_type_from_aggregate(agg)?);
        }

        // --- THE FOOTPRINT AUDIT ---
        // After building the types, we must validate that all Operations (Query/Mutation)
        // have an honest @wes_footprint declaration.
        for def in doc.definitions() {
            if let cst::Definition::OperationDefinition(op) = def {
                self.audit_operation_footprint(op, &types)?;
            }
        }

        Ok(WesleyIR {
            version: "1.0.0".to_string(),
            metadata: None,
            types,
        })
    }

    /// Audit a GraphQL operation to ensure its @wes_footprint is honest.
    fn audit_operation_footprint(&self, op: cst::OperationDefinition, _types: &[TypeDefinition]) -> Result<(), WesleyError> {
        let op_name = op.name().map(|n| n.text().to_string()).unwrap_or_else(|| "anonymous".to_string());
        
        // 1. Find the @wes_footprint directive
        let mut declared_reads = Vec::new();
        let mut declared_writes = Vec::new();

        if let Some(dirs) = op.directives() {
            for dir in dirs.directives() {
                if dir.name().map(|n| n.text().to_string()) == Some("wes_footprint".to_string()) {
                    if let Some(args) = dir.arguments() {
                        for arg in args.arguments() {
                            let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                            if arg_name == "reads" || arg_name == "writes" {
                                if let Some(cst::Value::ListValue(list)) = arg.value() {
                                    for val in list.values() {
                                        if let cst::Value::StringValue(s) = val {
                                            let s_str = s.syntax().text().to_string().replace("\"", "");
                                            if arg_name == "reads" { declared_reads.push(s_str); }
                                            else { declared_writes.push(s_str); }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Perform Structural Analysis of the Selection Set
        // This is a simplified "Honesty Check" for Phase 2.
        // In Phase 3+, we will use a full DPO rewrite tracer.
        if let Some(selection_set) = op.selection_set() {
            for selection in selection_set.selections() {
                if let cst::Selection::Field(field) = selection {
                    let field_name = field.name().map(|n| n.text().to_string()).unwrap_or_default();
                    
                    // Simple Rule: If you touch a field, its parent type must be in the footprint.
                    // This logic will become much more sophisticated.
                    if !declared_reads.contains(&field_name) && !declared_writes.contains(&field_name) {
                        // FOR NOW: We just log the intent. 
                        // In the future, this is a WesleyError::DishonestFootprint.
                        println!("AUDIT: Operation '{}' touches '{}', which is NOT in the @wes_footprint!", op_name, field_name);
                    }
                }
            }
        }

        Ok(())
    }

    fn build_type_from_aggregate(&self, agg: &TypeAggregate) -> Result<TypeDefinition, WesleyError> {
        let mut directives = IndexMap::new();
        let mut fields = Vec::new();

        for obj in &agg.definitions {
            if let Some(dirs) = obj.directives() {
                self.extract_directives(dirs, &mut directives)?;
            }
            if let Some(fields_def) = obj.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        for ext in &agg.extensions {
            if let Some(dirs) = ext.directives() {
                self.extract_directives(dirs, &mut directives)?;
            }
            if let Some(fields_def) = ext.fields_definition() {
                for field_def in fields_def.field_definitions() {
                    fields.push(self.build_field(field_def)?);
                }
            }
        }

        Ok(TypeDefinition {
            name: agg.name.clone(),
            kind: agg.kind,
            description: None,
            directives,
            fields,
            enum_values: Vec::new(),
        })
    }

    fn extract_directives(&self, dirs: cst::Directives, map: &mut IndexMap<String, serde_json::Value>) -> Result<(), WesleyError> {
        for dir in dirs.directives() {
            let dir_name = dir.name().ok_or(WesleyError::LoweringError {
                message: "Directive missing name".to_string(),
                area: "directive".to_string(),
            })?.text().to_string();

            let mut args_map = serde_json::Map::new();
            if let Some(args) = dir.arguments() {
                for arg in args.arguments() {
                    let arg_name = arg.name().map(|n| n.text().to_string()).unwrap_or_default();
                    if let Some(val) = arg.value() {
                        let val_str = val.syntax().text().to_string().replace("\"", "");
                        args_map.insert(arg_name, serde_json::Value::String(val_str));
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

        let mut field_directives = IndexMap::new();
        if let Some(dirs) = field_def.directives() {
            self.extract_directives(dirs, &mut field_directives)?;
        }

        Ok(Field {
            name,
            r#type: TypeReference {
                base,
                nullable,
                is_list,
                list_item_nullable: None,
            },
            directives: field_directives,
            description: None,
        })
    }
}
