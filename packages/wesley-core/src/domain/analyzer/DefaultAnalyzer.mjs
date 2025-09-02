/**
 * DefaultAnalyzer - Analyzes PostgreSQL column defaults for optimization opportunities
 * 
 * Implements WP2.T004: Instant column default detection
 * - Detects PostgreSQL 11+ instant default capability via pg_catalog.pg_attribute.atthasmissing
 * - Distinguishes between constant and volatile defaults  
 * - Provides fallback analysis for older PostgreSQL versions
 */

export class DefaultAnalyzer {
  constructor(databaseConnection) {
    this.db = databaseConnection;
    this.postgresqlVersion = null;
    this.supportsInstantDefaults = null;
  }

  /**
   * Analyze a column default value for optimization opportunities
   * @param {Object} columnInfo - Column metadata
   * @param {string} columnInfo.table_name - Table name
   * @param {string} columnInfo.column_name - Column name  
   * @param {string} columnInfo.default_value - Default expression
   * @param {string} columnInfo.data_type - PostgreSQL data type
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeDefault(columnInfo) {
    const { table_name, column_name, default_value, data_type } = columnInfo;
    
    if (!default_value) {
      return {
        hasDefault: false,
        isInstant: false,
        isConstant: false,
        isVolatile: false,
        recommendation: 'no-default'
      };
    }

    // Check PostgreSQL version and instant default capability
    const versionInfo = await this.getPostgreSQLVersionInfo();
    const defaultType = this.categorizeDefault(default_value, data_type);
    
    // Check if column already has missing values optimization
    const hasMissingOptimization = await this.checkMissingValuesOptimization(
      table_name, 
      column_name
    );

    return {
      hasDefault: true,
      defaultValue: default_value,
      dataType: data_type,
      isConstant: defaultType.isConstant,
      isVolatile: defaultType.isVolatile,
      isInstant: versionInfo.supportsInstantDefaults && defaultType.isConstant,
      postgresqlVersion: versionInfo.version,
      supportsInstantDefaults: versionInfo.supportsInstantDefaults,
      hasMissingOptimization,
      volatileFunctions: defaultType.volatileFunctions,
      recommendation: this.generateRecommendation(defaultType, versionInfo, hasMissingOptimization),
      optimizationPotential: this.assessOptimizationPotential(
        defaultType, 
        versionInfo, 
        hasMissingOptimization
      )
    };
  }

  /**
   * Get PostgreSQL version and instant default capability
   * @returns {Promise<Object>} Version information
   */
  async getPostgreSQLVersionInfo() {
    if (this.postgresqlVersion !== null) {
      return {
        version: this.postgresqlVersion,
        supportsInstantDefaults: this.supportsInstantDefaults
      };
    }

    try {
      // Get PostgreSQL version
      const versionResult = await this.db.query('SELECT version()');
      const versionString = versionResult.rows[0].version;
      const versionMatch = versionString.match(/PostgreSQL (\d+)\.(\d+)/);
      
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1]);
        const minorVersion = parseInt(versionMatch[2]);
        this.postgresqlVersion = `${majorVersion}.${minorVersion}`;
        
        // PostgreSQL 11+ supports instant defaults via atthasmissing
        this.supportsInstantDefaults = majorVersion >= 11;
      } else {
        // Fallback version detection
        this.postgresqlVersion = 'unknown';
        this.supportsInstantDefaults = false;
      }

      // Double-check by testing for atthasmissing column existence
      if (this.supportsInstantDefaults) {
        try {
          const attrCheck = await this.db.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'pg_catalog' 
            AND table_name = 'pg_attribute' 
            AND column_name = 'atthasmissing'
          `);
          
          if (attrCheck.rows.length === 0) {
            this.supportsInstantDefaults = false;
          }
        } catch (error) {
          // If we can't check, assume no support
          this.supportsInstantDefaults = false;
        }
      }

      return {
        version: this.postgresqlVersion,
        supportsInstantDefaults: this.supportsInstantDefaults
      };
    } catch (error) {
      // Fallback for connection issues
      this.postgresqlVersion = 'unknown';
      this.supportsInstantDefaults = false;
      
      return {
        version: 'unknown',
        supportsInstantDefaults: false
      };
    }
  }

  /**
   * Categorize default value as constant or volatile
   * @param {string} defaultValue - Default expression
   * @param {string} dataType - Column data type
   * @returns {Object} Categorization result
   */
  categorizeDefault(defaultValue, dataType) {
    const normalizedDefault = defaultValue.toLowerCase().trim();
    
    // Known volatile functions
    const volatileFunctions = [
      'now()', 'current_timestamp', 'current_date', 'current_time',
      'clock_timestamp()', 'statement_timestamp()', 'transaction_timestamp()',
      'timeofday()', 'random()', 'gen_random_uuid()', 'uuid_generate_v4()',
      'nextval(', 'currval(', 'setval('
    ];

    // Check for volatile functions
    const foundVolatileFunctions = volatileFunctions.filter(func => 
      normalizedDefault.includes(func.toLowerCase())
    );

    const isVolatile = foundVolatileFunctions.length > 0;
    
    // Additional patterns that indicate volatility
    const volatilePatterns = [
      /\bnow\s*\(/i,
      /\bcurrent_/i,
      /\bgen_random_/i,
      /\buuid_generate_/i,
      /\brandom\s*\(/i,
      /\bnextval\s*\(/i,
      /\bcurrval\s*\(/i,
      /\bsetval\s*\(/i
    ];

    const hasVolatilePattern = volatilePatterns.some(pattern => 
      pattern.test(normalizedDefault)
    );

    // Constant patterns
    const constantPatterns = [
      /^'[^']*'$/,           // String literals
      /^\d+(\.\d+)?$/,       // Numeric literals
      /^true$|^false$/i,     // Boolean literals
      /^null$/i,             // NULL
      /^array\[.*\]$/i,      // Array literals
      /^'{.*}'$/,            // JSON literals
      /^array\[\].*$/i       // Empty array literals
    ];

    const isLiteralConstant = constantPatterns.some(pattern => 
      pattern.test(normalizedDefault)
    );

    const isConstant = isLiteralConstant && !isVolatile && !hasVolatilePattern;

    return {
      isConstant,
      isVolatile: isVolatile || hasVolatilePattern,
      volatileFunctions: foundVolatileFunctions,
      isLiteral: isLiteralConstant,
      expression: defaultValue
    };
  }

  /**
   * Check if table column already has missing values optimization
   * @param {string} tableName - Table name
   * @param {string} columnName - Column name
   * @returns {Promise<boolean>} True if optimization exists
   */
  async checkMissingValuesOptimization(tableName, columnName) {
    if (!this.supportsInstantDefaults) {
      return false;
    }

    try {
      const query = `
        SELECT 
          att.atthasmissing,
          att.attmissingval
        FROM pg_catalog.pg_attribute att
        JOIN pg_catalog.pg_class cls ON att.attrelid = cls.oid
        JOIN pg_catalog.pg_namespace nsp ON cls.relnamespace = nsp.oid
        WHERE nsp.nspname = current_schema()
        AND cls.relname = $1
        AND att.attname = $2
        AND att.attnum > 0
        AND NOT att.attisdropped
      `;

      const result = await this.db.query(query, [tableName, columnName]);
      
      if (result.rows.length > 0) {
        return result.rows[0].atthasmissing === true;
      }

      return false;
    } catch (error) {
      // If we can't check, assume no optimization
      return false;
    }
  }

  /**
   * Generate optimization recommendation
   * @param {Object} defaultType - Default categorization
   * @param {Object} versionInfo - PostgreSQL version info
   * @param {boolean} hasMissingOptimization - Current optimization status
   * @returns {string} Recommendation code
   */
  generateRecommendation(defaultType, versionInfo, hasMissingOptimization) {
    if (!defaultType.isConstant) {
      return 'volatile-default-no-optimization';
    }

    if (!versionInfo.supportsInstantDefaults) {
      return 'constant-default-pg-version-too-old';
    }

    if (hasMissingOptimization) {
      return 'already-optimized';
    }

    return 'instant-default-recommended';
  }

  /**
   * Assess optimization potential and benefits
   * @param {Object} defaultType - Default categorization
   * @param {Object} versionInfo - PostgreSQL version info  
   * @param {boolean} hasMissingOptimization - Current optimization status
   * @returns {Object} Optimization assessment
   */
  assessOptimizationPotential(defaultType, versionInfo, hasMissingOptimization) {
    if (hasMissingOptimization) {
      return {
        potential: 'none',
        reason: 'Already optimized with instant defaults',
        benefits: [],
        estimatedSpeedupFactor: 1
      };
    }

    if (!versionInfo.supportsInstantDefaults) {
      return {
        potential: 'none',
        reason: `PostgreSQL ${versionInfo.version} does not support instant defaults`,
        benefits: [],
        estimatedSpeedupFactor: 1,
        upgradeRecommendation: 'Consider upgrading to PostgreSQL 11+ for instant default support'
      };
    }

    if (!defaultType.isConstant) {
      return {
        potential: 'none',
        reason: 'Volatile default values cannot use instant optimization',
        benefits: [],
        estimatedSpeedupFactor: 1,
        volatileFunctions: defaultType.volatileFunctions
      };
    }

    // Constant default with instant support available
    return {
      potential: 'high',
      reason: 'Constant default can use instant optimization',
      benefits: [
        'Near-instant ALTER TABLE ADD COLUMN execution',
        'No table rewrite required',
        'Minimal lock time',
        'Reduced I/O and storage during column addition'
      ],
      estimatedSpeedupFactor: 100, // Rough estimate based on table size
      implementationNotes: [
        'ADD COLUMN with constant default will use atthasmissing optimization',
        'Existing rows logically have the default without physical storage',
        'New rows store actual values normally'
      ]
    };
  }

  /**
   * Analyze multiple columns for batch optimization
   * @param {Array<Object>} columns - Array of column info objects
   * @returns {Promise<Object>} Batch analysis results
   */
  async analyzeBatch(columns) {
    const results = await Promise.all(
      columns.map(column => this.analyzeDefault(column))
    );

    const summary = {
      totalColumns: columns.length,
      constantDefaults: results.filter(r => r.isConstant).length,
      volatileDefaults: results.filter(r => r.isVolatile).length,
      instantOptimizable: results.filter(r => r.isInstant && 
        r.recommendation === 'instant-default-recommended').length,
      alreadyOptimized: results.filter(r => r.hasMissingOptimization).length,
      details: results
    };

    return summary;
  }

  /**
   * Generate SQL for adding column with optimal default strategy
   * @param {string} tableName - Target table
   * @param {string} columnName - New column name
   * @param {string} dataType - Column data type
   * @param {string} defaultValue - Default expression
   * @returns {Promise<Object>} SQL generation result
   */
  async generateOptimalColumnSQL(tableName, columnName, dataType, defaultValue) {
    const analysis = await this.analyzeDefault({
      table_name: tableName,
      column_name: columnName,
      default_value: defaultValue,
      data_type: dataType
    });

    let sql;
    let strategy;
    let warnings = [];

    if (analysis.isInstant) {
      // Use instant default optimization
      sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${dataType} DEFAULT ${defaultValue};`;
      strategy = 'instant-default';
    } else if (analysis.isVolatile) {
      // Volatile default - add without default, then set default, then update
      sql = `
-- Step 1: Add column without default
ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${dataType};

-- Step 2: Set default for future inserts  
ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValue};

-- Step 3: Update existing rows (consider doing in batches for large tables)
UPDATE "${tableName}" SET "${columnName}" = ${defaultValue} WHERE "${columnName}" IS NULL;
      `.trim();
      strategy = 'three-step-volatile';
      warnings.push('Volatile default requires table update - consider batch processing for large tables');
    } else {
      // Constant default on older PostgreSQL
      sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${dataType} DEFAULT ${defaultValue};`;
      strategy = 'traditional-constant';
      if (!analysis.supportsInstantDefaults) {
        warnings.push(`PostgreSQL ${analysis.postgresqlVersion} will require table rewrite - consider upgrading to 11+`);
      }
    }

    return {
      sql,
      strategy,
      analysis,
      warnings,
      estimatedSpeedupFactor: analysis.optimizationPotential.estimatedSpeedupFactor
    };
  }
}