/**
 * DbAdapter - minimal Postgres executor using 'pg'
 */

export class DbAdapter {
  async query(dsn, sql) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: dsn });
    await client.connect();
    try {
      const res = await client.query(sql);
      return res;
    } finally {
      await client.end();
    }
  }

  async execStatements(dsn, statements) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: dsn });
    await client.connect();
    try {
      for (const sql of statements) {
        await client.query(sql);
      }
    } finally {
      await client.end();
    }
  }
}

