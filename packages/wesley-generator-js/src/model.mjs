/**
 * Model Generator - Creates TypeScript/JavaScript classes with Zod validation
 * Uses ts-morph to build AST and emit both TS and JS+JSDoc from Wesley IR
 */

import { Project, VariableDeclarationKind } from 'ts-morph';

export class ModelGenerator {
  constructor(options = {}) {
    this.target = options.target || 'ts'; // 'ts' or 'js'
    this.outputDir = options.outputDir || 'src/models';
    this.project = new Project({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Node',
        strict: true,
        declaration: true,
        emitDeclarationOnly: false,
      }
    });
  }

  /**
   * Generate model classes from Wesley IR
   */
  async generate(ir, options = {}) {
    const { outDir = this.outputDir } = options;
    
    // Clear existing files
    this.project.getSourceFiles().forEach(file => file.delete());
    
    // Generate a model file for each table
    const generatedFiles = [];
    
    for (const table of ir.tables) {
      const fileName = `${table.name}.${this.target}`;
      const sourceFile = this.project.createSourceFile(`${outDir}/${fileName}`);
      
      this.generateModelClass(sourceFile, table);
      generatedFiles.push(fileName);
      
      // For JavaScript target, also generate .d.ts file
      if (this.target === 'js') {
        const dtsFileName = `${table.name}.d.ts`;
        const dtsFile = this.project.createSourceFile(`${outDir}/${dtsFileName}`);
        this.generateTypeDefinitions(dtsFile, table);
        generatedFiles.push(dtsFileName);
      }
    }
    
    // Generate index file
    this.generateIndexFile(ir.tables, outDir);
    
    // Save all files
    await this.project.save();
    
    return {
      files: generatedFiles,
      target: this.target,
      outputDir: outDir
    };
  }
  
  /**
   * Generate a single model class
   */
  generateModelClass(sourceFile, table) {
    // Add imports
    this.addImports(sourceFile);
    
    // Generate Zod schema
    this.generateZodSchema(sourceFile, table);
    
    // Generate class
    this.generateClass(sourceFile, table);
  }
  
  /**
   * Add necessary imports
   */
  addImports(sourceFile) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'zod',
      namedImports: ['z']
    });
  }
  
  /**
   * Generate Zod schema for table
   */
  generateZodSchema(sourceFile, table) {
    const schemaName = `${table.name}Schema`;
    
    // Build schema object
    const schemaProperties = [];
    
    for (const column of table.columns) {
      let zodType = this.mapPostgreSQLToZod(column.type);
      
      // Handle nullable fields
      if (column.nullable) {
        zodType += '.nullable()';
      }
      
      // Handle default values
      if (column.default) {
        zodType += `.default(${this.formatDefaultValue(column.default, column.type)})`;
      }
      
      schemaProperties.push(`  ${column.name}: ${zodType}`);
    }
    
    // Create the schema constant
    const schemaCode = `z.object({\n${schemaProperties.join(',\n')}\n})`;
    
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{
        name: schemaName,
        initializer: schemaCode
      }]
    });
    
    // Export schema type
    if (this.target === 'ts') {
      sourceFile.addTypeAlias({
        name: `${table.name}Type`,
        type: `z.infer<typeof ${schemaName}>`,
        isExported: true
      });
    }
  }
  
  /**
   * Generate the main model class
   */
  generateClass(sourceFile, table) {
    const className = table.name;
    const schemaName = `${table.name}Schema`;
    
    // Add @typedef for the main type (JS only)
    if (this.target === 'js') {
      const typedefProperties = table.columns.map(column => {
        const jsType = this.mapPostgreSQLToJSType(column.type, column.nullable);
        return ` * @property {${jsType}} ${column.name}`;
      }).join('\n');
      
      sourceFile.insertText(sourceFile.getEnd(), `\n/**\n * @typedef {Object} ${className}Type\n${typedefProperties}\n */\n\n`);
    }
    
    // Create class structure
    const classDecl = sourceFile.addClass({
      name: className,
      isExported: true
    });
    
    if (this.target === 'js') {
      classDecl.addJsDoc({
        description: `${table.name} model class\nGenerated from Wesley schema`
      });
    }
    
    // Add static schema property
    classDecl.addProperty({
      name: 'schema',
      isStatic: true,
      isReadonly: true,
      initializer: schemaName,
      type: this.target === 'ts' ? `typeof ${schemaName}` : undefined
    });
    
    if (this.target === 'js') {
      classDecl.getProperty('schema').addJsDoc({
        tags: [{ tagName: 'type', text: '{import("zod").ZodSchema}' }]
      });
    }
    
    // Add instance properties
    for (const column of table.columns) {
      const jsType = this.mapPostgreSQLToJSType(column.type, column.nullable);
      
      const prop = classDecl.addProperty({
        name: column.name,
        type: this.target === 'ts' ? jsType : undefined
      });
      
      if (this.target === 'js') {
        prop.addJsDoc({
          tags: [{ tagName: 'type', text: `{${jsType}}` }]
        });
      }
    }
    
    // Add constructor
    this.addConstructor(classDecl, table);
    
    // Add helper methods
    this.addHelperMethods(classDecl, table);
  }
  
  /**
   * Add constructor to class
   */
  addConstructor(classDecl, table) {
    const constructor = classDecl.addConstructor({
      parameters: [{
        name: 'data',
        type: this.target === 'ts' ? `Partial<${table.name}Type>` : undefined,
        hasQuestionToken: this.target === 'ts'
      }]
    });
    
    if (this.target === 'js') {
      constructor.addJsDoc({
        description: 'Create a new instance',
        tags: [{
          tagName: 'param',
          text: `{${table.name}Type} [data] - Initial data`
        }]
      });
    }
    
    // Constructor body
    const assignments = table.columns.map(column => {
      const defaultValue = this.getDefaultValueForType(column.type, column.nullable);
      return `        this.${column.name} = data?.${column.name} ?? ${defaultValue};`;
    });
    
    constructor.setBodyText(assignments.join('\n'));
  }
  
  /**
   * Add helper methods (from, safeFrom, toJSON, clone)
   */
  addHelperMethods(classDecl, table) {
    const className = table.name;
    const schemaName = `${table.name}Schema`;
    
    // from() method - throws on invalid data
    const fromMethod = classDecl.addMethod({
      name: 'from',
      isStatic: true,
      parameters: [{
        name: 'data',
        type: this.target === 'ts' ? 'unknown' : undefined
      }],
      returnType: this.target === 'ts' ? className : undefined,
      statements: [
        `const validated = ${schemaName}.parse(data);`,
        `return new ${className}(validated);`
      ]
    });
    
    if (this.target === 'js') {
      fromMethod.addJsDoc({
        description: 'Create instance from unknown data with validation',
        tags: [
          { tagName: 'param', text: '{unknown} data - Data to validate' },
          { tagName: 'returns', text: `{${className}} Validated instance` },
          { tagName: 'throws', text: '{Error} If validation fails' }
        ]
      });
    }
    
    // safeFrom() method - returns result object
    const safeReturnType = this.target === 'ts' 
      ? `{ success: true; data: ${className} } | { success: false; error: string }`
      : undefined;
      
    const safeFromMethod = classDecl.addMethod({
      name: 'safeFrom',
      isStatic: true,
      parameters: [{
        name: 'data',
        type: this.target === 'ts' ? 'unknown' : undefined
      }],
      returnType: safeReturnType,
      statements: [
        `const result = ${schemaName}.safeParse(data);`,
        'if (result.success) {',
        `  return { success: true, data: new ${className}(result.data) };`,
        '} else {',
        '  return { success: false, error: result.error.message };',
        '}'
      ]
    });
    
    if (this.target === 'js') {
      safeFromMethod.addJsDoc({
        description: 'Safely create instance from unknown data',
        tags: [
          { tagName: 'param', text: '{unknown} data - Data to validate' },
          { tagName: 'returns', text: `{{success: true, data: ${className}} | {success: false, error: string}}` }
        ]
      });
    }
    
    // toJSON() method
    const toJSONMethod = classDecl.addMethod({
      name: 'toJSON',
      returnType: this.target === 'ts' ? 'Record<string, any>' : undefined,
      statements: [
        'return {',
        ...table.columns.map(col => `  ${col.name}: this.${col.name},`),
        '};'
      ]
    });
    
    if (this.target === 'js') {
      toJSONMethod.addJsDoc({
        description: 'Convert to plain object',
        tags: [
          { tagName: 'returns', text: '{Object}' }
        ]
      });
    }
    
    // clone() method
    const cloneMethod = classDecl.addMethod({
      name: 'clone',
      returnType: this.target === 'ts' ? className : undefined,
      statements: [`return new ${className}(this.toJSON());`]
    });
    
    if (this.target === 'js') {
      cloneMethod.addJsDoc({
        description: 'Create a deep copy',
        tags: [
          { tagName: 'returns', text: `{${className}}` }
        ]
      });
    }
  }
  
  /**
   * Generate TypeScript declaration file for JavaScript target
   */
  generateTypeDefinitions(sourceFile, table) {
    const className = table.name;
    const schemaName = `${table.name}Schema`;
    
    // Add imports
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'zod',
      namedImports: ['z']
    });
    
    // Declare the schema constant
    sourceFile.addVariableStatement({
      declarationKind: 'declare const',
      declarations: [{
        name: schemaName,
        type: 'z.ZodObject<any>'
      }]
    });
    
    // Export schema type
    sourceFile.addTypeAlias({
      name: `${table.name}Type`,
      type: `z.infer<typeof ${schemaName}>`,
      isExported: true
    });
    
    // Declare the class
    const classDecl = sourceFile.addClass({
      name: className,
      isExported: true
    });
    
    // Add static schema property
    classDecl.addProperty({
      name: 'schema',
      isStatic: true,
      isReadonly: true,
      type: `typeof ${schemaName}`
    });
    
    // Add instance properties
    for (const column of table.columns) {
      const jsType = this.mapPostgreSQLToJSType(column.type, column.nullable);
      classDecl.addProperty({
        name: column.name,
        type: jsType
      });
    }
    
    // Add constructor
    classDecl.addConstructor({
      parameters: [{
        name: 'data',
        type: `Partial<${table.name}Type>`,
        hasQuestionToken: true
      }]
    });
    
    // Add static methods
    classDecl.addMethod({
      name: 'from',
      isStatic: true,
      parameters: [{
        name: 'data',
        type: 'unknown'
      }],
      returnType: className
    });
    
    classDecl.addMethod({
      name: 'safeFrom', 
      isStatic: true,
      parameters: [{
        name: 'data',
        type: 'unknown'
      }],
      returnType: `{ success: true; data: ${className} } | { success: false; error: string }`
    });
    
    // Add instance methods
    classDecl.addMethod({
      name: 'toJSON',
      returnType: 'Record<string, any>'
    });
    
    classDecl.addMethod({
      name: 'clone',
      returnType: className
    });
  }

  /**
   * Generate index file that exports all models
   */
  generateIndexFile(tables, outDir) {
    const indexFile = this.project.createSourceFile(`${outDir}/index.${this.target}`);
    
    // Export all models
    for (const table of tables) {
      indexFile.addExportDeclaration({
        moduleSpecifier: `./${table.name}`
      });
    }
    
    // For JS target, also create index.d.ts
    if (this.target === 'js') {
      const indexDtsFile = this.project.createSourceFile(`${outDir}/index.d.ts`);
      for (const table of tables) {
        indexDtsFile.addExportDeclaration({
          moduleSpecifier: `./${table.name}`
        });
      }
    }
  }
  
  /**
   * Map PostgreSQL types to Zod types
   */
  mapPostgreSQLToZod(pgType) {
    const baseType = pgType.replace('[]', '');
    const isArray = pgType.includes('[]');
    
    let zodType;
    switch (baseType) {
      case 'uuid':
      case 'text':
        zodType = 'z.string()';
        break;
      case 'integer':
        zodType = 'z.number().int()';
        break;
      case 'double precision':
        zodType = 'z.number()';
        break;
      case 'boolean':
        zodType = 'z.boolean()';
        break;
      case 'timestamptz':
        zodType = 'z.date()';
        break;
      default:
        zodType = 'z.string()';
    }
    
    return isArray ? `z.array(${zodType})` : zodType;
  }
  
  /**
   * Map PostgreSQL types to TypeScript/JSDoc types
   */
  mapPostgreSQLToJSType(pgType, nullable = false) {
    const baseType = pgType.replace('[]', '');
    const isArray = pgType.includes('[]');
    
    let jsType;
    switch (baseType) {
      case 'uuid':
      case 'text':
        jsType = 'string';
        break;
      case 'integer':
      case 'double precision':
        jsType = 'number';
        break;
      case 'boolean':
        jsType = 'boolean';
        break;
      case 'timestamptz':
        jsType = 'Date';
        break;
      default:
        jsType = 'string';
    }
    
    if (isArray) {
      jsType = `${jsType}[]`;
    }
    
    if (nullable) {
      jsType = `${jsType} | null`;
    }
    
    return jsType;
  }
  
  /**
   * Format default value for Zod schema
   */
  formatDefaultValue(defaultValue, pgType) {
    if (defaultValue === 'now()') {
      return '() => new Date()';
    }
    
    const baseType = pgType.replace('[]', '');
    switch (baseType) {
      case 'text':
      case 'uuid':
        return `"${defaultValue}"`;
      case 'boolean':
        return defaultValue;
      case 'integer':
      case 'double precision':
        return defaultValue;
      default:
        return `"${defaultValue}"`;
    }
  }
  
  /**
   * Get default value for constructor
   */
  getDefaultValueForType(pgType, nullable = false) {
    if (nullable) {
      return 'null';
    }
    
    const baseType = pgType.replace('[]', '');
    const isArray = pgType.includes('[]');
    
    if (isArray) {
      return '[]';
    }
    
    switch (baseType) {
      case 'text':
      case 'uuid':
        return '""';
      case 'integer':
      case 'double precision':
        return '0';
      case 'boolean':
        return 'false';
      case 'timestamptz':
        return 'new Date()';
      default:
        return '""';
    }
  }
}