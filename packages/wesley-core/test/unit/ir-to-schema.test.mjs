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

  const id = fields.find(f => f.name === 'id');
  assert.equal(id.type, 'ID');
  assert.ok(id.isPrimaryKey());

  const email = fields.find(f => f.name === 'email');
  assert.equal(email.type, 'String');
  assert.ok(email.isUnique());
});

test('irToSchema handles nullable fields', () => {
  const schema = irToSchema(minimalIR);
  const user = schema.getTables()[0];
  const fields = user.getFields();

  const id = fields.find(f => f.name === 'id');
  assert.equal(id.nonNull, true);

  const role = fields.find(f => f.name === 'role');
  assert.equal(role.nonNull, false);
});

test('irToSchema maps foreign key directives', () => {
  const ir = {
    tables: [{
      name: 'Post',
      directives: {},
      fields: [{
        name: 'author_id',
        type: { base: 'ID', isList: false },
        nullable: false,
        directives: {
          fk: { targetTable: 'User', targetField: 'id' }
        }
      }]
    }]
  };

  const schema = irToSchema(ir);
  const post = schema.getTables()[0];
  const authorId = post.getFields()[0];
  assert.ok(authorId.isForeignKey());
});
