/**
 * CLIEnhancer - Command Line Interface Enhancement System
 * 
 * Provides advanced CLI features including:
 * - Interactive mode with prompts for complex operations
 * - Command aliases and shortcuts
 * - Command history with replay capability
 * - Dry-run mode for destructive operations
 * - Progress bars and spinners for long operations
 * - Shell completion for commands
 * 
 * @license Apache-2.0
 * @author Wesley Team
 */

import { EventEmitter } from 'events';
import { DomainEvent } from '../domain/Events.mjs';

/**
 * CLI Enhancement Events
 */
export class CLIInteractionRequested extends DomainEvent {
  constructor(prompt, options = {}) {
    super('CLI_INTERACTION_REQUESTED', { prompt, options });
  }
}

export class CLICommandExecuted extends DomainEvent {
  constructor(command, args, dryRun = false) {
    super('CLI_COMMAND_EXECUTED', { command, args, dryRun });
  }
}

export class CLIProgressStarted extends DomainEvent {
  constructor(operation, total = null) {
    super('CLI_PROGRESS_STARTED', { operation, total });
  }
}

export class CLIProgressUpdate extends DomainEvent {
  constructor(current, total, message = '') {
    super('CLI_PROGRESS_UPDATE', { current, total, message });
  }
}

export class CLIProgressCompleted extends DomainEvent {
  constructor(operation, result) {
    super('CLI_PROGRESS_COMPLETED', { operation, result });
  }
}

export class CLICompletionRequested extends DomainEvent {
  constructor(partial, position) {
    super('CLI_COMPLETION_REQUESTED', { partial, position });
  }
}

/**
 * Custom CLI Error Types
 */
export class CLIError extends Error {
  constructor(message, code = 'CLI_ERROR') {
    super(message);
    this.name = 'CLIError';
    this.code = code;
  }
}

export class InteractionError extends CLIError {
  constructor(message) {
    super(message, 'INTERACTION_ERROR');
    this.name = 'InteractionError';
  }
}

export class CompletionError extends CLIError {
  constructor(message) {
    super(message, 'COMPLETION_ERROR');
    this.name = 'CompletionError';
  }
}

/**
 * CLIEnhancer - Main CLI enhancement class
 * Follows Wesley's hexagonal architecture patterns
 */
export class CLIEnhancer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      historySize: options.historySize || 100,
      enableInteractiveMode: options.enableInteractiveMode !== false,
      enableDryRun: options.enableDryRun !== false,
      enableProgress: options.enableProgress !== false,
      enableCompletion: options.enableCompletion !== false,
      ...options
    };

    // Command history
    this.history = [];
    this.historyIndex = -1;

    // Command aliases
    this.aliases = new Map([
      ['g', 'generate'],
      ['m', 'migrate'],
      ['t', 'test'],
      ['d', 'diff'],
      ['s', 'status'],
      ['r', 'rollback'],
      ['h', 'help'],
      ['v', 'version'],
      ...Object.entries(options.aliases || {})
    ]);

    // Available commands for completion
    this.commands = new Map([
      ['generate', { 
        description: 'Generate SQL, TypeScript, or migrations',
        subcommands: ['sql', 'typescript', 'zod', 'migration', 'all'],
        options: ['--dry-run', '--output', '--verbose']
      }],
      ['migrate', {
        description: 'Database migration operations',
        subcommands: ['up', 'down', 'status', 'diff', 'rollback'],
        options: ['--dry-run', '--force', '--target', '--verbose']
      }],
      ['test', {
        description: 'Run tests',
        subcommands: ['unit', 'integration', 'all'],
        options: ['--coverage', '--watch', '--verbose']
      }],
      ['watch', {
        description: 'Watch files for changes',
        subcommands: ['schema', 'migrations'],
        options: ['--interval', '--verbose']
      }],
      ['help', {
        description: 'Show help information',
        subcommands: [],
        options: []
      }],
      ['version', {
        description: 'Show version information',
        subcommands: [],
        options: []
      }]
    ]);

    // Progress tracking
    this.activeProgress = null;
    this.progressStartTime = null;
  }

  /**
   * Initialize CLI enhancer
   */
  async initialize() {
    try {
      this.emit('cliInitialized', { 
        features: Object.keys(this.options).filter(k => this.options[k]),
        aliasCount: this.aliases.size,
        commandCount: this.commands.size
      });
      
      return true;
    } catch (error) {
      const cliError = new CLIError(`Failed to initialize CLI enhancer: ${error.message}`);
      this.emit('error', cliError);
      throw cliError;
    }
  }

  /**
   * Process command with enhancements
   */
  async processCommand(command, args = [], options = {}) {
    try {
      // Resolve aliases
      const resolvedCommand = this.resolveAlias(command);
      
      // Check for dry-run mode
      const isDryRun = options.dryRun || args.includes('--dry-run');
      
      // Add to history
      this.addToHistory(resolvedCommand, args);
      
      // Emit command execution event
      this.emit('commandExecuted', new CLICommandExecuted(resolvedCommand, args, isDryRun));
      
      if (isDryRun) {
        return this.performDryRun(resolvedCommand, args);
      }

      // Process interactive prompts if needed
      if (this.requiresInteraction(resolvedCommand, args)) {
        const interaction = await this.handleInteraction(resolvedCommand, args);
        if (!interaction.confirmed) {
          return { cancelled: true, reason: 'User cancelled operation' };
        }
      }

      return {
        command: resolvedCommand,
        args,
        processed: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const cliError = new CLIError(`Command processing failed: ${error.message}`);
      this.emit('error', cliError);
      throw cliError;
    }
  }

  /**
   * Start interactive mode
   */
  async startInteractiveMode() {
    if (!this.options.enableInteractiveMode) {
      throw new InteractionError('Interactive mode is disabled');
    }

    try {
      this.emit('interactiveModeStarted');
      
      // This would typically connect to a readline interface
      // For Wesley, we emit an event that adapters can handle
      this.emit('interactionRequested', new CLIInteractionRequested(
        'Wesley Interactive Mode - Enter commands (type "exit" to quit)',
        { mode: 'interactive', multiline: false }
      ));

      return true;
    } catch (error) {
      const interactionError = new InteractionError(`Failed to start interactive mode: ${error.message}`);
      this.emit('error', interactionError);
      throw interactionError;
    }
  }

  /**
   * Handle interactive prompts for complex operations
   */
  async handleInteraction(command, args) {
    try {
      const prompts = this.getInteractionPrompts(command, args);
      const responses = {};

      for (const prompt of prompts) {
        this.emit('interactionRequested', new CLIInteractionRequested(prompt.message, prompt.options));
        
        // In a real implementation, this would wait for user input
        // For now, we simulate the interaction structure
        responses[prompt.key] = await this.waitForResponse(prompt);
      }

      return {
        confirmed: responses.confirm !== false,
        responses
      };

    } catch (error) {
      const interactionError = new InteractionError(`Interaction failed: ${error.message}`);
      this.emit('error', interactionError);
      throw interactionError;
    }
  }

  /**
   * Start progress tracking
   */
  startProgress(operation, total = null, message = '') {
    if (!this.options.enableProgress) {
      return null;
    }

    try {
      this.activeProgress = {
        operation,
        total,
        current: 0,
        startTime: Date.now(),
        message
      };

      this.emit('progressStarted', new CLIProgressStarted(operation, total));
      return this.activeProgress;

    } catch (error) {
      this.emit('error', new CLIError(`Failed to start progress: ${error.message}`));
      return null;
    }
  }

  /**
   * Update progress
   */
  updateProgress(current, message = '') {
    if (!this.activeProgress) {
      return;
    }

    try {
      this.activeProgress.current = current;
      this.activeProgress.message = message;

      this.emit('progressUpdated', new CLIProgressUpdate(
        current, 
        this.activeProgress.total, 
        message
      ));

    } catch (error) {
      this.emit('error', new CLIError(`Failed to update progress: ${error.message}`));
    }
  }

  /**
   * Complete progress tracking
   */
  completeProgress(result = null) {
    if (!this.activeProgress) {
      return;
    }

    try {
      const operation = this.activeProgress.operation;
      const duration = Date.now() - this.activeProgress.startTime;
      
      this.emit('progressCompleted', new CLIProgressCompleted(operation, {
        result,
        duration,
        completed: this.activeProgress.current,
        total: this.activeProgress.total
      }));

      this.activeProgress = null;

    } catch (error) {
      this.emit('error', new CLIError(`Failed to complete progress: ${error.message}`));
    }
  }

  /**
   * Get shell completion suggestions
   */
  async getCompletions(line, position) {
    if (!this.options.enableCompletion) {
      return [];
    }

    try {
      const completions = [];
      const parts = line.trim().split(/\s+/);
      const currentPart = parts[parts.length - 1] || '';

      // Complete command names
      if (parts.length <= 1) {
        if (this.commands && this.commands.forEach) {
          for (const [command, info] of this.commands) {
            if (command.startsWith(currentPart)) {
              completions.push({
                value: command,
                description: info.description,
                type: 'command'
              });
            }
          }
        }

        // Include aliases
        for (const [alias, command] of this.aliases) {
          if (alias.startsWith(currentPart)) {
            completions.push({
              value: alias,
              description: `Alias for ${command}`,
              type: 'alias'
            });
          }
        }
      }
      // Complete subcommands
      else if (parts.length === 2) {
        const command = this.resolveAlias(parts[0]);
        const commandInfo = this.commands.get(command);
        
        if (commandInfo) {
          for (const subcommand of commandInfo.subcommands) {
            if (subcommand.startsWith(currentPart)) {
              completions.push({
                value: subcommand,
                description: `${command} ${subcommand}`,
                type: 'subcommand'
              });
            }
          }
        }
      }
      // Complete options
      else if (currentPart.startsWith('-')) {
        const command = this.resolveAlias(parts[0]);
        const commandInfo = this.commands.get(command);
        
        if (commandInfo) {
          for (const option of commandInfo.options) {
            if (option.startsWith(currentPart)) {
              completions.push({
                value: option,
                description: `Option for ${command}`,
                type: 'option'
              });
            }
          }
        }
      }

      this.emit('completionRequested', new CLICompletionRequested(line, position));
      
      return completions.sort((a, b) => a.value.localeCompare(b.value));

    } catch (error) {
      const completionError = new CompletionError(`Completion failed: ${error.message}`);
      this.emit('error', completionError);
      return [];
    }
  }

  /**
   * Get command history
   */
  getHistory(count = null) {
    const limit = count || this.history.length;
    return this.history.slice(-limit).map((entry, index) => ({
      ...entry,
      index: this.history.length - limit + index
    }));
  }

  /**
   * Replay command from history
   */
  async replayCommand(index) {
    try {
      if (index < 0 || index >= this.history.length) {
        throw new CLIError(`Invalid history index: ${index}`);
      }

      const entry = this.history[index];
      return await this.processCommand(entry.command, entry.args, { replay: true });

    } catch (error) {
      const cliError = new CLIError(`Command replay failed: ${error.message}`);
      this.emit('error', cliError);
      throw cliError;
    }
  }

  /**
   * Resolve command alias
   */
  resolveAlias(command) {
    return this.aliases.get(command) || command;
  }

  /**
   * Add command alias
   */
  addAlias(alias, command) {
    try {
      if (this.commands.has(alias)) {
        throw new CLIError(`Cannot create alias '${alias}': conflicts with existing command`);
      }

      this.aliases.set(alias, command);
      this.emit('aliasAdded', { alias, command });
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Remove command alias
   */
  removeAlias(alias) {
    try {
      const existed = this.aliases.delete(alias);
      if (existed) {
        this.emit('aliasRemoved', { alias });
      }
      return existed;
    } catch (error) {
      this.emit('error', new CLIError(`Failed to remove alias: ${error.message}`));
      throw error;
    }
  }

  /**
   * Perform dry-run of command
   */
  async performDryRun(command, args) {
    try {
      const analysis = this.analyzeCommand(command, args);
      
      return {
        command,
        args,
        dryRun: true,
        analysis: {
          ...analysis,
          timestamp: new Date().toISOString(),
          wouldExecute: true
        }
      };

    } catch (error) {
      const cliError = new CLIError(`Dry-run analysis failed: ${error.message}`);
      this.emit('error', cliError);
      throw cliError;
    }
  }

  /**
   * Add command to history
   */
  addToHistory(command, args) {
    const entry = {
      command,
      args: [...args],
      timestamp: new Date().toISOString(),
      resolved: this.resolveAlias(command) !== command
    };

    this.history.push(entry);

    // Maintain history size limit
    if (this.history.length > this.options.historySize) {
      this.history.shift();
    }

    this.historyIndex = this.history.length - 1;
  }

  /**
   * Check if command requires interaction
   */
  requiresInteraction(command, args) {
    const destructiveCommands = ['migrate', 'rollback', 'drop', 'delete', 'remove'];
    const hasForceFlag = args.includes('--force') || args.includes('-f');
    const hasYesFlag = args.includes('--yes') || args.includes('-y');
    
    return destructiveCommands.includes(command) && !hasForceFlag && !hasYesFlag;
  }

  /**
   * Get interaction prompts for command
   */
  getInteractionPrompts(command, args) {
    const prompts = [];

    if (command === 'migrate') {
      if (args.includes('up') || args.includes('--prod')) {
        prompts.push({
          key: 'confirm',
          message: 'This will apply migrations to the database. Continue?',
          options: { type: 'confirm', default: false }
        });
      }
    }

    if (command === 'rollback') {
      prompts.push({
        key: 'confirm',
        message: 'This will rollback database changes. This action cannot be undone. Continue?',
        options: { type: 'confirm', default: false }
      });
    }

    return prompts;
  }

  /**
   * Wait for user response (adapter hook)
   */
  async waitForResponse(prompt) {
    // This would be implemented by adapters
    // For now, return a mock response for testing
    return { confirmed: true };
  }

  /**
   * Analyze command for dry-run
   */
  analyzeCommand(command, args) {
    const analysis = {
      command,
      args,
      type: 'unknown',
      destructive: false,
      filesAffected: [],
      databaseChanges: false,
      estimatedDuration: 'unknown'
    };

    // Analyze based on command type
    switch (command) {
      case 'generate':
        analysis.type = 'generation';
        analysis.filesAffected = ['SQL files', 'TypeScript files', 'Migration files'];
        analysis.estimatedDuration = '5-30 seconds';
        break;

      case 'migrate':
        analysis.type = 'migration';
        analysis.destructive = !args.includes('status');
        analysis.databaseChanges = true;
        analysis.estimatedDuration = '10-300 seconds';
        break;

      case 'rollback':
        analysis.type = 'rollback';
        analysis.destructive = true;
        analysis.databaseChanges = true;
        analysis.estimatedDuration = '5-60 seconds';
        break;

      case 'test':
        analysis.type = 'testing';
        analysis.estimatedDuration = '30-180 seconds';
        break;
    }

    return analysis;
  }
}

// Export already handled above