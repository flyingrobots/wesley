import test from 'node:test';
import assert from 'node:assert/strict';
import { irToSchema } from '../../src/application/irToSchema.mjs';

const minimalIR = {
  tables: [
    {
      name: 'User',
      directives: {},
      fields: [
        {
          name: 'id',
          type: { base: 'ID', isList: false },
          nullable: false,
          directives: { pk: true }
        },
        {
          name: 'email',
          type: { base: 'String', isList: false },
          nullable: false,
          directives: { unique: true }
        },
        {
          name: 'role',
          type: { base: 'String', isList: false },
          nullable: true,
          directives: {}
        }
      ]
    }
  ]
};

test('irToSchema converts IR to domain Schema', () => {
  const schema = irToSchema(minimalIR);
  assert.ok(schema);
  const tables = schema.getTables();
  assert.equal(tables.length, 1);
  assert.equal(tables[0].name, 'User');
});

test('irToSchema maps field types correctly', () => {
  const schema = irToSchema(minimalIR);
  const user = schema.getTables()[0];
  const fields = user.getFields();
  assert.equal(fields.length, 3);

  const id = fields.find((f) => f.name === 'id');
  assert.equal(id.type, 'ID');
  assert.ok(id.isPrimaryKey());

  const email = fields.find((f) => f.name === 'email');
  assert.equal(email.type, 'String');
  assert.ok(email.isUnique());
});

test('irToSchema handles nullable fields', () => {
  const schema = irToSchema(minimalIR);
  const user = schema.getTables()[0];
  const fields = user.getFields();

  const id = fields.find((f) => f.name === 'id');
  assert.equal(id.nonNull, true);

  const role = fields.find((f) => f.name === 'role');
  assert.equal(role.nonNull, false);
});

test('irToSchema maps foreign key directives with ref', () => {
  const ir = {
    tables: [
      {
        name: 'Post',
        directives: {},
        fields: [
          {
            name: 'author_id',
            type: { base: 'ID', isList: false },
            nullable: false,
            directives: {
              fk: { targetTable: 'User', targetField: 'id' }
            }
          }
        ]
      }
    ]
  };

  const schema = irToSchema(ir);
  const post = schema.getTables()[0];
  const authorId = post.getFields()[0];
  assert.ok(authorId.isForeignKey());
  assert.equal(authorId.getForeignKeyRef(), 'User.id');
});

test('irToSchema maps list fields with itemNonNull', () => {
  const ir = {
    tables: [
      {
        name: 'Config',
        directives: {},
        fields: [
          {
            name: 'tags',
            type: { base: 'String', isList: true, listItemNullable: false },
            nullable: true,
            directives: {}
          },
          {
            name: 'labels',
            type: { base: 'String', isList: true, listItemNullable: true },
            nullable: true,
            directives: {}
          },
          {
            name: 'plain_list',
            type: { base: 'Int', isList: true },
            nullable: false,
            directives: {}
          }
        ]
      }
    ]
  };

  const schema = irToSchema(ir);
  const config = schema.getTables()[0];
  const fields = config.getFields();

  const tags = fields.find((f) => f.name === 'tags');
  assert.equal(tags.list, true, 'tags should be a list');
  assert.equal(tags.itemNonNull, true, 'tags items should be non-null');

  const labels = fields.find((f) => f.name === 'labels');
  assert.equal(labels.list, true, 'labels should be a list');
  assert.equal(labels.itemNonNull, false, 'labels items should be nullable');

  const plainList = fields.find((f) => f.name === 'plain_list');
  assert.equal(plainList.list, true, 'plain_list should be a list');
  assert.equal(plainList.itemNonNull, false, 'plain_list items should default to nullable');
});
