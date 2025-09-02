/**
 * RPC Client with Zod Validation
 * Client for calling RPC functions with automatic validation
 */

export class RPCClient {
  constructor(supabaseClient, schemas = {}) {
    this.supabase = supabaseClient;
    this.schemas = schemas;
  }
  
  /**
   * Call an RPC function with validation
   */
  async call(functionName, params = {}, options = {}) {
    // Get validation schema if available
    const inputSchema = this.schemas[`${functionName}InputSchema`];
    const outputSchema = this.schemas[`${functionName}OutputSchema`];
    
    // Validate input if schema exists
    if (inputSchema) {
      try {
        params = inputSchema.parse(params);
      } catch (error) {
        throw new ValidationError(`Invalid input for ${functionName}`, error);
      }
    }
    
    // Call the RPC function
    const { data, error } = await this.supabase.rpc(functionName, params);
    
    if (error) {
      throw new RPCError(`RPC call failed: ${functionName}`, error);
    }
    
    // Validate output if schema exists
    if (outputSchema) {
      try {
        return outputSchema.parse(data);
      } catch (error) {
        console.warn(`Output validation failed for ${functionName}:`, error);
        // Return data anyway but log the validation error
        return data;
      }
    }
    
    return data;
  }
  
  /**
   * Create a typed RPC caller for a specific table
   */
  createTableClient(tableName) {
    const client = this;
    
    return {
      async create(input) {
        const schema = client.schemas[`${tableName}CreateSchema`];
        if (schema) {
          input = schema.parse(input);
        }
        return client.call(`create_${tableName.toLowerCase()}`, { input });
      },
      
      async update(id, updates) {
        const schema = client.schemas[`${tableName}UpdateSchema`];
        if (schema) {
          updates = schema.parse(updates);
        }
        return client.call(`update_${tableName.toLowerCase()}`, { id, updates });
      },
      
      async delete(id) {
        return client.call(`delete_${tableName.toLowerCase()}`, { id });
      },
      
      async list(filters = {}) {
        const schema = client.schemas[`${tableName}FilterSchema`];
        if (schema) {
          filters = schema.parse(filters);
        }
        return client.call(`list_${tableName.toLowerCase()}`, { filters });
      },
      
      async get(id) {
        return client.call(`get_${tableName.toLowerCase()}`, { id });
      }
    };
  }
  
  /**
   * Batch multiple RPC calls with validation
   */
  async batch(calls) {
    const results = [];
    const errors = [];
    
    for (const { function: funcName, params } of calls) {
      try {
        const result = await this.call(funcName, params);
        results.push({ function: funcName, data: result });
      } catch (error) {
        errors.push({ function: funcName, error });
      }
    }
    
    if (errors.length > 0) {
      throw new BatchError('Some RPC calls failed', { results, errors });
    }
    
    return results;
  }
  
  /**
   * Create a transaction wrapper
   */
  async transaction(callback) {
    // Begin transaction
    await this.call('begin_transaction');
    
    try {
      const result = await callback(this);
      
      // Commit transaction
      await this.call('commit_transaction');
      
      return result;
    } catch (error) {
      // Rollback transaction
      await this.call('rollback_transaction');
      throw error;
    }
  }
  
  /**
   * Register additional schemas at runtime
   */
  registerSchemas(newSchemas) {
    Object.assign(this.schemas, newSchemas);
  }
}

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message, zodError) {
    super(message);
    this.name = 'ValidationError';
    this.zodError = zodError;
    this.issues = zodError?.issues || [];
  }
  
  getFieldErrors() {
    const errors = {};
    for (const issue of this.issues) {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    }
    return errors;
  }
}

export class RPCError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'RPCError';
    this.originalError = originalError;
    this.code = originalError?.code;
    this.details = originalError?.details;
  }
}

export class BatchError extends Error {
  constructor(message, { results, errors }) {
    super(message);
    this.name = 'BatchError';
    this.results = results;
    this.errors = errors;
  }
  
  getSuccessful() {
    return this.results;
  }
  
  getFailed() {
    return this.errors;
  }
}

/**
 * Factory function to create client with schemas
 */
export function createRPCClient(supabaseClient, generatedSchemas) {
  // Import the generated schemas
  const schemas = {};
  
  // Process the generated schemas module
  if (generatedSchemas) {
    for (const [key, value] of Object.entries(generatedSchemas)) {
      if (key.endsWith('Schema')) {
        schemas[key] = value;
      }
    }
  }
  
  return new RPCClient(supabaseClient, schemas);
}