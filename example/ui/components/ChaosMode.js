/**
 * Chaos Mode Migration UI Components
 * Live migration interface with hazard badges + real-time events
 * @module ChaosMode
 */

/**
 * Hazard badge colors and styles
 * @readonly
 */
const HAZARD_STYLES = {
  H0: { 
    bg: 'bg-green-100', 
    text: 'text-green-800', 
    border: 'border-green-200',
    icon: '📄',
    label: 'Metadata'
  },
  H1: { 
    bg: 'bg-blue-100', 
    text: 'text-blue-800', 
    border: 'border-blue-200',
    icon: '➕',
    label: 'Additive'
  },
  H2: { 
    bg: 'bg-yellow-100', 
    text: 'text-yellow-800', 
    border: 'border-yellow-200',
    icon: '⚡',
    label: 'Throttled'
  },
  H3: { 
    bg: 'bg-red-100', 
    text: 'text-red-800', 
    border: 'border-red-200',
    icon: '🚫',
    label: 'Blocked'
  }
};

/**
 * Migration status styles  
 * @readonly
 */
const STATUS_STYLES = {
  PLANNED: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📋' },
  RUNNING: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🔄' },
  PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏸️' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌' },
  ROLLED_BACK: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '↩️' }
};

/**
 * Chaos Mode migration interface
 */
export class ChaosMode {
  /**
   * Initialize Chaos Mode UI
   * @param {string} containerId - DOM container element ID
   * @param {Object} supabase - Supabase client
   */
  constructor(containerId, supabase) {
    this.container = document.getElementById(containerId);
    this.supabase = supabase;
    this.currentPlan = null;
    this.events = [];
    
    this.render();
    this.setupEventListeners();
    this.setupRealtimeSubscription();
  }

  /**
   * Render main interface
   * @private
   */
  render() {
    this.container.innerHTML = `
      <div class="chaos-mode-container">
        <!-- Header -->
        <div class="chaos-header bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-lg mb-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold mb-2">🌀 Chaos Mode</h2>
              <p class="opacity-90">Live database migrations with safety rails</p>
            </div>
            <div class="chaos-toggle">
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="chaosEnabled" class="w-5 h-5">
                <span>Enable Chaos Mode</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Migration Form -->
        <div id="migrationForm" class="bg-white rounded-lg shadow-lg p-6 mb-6 hidden">
          <h3 class="text-xl font-semibold mb-4">Create Migration</h3>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input type="text" id="migrationTitle" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="Coffee dependency tracking">
          </div>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <textarea id="migrationReason" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Track employee coffee consumption for productivity optimization..."
                      rows="3"></textarea>
          </div>
          
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Migration DSL (JSON)</label>
            <textarea id="migrationDSL" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      rows="12"
                      placeholder='${JSON.stringify(this.getExampleDSL(), null, 2)}'></textarea>
          </div>
          
          <div class="flex space-x-4">
            <button id="planMigration" class="btn-primary">📋 Plan Migration</button>
            <button id="executeMigration" class="btn-secondary hidden" disabled>🚀 Execute</button>
            <button id="abortMigration" class="btn-danger hidden" disabled>🛑 Abort</button>
          </div>
        </div>

        <!-- Migration Banner (when active) -->
        <div id="migrationBanner" class="hidden"></div>

        <!-- Plan Preview -->
        <div id="planPreview" class="hidden bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 class="text-xl font-semibold mb-4">📋 Execution Plan</h3>
          <div id="planDetails"></div>
        </div>

        <!-- Audit Pane -->
        <div id="auditPane" class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-semibold">📊 Migration Audit Trail</h3>
            <button id="refreshAudit" class="text-blue-600 hover:text-blue-800">🔄 Refresh</button>
          </div>
          <div id="auditEvents" class="space-y-2 max-h-96 overflow-y-auto">
            <p class="text-gray-500 text-center py-8">No migration events yet. Enable Chaos Mode to get started!</p>
          </div>
        </div>
      </div>

      <style>
        .btn-primary {
          @apply bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300;
        }
        .btn-secondary {
          @apply bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-300;
        }
        .btn-danger {
          @apply bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-300;
        }
        .hazard-badge {
          @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border;
        }
        .wave-card {
          @apply bg-gray-50 rounded-lg p-4 border border-gray-200;
        }
        .step-item {
          @apply flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-100;
        }
      </style>
    `;
  }

  /**
   * Get example migration DSL
   * @private
   * @returns {Object} Example DSL
   */
  getExampleDSL() {
    return {
      "waves": [
        {
          "name": "expand",
          "steps": [
            {
              "op": "add_column",
              "table": "employee",
              "name": "coffee_dependency",
              "type": "numeric",
              "nullable": true
            },
            {
              "op": "add_index_concurrently",
              "table": "employee", 
              "cols": ["coffee_dependency", "current_bandwidth"]
            }
          ]
        },
        {
          "name": "backfill",
          "steps": [
            {
              "op": "backfill_sql",
              "sql": "UPDATE employee SET coffee_dependency = 0 WHERE coffee_dependency IS NULL"
            }
          ],
          "limits": {
            "rows_per_second": 5000,
            "max_lock_ms": 50
          }
        }
      ]
    };
  }

  /**
   * Setup event listeners
   * @private
   */
  setupEventListeners() {
    // Chaos mode toggle
    document.getElementById('chaosEnabled').addEventListener('change', (e) => {
      const form = document.getElementById('migrationForm');
      if (e.target.checked) {
        form.classList.remove('hidden');
      } else {
        form.classList.add('hidden');
        this.clearPlan();
      }
    });

    // Plan migration
    document.getElementById('planMigration').addEventListener('click', () => {
      this.planMigration();
    });

    // Execute migration
    document.getElementById('executeMigration').addEventListener('click', () => {
      this.executeMigration();
    });

    // Abort migration
    document.getElementById('abortMigration').addEventListener('click', () => {
      this.abortMigration();
    });

    // Refresh audit
    document.getElementById('refreshAudit').addEventListener('click', () => {
      this.loadRecentMigrations();
    });

    // Listen for custom migration events
    window.addEventListener('migration-event', (e) => {
      this.handleMigrationEvent(e.detail);
    });
  }

  /**
   * Setup real-time subscription for migration events
   * @private
   */
  setupRealtimeSubscription() {
    this.supabase
      .channel('migration-events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'migration_execution_events'
      }, (payload) => {
        this.handleMigrationEvent(payload.new);
      })
      .subscribe();
  }

  /**
   * Plan migration from form data
   * @private
   */
  async planMigration() {
    const title = document.getElementById('migrationTitle').value.trim();
    const reason = document.getElementById('migrationReason').value.trim();
    const dslText = document.getElementById('migrationDSL').value.trim();

    if (!title || !reason || !dslText) {
      alert('Please fill in all fields');
      return;
    }

    let migrationPlan;
    try {
      const dsl = JSON.parse(dslText);
      migrationPlan = {
        title,
        reason,
        requesterId: this.getCurrentUserId(),
        ...dsl
      };
    } catch (error) {
      alert('Invalid JSON in Migration DSL');
      return;
    }

    try {
      const response = await fetch('/edge/chaos/runner/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ migrationPlan, requesterId: this.getCurrentUserId() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Planning failed');
      }

      this.currentPlan = result.executionPlan;
      this.displayPlan(result);
      
      // Enable execute button
      document.getElementById('executeMigration').classList.remove('hidden');
      document.getElementById('executeMigration').disabled = false;

    } catch (error) {
      alert(`Planning failed: ${error.message}`);
      console.error('Planning error:', error);
    }
  }

  /**
   * Execute current migration plan
   * @private
   */
  async executeMigration() {
    if (!this.currentPlan) {
      alert('No plan to execute');
      return;
    }

    try {
      const response = await fetch('/edge/chaos/runner/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ 
          executionPlan: this.currentPlan, 
          requesterId: this.getCurrentUserId() 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Execution failed');
      }

      // Show migration banner
      this.showMigrationBanner(this.currentPlan);
      
      // Enable abort button
      document.getElementById('abortMigration').classList.remove('hidden');
      document.getElementById('abortMigration').disabled = false;
      
      // Disable execute button
      document.getElementById('executeMigration').disabled = true;

    } catch (error) {
      alert(`Execution failed: ${error.message}`);
      console.error('Execution error:', error);
    }
  }

  /**
   * Abort current migration
   * @private
   */
  async abortMigration() {
    if (!this.currentPlan) {
      return;
    }

    const confirmed = confirm('Are you sure you want to abort this migration?');
    if (!confirmed) return;

    try {
      const response = await fetch('/edge/chaos/runner/abort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ 
          planId: this.currentPlan.planId, 
          requesterId: this.getCurrentUserId() 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Abort failed');
      }

      this.hideMigrationBanner();

    } catch (error) {
      alert(`Abort failed: ${error.message}`);
      console.error('Abort error:', error);
    }
  }

  /**
   * Display execution plan
   * @private
   * @param {Object} planResult - Plan result from API
   */
  displayPlan(planResult) {
    const preview = document.getElementById('planPreview');
    const details = document.getElementById('planDetails');
    
    const { executionPlan, summary } = planResult;
    
    let html = `
      <div class="plan-summary mb-6 p-4 bg-blue-50 rounded-lg">
        <h4 class="font-semibold mb-2">${executionPlan.title}</h4>
        <p class="text-sm text-gray-600 mb-3">${executionPlan.reason}</p>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500">Waves:</span>
            <span class="font-medium ml-1">${summary.waveCount}</span>
          </div>
          <div>
            <span class="text-gray-500">Steps:</span>
            <span class="font-medium ml-1">${summary.stepCount}</span>
          </div>
          <div>
            <span class="text-gray-500">Duration:</span>
            <span class="font-medium ml-1">${Math.round(summary.estimatedDurationMs / 1000)}s</span>
          </div>
          <div>
            <span class="text-gray-500">Max Hazard:</span>
            ${this.renderHazardBadge(summary.maxHazardClass)}
          </div>
        </div>
        
        <div class="mt-3 flex items-center space-x-2">
          <span class="text-sm text-gray-500">Chaos Compatible:</span>
          ${summary.chaosCompatible ? 
            '<span class="text-green-600">✅ Yes</span>' : 
            '<span class="text-red-600">❌ No</span>'
          }
        </div>
      </div>
      
      <div class="waves-breakdown">
        <h5 class="font-semibold mb-3">Wave Breakdown</h5>
        <div class="space-y-4">
    `;
    
    executionPlan.waves.forEach((wave) => {
      const hazardBadge = summary.hazardBadges.find(b => b.wave === wave.name);
      
      html += `
        <div class="wave-card">
          <div class="flex items-center justify-between mb-2">
            <h6 class="font-medium">${wave.name.toUpperCase()} Wave</h6>
            <div class="flex items-center space-x-2">
              ${this.renderHazardBadge(hazardBadge.hazard)}
              <span class="text-sm text-gray-500">${Math.round(wave.estimatedDurationMs / 1000)}s</span>
            </div>
          </div>
          
          <div class="space-y-1">
            ${wave.steps.map(step => `
              <div class="step-item">
                <span class="font-mono text-sm">${step.step.op}</span>
                <span class="text-sm text-gray-500">${step.step.table || step.step.name || ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    details.innerHTML = html;
    preview.classList.remove('hidden');
  }

  /**
   * Render hazard badge
   * @private
   * @param {string} hazardClass - Hazard class (H0, H1, H2, H3)
   * @returns {string} HTML string
   */
  renderHazardBadge(hazardClass) {
    const style = HAZARD_STYLES[hazardClass] || HAZARD_STYLES.H3;
    
    return `
      <span class="hazard-badge ${style.bg} ${style.text} ${style.border}">
        ${style.icon} ${style.label}
      </span>
    `;
  }

  /**
   * Show migration banner during execution
   * @private
   * @param {Object} plan - Execution plan
   */
  showMigrationBanner(plan) {
    const banner = document.getElementById('migrationBanner');
    
    banner.innerHTML = `
      <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="animate-spin">🔄</div>
            <div>
              <h4 class="font-semibold">${plan.title}</h4>
              <p class="text-sm opacity-90">Migration in progress...</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm opacity-75">Plan ID</div>
            <div class="font-mono text-sm">${plan.planId}</div>
          </div>
        </div>
        
        <div class="mt-3">
          <div class="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>0 / ${plan.waves.reduce((sum, w) => sum + w.steps.length, 0)} steps</span>
          </div>
          <div class="w-full bg-white bg-opacity-20 rounded-full h-2">
            <div class="bg-white h-2 rounded-full transition-all duration-300" style="width: 0%" id="migrationProgress"></div>
          </div>
        </div>
      </div>
    `;
    
    banner.classList.remove('hidden');
  }

  /**
   * Hide migration banner
   * @private
   */
  hideMigrationBanner() {
    const banner = document.getElementById('migrationBanner');
    banner.classList.add('hidden');
    
    // Reset buttons
    document.getElementById('executeMigration').disabled = false;
    document.getElementById('abortMigration').classList.add('hidden');
  }

  /**
   * Handle real-time migration event
   * @private
   * @param {Object} event - Migration event
   */
  handleMigrationEvent(event) {
    this.events.unshift(event);
    this.updateAuditPane();
    
    // Update progress if this is our current migration
    if (this.currentPlan && event.plan_id === this.currentPlan.planId) {
      this.updateMigrationProgress(event);
    }
  }

  /**
   * Update migration progress from event
   * @private
   * @param {Object} event - Migration event
   */
  updateMigrationProgress(event) {
    const progressBar = document.getElementById('migrationProgress');
    if (!progressBar) return;
    
    // Simple progress calculation based on event types
    if (event.event_type === 'step.ok') {
      const totalSteps = this.currentPlan.waves.reduce((sum, w) => sum + w.steps.length, 0);
      const completedSteps = this.events.filter(e => 
        e.plan_id === this.currentPlan.planId && e.event_type === 'step.ok'
      ).length;
      
      const progress = (completedSteps / totalSteps) * 100;
      progressBar.style.width = `${progress}%`;
    }
    
    if (event.event_type === 'plan.accepted' && event.plan_id === this.currentPlan.planId) {
      // Migration completed
      setTimeout(() => {
        this.hideMigrationBanner();
        this.clearPlan();
      }, 2000);
    }
  }

  /**
   * Update audit pane with recent events
   * @private
   */
  updateAuditPane() {
    const auditEvents = document.getElementById('auditEvents');
    
    if (this.events.length === 0) {
      auditEvents.innerHTML = '<p class="text-gray-500 text-center py-8">No migration events yet.</p>';
      return;
    }
    
    const html = this.events.slice(0, 50).map(event => {
      const timestamp = new Date(event.created_at).toLocaleTimeString();
      const metrics = event.metrics ? JSON.parse(event.metrics) : {};
      
      return `
        <div class="event-item p-3 bg-gray-50 rounded border-l-4 border-blue-400">
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium text-sm">${event.event_type}</span>
            <span class="text-xs text-gray-500">${timestamp}</span>
          </div>
          <p class="text-sm text-gray-700">${event.message}</p>
          ${event.wave_name ? `<span class="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${event.wave_name}</span>` : ''}
          ${Object.keys(metrics).length > 0 ? `
            <details class="mt-2">
              <summary class="text-xs text-gray-500 cursor-pointer">Metrics</summary>
              <pre class="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">${JSON.stringify(metrics, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `;
    }).join('');
    
    auditEvents.innerHTML = html;
  }

  /**
   * Load recent migrations from database
   * @private
   */
  async loadRecentMigrations() {
    try {
      const { data, error } = await this.supabase
        .from('migration_execution_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load recent migrations:', error);
        return;
      }

      this.events = data || [];
      this.updateAuditPane();

    } catch (error) {
      console.error('Error loading migrations:', error);
    }
  }

  /**
   * Clear current plan
   * @private
   */
  clearPlan() {
    this.currentPlan = null;
    document.getElementById('planPreview').classList.add('hidden');
    document.getElementById('executeMigration').classList.add('hidden');
    document.getElementById('abortMigration').classList.add('hidden');
    this.hideMigrationBanner();
  }

  /**
   * Get current user ID (stub - implement based on auth system)
   * @private
   * @returns {string} User ID
   */
  getCurrentUserId() {
    // TODO: Implement real user ID from auth
    return 'demo-user-id';
  }

  /**
   * Get auth token (stub - implement based on auth system)
   * @private
   * @returns {string} Auth token
   */
  getAuthToken() {
    // TODO: Implement real auth token
    return 'demo-token';
  }
}