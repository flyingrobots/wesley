/**
 * RPC Function Generator - Generates PostgreSQL functions from GraphQL mutations/queries
 * Transforms GraphQL operations into Supabase-compatible RPC functions
 */

export class RPCFunctionGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }

  async generate(schema) {
    const functions = [];
    
    // Process mutations
    const mutations = schema.getMutations?.() || [];
    for (const mutation of mutations) {
      functions.push(this.generateMutationFunction(mutation));
    }
    
    // Process custom queries that need RPC
    const queries = schema.getQueries?.() || [];
    for (const query of queries) {
      if (query.directives?.['@rpc']) {
        functions.push(this.generateQueryFunction(query));
      }
    }
    
    return functions.join('\n\n');
  }
  
  generateMutationFunction(mutation) {
    const funcName = this.toSnakeCase(mutation.name);
    const params = this.generateParameters(mutation.args);
    const returnType = this.getReturnType(mutation.returnType);
    
    // Generate function based on mutation type
    if (mutation.name.startsWith('create')) {
      return this.generateCreateFunction(funcName, params, returnType, mutation);
    } else if (mutation.name.startsWith('update')) {
      return this.generateUpdateFunction(funcName, params, returnType, mutation);
    } else if (mutation.name.startsWith('delete')) {
      return this.generateDeleteFunction(funcName, params, returnType, mutation);
    } else {
      return this.generateCustomFunction(funcName, params, returnType, mutation);
    }
  }
  
  generateCreateFunction(name, params, returnType, mutation) {
    const tableName = this.extractTableName(mutation);
    const fields = this.extractFieldsFromInput(mutation.args);
    
    return `-- RPC function for ${mutation.name}
CREATE OR REPLACE FUNCTION ${name}(${params})
RETURNS ${returnType}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_record ${returnType};
BEGIN
  -- Validate user permissions
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Insert record
  INSERT INTO "${tableName}" (${fields.map(f => `"${f}"`).join(', ')})
  VALUES (${fields.map(f => `$1.${f}`).join(', ')})
  RETURNING * INTO new_record;
  
  RETURN new_record;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ${name} TO authenticated;`;
  }
  
  generateUpdateFunction(name, params, returnType, mutation) {
    const tableName = this.extractTableName(mutation);
    
    return `-- RPC function for ${mutation.name}
CREATE OR REPLACE FUNCTION ${name}(${params})
RETURNS ${returnType}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_record ${returnType};
BEGIN
  -- Validate user permissions
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Update record with RLS check
  UPDATE "${tableName}"
  SET ${this.generateUpdateSet(mutation.args)}
  WHERE id = $1
    AND auth.uid() = user_id  -- Ensure user owns the record
  RETURNING * INTO updated_record;
  
  IF updated_record IS NULL THEN
    RAISE EXCEPTION 'Record not found or permission denied';
  END IF;
  
  RETURN updated_record;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ${name} TO authenticated;`;
  }
  
  generateDeleteFunction(name, params, returnType, mutation) {
    const tableName = this.extractTableName(mutation);
    
    return `-- RPC function for ${mutation.name}
CREATE OR REPLACE FUNCTION ${name}(record_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Validate user permissions
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete record with RLS check
  DELETE FROM "${tableName}"
  WHERE id = record_id
    AND auth.uid() = user_id;  -- Ensure user owns the record
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ${name} TO authenticated;`;
  }
  
  generateCustomFunction(name, params, returnType, mutation) {
    // Handle custom business logic functions
    const logic = mutation.directives?.['@function']?.logic || 'NULL';
    
    return `-- RPC function for ${mutation.name}
CREATE OR REPLACE FUNCTION ${name}(${params})
RETURNS ${returnType}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Custom business logic
  ${logic}
  
  -- TODO: Implement custom logic for ${mutation.name}
  RETURN NULL;
END;
$$;

-- Grant execute permission based on directive
GRANT EXECUTE ON FUNCTION ${name} TO ${mutation.directives?.['@grant']?.to || 'authenticated'};`;
  }
  
  generateQueryFunction(query) {
    const funcName = this.toSnakeCase(query.name);
    const params = this.generateParameters(query.args);
    const returnType = this.getReturnType(query.returnType);
    
    return `-- RPC function for custom query ${query.name}
CREATE OR REPLACE FUNCTION ${funcName}(${params})
RETURNS ${returnType}
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Custom query logic
  RETURN QUERY
    ${query.directives?.['@rpc']?.sql || '-- TODO: Implement query logic'};
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ${funcName} TO ${query.directives?.['@grant']?.to || 'authenticated'};`;
  }
  
  generateParameters(args) {
    if (!args || args.length === 0) return '';
    
    return args.map(arg => {
      const pgType = this.graphqlToPgType(arg.type);
      return `${this.toSnakeCase(arg.name)} ${pgType}`;
    }).join(', ');
  }
  
  getReturnType(type) {
    if (type.list) {
      return `SETOF ${this.graphqlToPgType(type.type)}`;
    }
    return this.graphqlToPgType(type.type);
  }
  
  graphqlToPgType(type) {
    const typeMap = {
      'ID': 'uuid',
      'String': 'text',
      'Int': 'integer',
      'Float': 'double precision',
      'Boolean': 'boolean',
      'DateTime': 'timestamptz',
      'JSON': 'jsonb'
    };
    
    return typeMap[type] || type.toLowerCase();
  }
  
  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
  
  extractTableName(mutation) {
    // Extract table name from mutation name or directive
    if (mutation.directives?.['@table']) {
      return mutation.directives['@table'].name;
    }
    
    // Infer from mutation name (e.g., createUser -> User)
    const match = mutation.name.match(/^(create|update|delete)(.+)$/);
    if (match) {
      return match[2];
    }
    
    return 'unknown';
  }
  
  extractFieldsFromInput(args) {
    // Extract field names from input type
    const inputArg = args?.find(a => a.name === 'input');
    if (inputArg?.fields) {
      return inputArg.fields.map(f => f.name);
    }
    return [];
  }
  
  generateUpdateSet(args) {
    const inputArg = args?.find(a => a.name === 'input');
    if (inputArg?.fields) {
      return inputArg.fields
        .map(f => `"${f.name}" = COALESCE($2.${f.name}, "${f.name}")`)
        .join(',\n    ');
    }
    return '-- TODO: Add update fields';
  }
}