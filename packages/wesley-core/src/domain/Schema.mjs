/**
 * Pure domain model for GraphQL Schema
 * No dependencies, just data structures and pure functions
 */

export class Schema {
  constructor(tables = {}) {
    this.tables = tables;
  }

  addTable(table) {
    return new Schema({
      ...this.tables,
      [table.name]: table
    });
  }

  getTable(name) {
    return this.tables[name];
  }

  getTables() {
    return Object.values(this.tables);
  }

  toJSON() {
    return { tables: this.tables };
  }

  toAST() {
    return {
      kind: 'WesleySchema',
      tables: Object.values(this.tables).map(table => table.toAST ? table.toAST() : {
        name: table.name,
        directives: table.directives,
        fields: Object.values(table.fields).map(field => ({
          name: field.name,
          type: field.type,
          nonNull: field.nonNull,
          list: field.list,
          itemNonNull: field.itemNonNull,
          directives: field.directives
        }))
      })
    };
  }
}

export class Table {
  constructor({ name, directives = {}, fields = {} }) {
    this.name = name;
    this.directives = directives;
    this.fields = fields;
  }

  addField(field) {
    return new Table({
      name: this.name,
      directives: this.directives,
      fields: {
        ...this.fields,
        [field.name]: field
      }
    });
  }

  getField(name) {
    return this.fields[name];
  }

  get rls() {
    return this.directives['@rls'];
  }

  get uid() {
    return this.directives['@uid']?.uid;
  }

  getFields() {
    return Object.values(this.fields);
  }

  isTable() {
    return !!this.directives['@table'];
  }

  toAST() {
    return {
      name: this.name,
      directives: this.directives,
      fields: this.getFields().map(field => field.toAST ? field.toAST() : {
        name: field.name,
        type: field.type,
        nonNull: field.nonNull,
        list: field.list,
        itemNonNull: field.itemNonNull,
        directives: field.directives
      })
    };
  }
}

export class Field {
  constructor({ name, type, nonNull = false, list = false, itemNonNull = false, directives = {} }) {
    this.name = name;
    this.type = type;
    this.nonNull = nonNull;  // Field-level nullability: [T]! or T!
    this.list = list;
    this.itemNonNull = itemNonNull;  // Item-level nullability: [T!]!
    this.directives = directives;
  }

  isPrimaryKey() {
    return !!this.directives['@primaryKey'];
  }

  isForeignKey() {
    return !!this.directives['@foreignKey'];
  }

  isUnique() {
    return !!this.directives['@unique'];
  }

  isIndexed() {
    return !!this.directives['@index'];
  }

  isVirtual() {
    // Only @hasMany and @hasOne are virtual relations
    // Regular lists (arrays) should generate columns
    return !!this.directives['@hasMany'] || !!this.directives['@hasOne'];
  }

  getDefault() {
    return this.directives['@default'];
  }

  getForeignKeyRef() {
    return this.directives['@foreignKey']?.ref;
  }

  getCheckConstraint() {
    return this.directives['@check']?.expr;
  }

  toAST() {
    return {
      name: this.name,
      type: this.type,
      nonNull: this.nonNull,
      list: this.list,
      itemNonNull: this.itemNonNull,
      directives: this.directives
    };
  }
}
