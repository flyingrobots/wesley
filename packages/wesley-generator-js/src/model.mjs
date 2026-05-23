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
        emitDeclarationOnly: false
      }
    });
  }

  /**
   * Generate model classes from Wesley IR
   */
  async generate(ir, options = {}) {
    const { outDir = this.outputDir } = options;

    // Clear existing files
    this.project.getSourceFiles().forEach((file) => file.delete());

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

    for (const field of table.fields) {
      let zodType = this.mapGraphQLToZod(field.type);

      if (field.nullable) {
        zodType += '.nullable()';
      }

      if (field.directives.default) {
        zodType += `.default(${this.formatDefaultValue(field.directives.default.value, field.type.base)})`;
      }

      schemaProperties.push(`  ${field.name}: ${zodType}`);
    }

    // Create the schema constant
    const schemaCode = `z.object({\n${schemaProperties.join(',\n')}\n})`;

    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: schemaName,
          initializer: schemaCode
        }
      ]
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
      const typedefProperties = table.fields
        .map((field) => {
          const jsType = this.mapGraphQLToJSType(field.type, field.nullable);
          return ` * @property {${jsType}} ${field.name}`;
        })
        .join('\n');

      sourceFile.insertText(
        sourceFile.getEnd(),
        `\n/**\n * @typedef {Object} ${className}Type\n${typedefProperties}\n */\n\n`
      );
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
    for (const field of table.fields) {
      const jsType = this.mapGraphQLToJSType(field.type, field.nullable);

      const prop = classDecl.addProperty({
        name: field.name,
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
      parameters: [
        {
          name: 'data',
          type: this.target === 'ts' ? `Partial<${table.name}Type>` : undefined,
          hasQuestionToken: this.target === 'ts'
        }
      ]
    });

    if (this.target === 'js') {
      constructor.addJsDoc({
        description: 'Create a new instance',
        tags: [
          {
            tagName: 'param',
            text: `{${table.name}Type} [data] - Initial data`
          }
        ]
      });
    }

    // Constructor body
    const assignments = table.fields.map((field) => {
      const defaultValue = this.getDefaultValueForType(field.type, field.nullable);
      return `        this.${field.name} = data?.${field.name} ?? ${defaultValue};`;
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
      parameters: [
        {
          name: 'data',
          type: this.target === 'ts' ? 'unknown' : undefined
        }
      ],
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
    const safeReturnType =
      this.target === 'ts'
        ? `{ success: true; data: ${className} } | { success: false; error: string }`
        : undefined;

    const safeFromMethod = classDecl.addMethod({
      name: 'safeFrom',
      isStatic: true,
      parameters: [
        {
          name: 'data',
          type: this.target === 'ts' ? 'unknown' : undefined
        }
      ],
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
          {
            tagName: 'returns',
            text: `{{success: true, data: ${className}} | {success: false, error: string}}`
          }
        ]
      });
    }

    // toJSON() method
    const toJSONMethod = classDecl.addMethod({
      name: 'toJSON',
      returnType: this.target === 'ts' ? 'Record<string, any>' : undefined,
      statements: ['return {', ...table.fields.map((f) => `  ${f.name}: this.${f.name},`), '};']
    });

    if (this.target === 'js') {
      toJSONMethod.addJsDoc({
        description: 'Convert to plain object',
        tags: [{ tagName: 'returns', text: '{Object}' }]
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
        tags: [{ tagName: 'returns', text: `{${className}}` }]
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
      declarations: [
        {
          name: schemaName,
          type: 'z.ZodObject<any>'
        }
      ]
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
    for (const field of table.fields) {
      const jsType = this.mapGraphQLToJSType(field.type, field.nullable);
      classDecl.addProperty({
        name: field.name,
        type: jsType
      });
    }

    // Add constructor
    classDecl.addConstructor({
      parameters: [
        {
          name: 'data',
          type: `Partial<${table.name}Type>`,
          hasQuestionToken: true
        }
      ]
    });

    // Add static methods
    classDecl.addMethod({
      name: 'from',
      isStatic: true,
      parameters: [
        {
          name: 'data',
          type: 'unknown'
        }
      ],
      returnType: className
    });

    classDecl.addMethod({
      name: 'safeFrom',
      isStatic: true,
      parameters: [
        {
          name: 'data',
          type: 'unknown'
        }
      ],
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
   * Map GraphQL FieldType to Zod type expression
   */
  mapGraphQLToZod(fieldType) {
    let zodType;
    switch (fieldType.base) {
      case 'ID':
      case 'UUID':
      case 'String':
        zodType = 'z.string()';
        break;
      case 'Int':
      case 'BigInt':
        zodType = 'z.number().int()';
        break;
      case 'Float':
      case 'Decimal':
        zodType = 'z.number()';
        break;
      case 'Boolean':
        zodType = 'z.boolean()';
        break;
      case 'DateTime':
      case 'Date':
      case 'Time':
        zodType = 'z.date()';
        break;
      case 'JSON':
        zodType = 'z.unknown()';
        break;
      default:
        zodType = 'z.string()';
    }

    return fieldType.isList ? `z.array(${zodType})` : zodType;
  }

  /**
   * Map GraphQL FieldType to TypeScript/JSDoc type
   */
  mapGraphQLToJSType(fieldType, nullable = false) {
    let jsType;
    switch (fieldType.base) {
      case 'ID':
      case 'UUID':
      case 'String':
        jsType = 'string';
        break;
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'BigInt':
        jsType = 'number';
        break;
      case 'Boolean':
        jsType = 'boolean';
        break;
      case 'DateTime':
      case 'Date':
      case 'Time':
        jsType = 'Date';
        break;
      case 'JSON':
        jsType = 'unknown';
        break;
      default:
        jsType = 'string';
    }

    if (fieldType.isList) {
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
  formatDefaultValue(defaultValue, gqlBase) {
    if (defaultValue === 'now()') {
      return '() => new Date()';
    }

    switch (gqlBase) {
      case 'String':
      case 'ID':
      case 'UUID':
        return `"${defaultValue}"`;
      case 'Boolean':
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'BigInt':
        return defaultValue;
      default:
        return `"${defaultValue}"`;
    }
  }

  /**
   * Get default value for constructor
   */
  getDefaultValueForType(fieldType, nullable = false) {
    if (nullable) {
      return 'null';
    }

    if (fieldType.isList) {
      return '[]';
    }

    switch (fieldType.base) {
      case 'String':
      case 'ID':
      case 'UUID':
        return '""';
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'BigInt':
        return '0';
      case 'Boolean':
        return 'false';
      case 'DateTime':
      case 'Date':
      case 'Time':
        return 'new Date()';
      case 'JSON':
        return 'null';
      default:
        return '""';
    }
  }
}
