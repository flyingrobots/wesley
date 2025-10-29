/**
 * PostgreSQL Adapter - THIN wrapper for Node.js
 * Just connects core generator to Node.js file system
 */

import { PostgreSQLGenerator } from '@wesley/generator-supabase';

export class PostgreSQLAdapter {
  constructor(fileWriter) {
    this.fileWriter = fileWriter;
    this.generator = new PostgreSQLGenerator();
  }
  
  async generateAndWrite(schema, outputPath) {
    // Core does the generation
    const sql = await this.generator.generate(schema);
    
    // Node adapter writes to file system
    await this.fileWriter.write(outputPath, sql);
    
    return { path: outputPath, content: sql };
  }
}