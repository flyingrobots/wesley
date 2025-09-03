/**
 * Chaos Mode Migration Runner
 * Edge Function that orchestrates T.A.S.K.S. planning + S.L.A.P.S. execution
 * @module ChaosRunner
 */

import { corsHeaders } from '../_shared/cors.js';
import { tasksPlanner } from './tasks.js';
import { SlapsExecutor } from './slaps.js';

/**
 * Migration request rate limiter
 */
class RateLimiter {
  constructor() {
    this.userRequests = new Map(); // userId -> [timestamps]
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  /**
   * Check if user can submit migration
   * @param {string} userId - User ID
   * @param {number} maxPerDay - Max requests per day
   * @returns {boolean} Whether request is allowed
   */
  canSubmit(userId, maxPerDay = 3) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    if (!this.userRequests.has(userId)) {
      this.userRequests.set(userId, []);
    }
    
    const userRequests = this.userRequests.get(userId);
    const recentRequests = userRequests.filter(time => time > oneDayAgo);
    
    if (recentRequests.length >= maxPerDay) {
      return false;
    }
    
    recentRequests.push(now);
    this.userRequests.set(userId, recentRequests);
    return true;
  }

  /**
   * Clean up old request records
   * @private
   */
  cleanup() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [userId, timestamps] of this.userRequests) {
      const recent = timestamps.filter(time => time > oneDayAgo);
      if (recent.length === 0) {
        this.userRequests.delete(userId);
      } else {
        this.userRequests.set(userId, recent);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Main Edge Function handler
 * @param {Request} req - Incoming request
 * @returns {Response} JSON response
 */
export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'plan':
        return await handlePlan(req);
      case 'execute':
        return await handleExecute(req);
      case 'status':
        return await handleStatus(req);
      case 'events':
        return await handleEvents(req);
      case 'abort':
        return await handleAbort(req);
      default:
        return new Response(JSON.stringify({ error: 'Route not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Chaos runner error:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle migration planning request
 * POST /plan
 * @param {Request} req - Request object
 * @returns {Response} Plan response
 */
async function handlePlan(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { migrationPlan, requesterId } = await req.json();

  if (!migrationPlan || !requesterId) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: migrationPlan, requesterId'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Rate limiting check
    if (!rateLimiter.canSubmit(requesterId)) {
      return new Response(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Maximum 3 migrations per day exceeded. Try again tomorrow.'
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate for Chaos Mode
    await tasksPlanner.validateForChaos(migrationPlan);

    // Generate execution plan
    const executionPlan = await tasksPlanner.planMigration(migrationPlan);

    console.log(`📋 Generated plan: ${executionPlan.planId}`);
    console.log(`   Title: ${executionPlan.title}`);
    console.log(`   Waves: ${executionPlan.waves.length}`);
    console.log(`   Total steps: ${executionPlan.waves.reduce((sum, w) => sum + w.steps.length, 0)}`);
    console.log(`   Estimated duration: ${Math.round(executionPlan.totalEstimatedMs / 1000)}s`);
    console.log(`   Max hazard class: H${executionPlan.maxHazardClass}`);
    console.log(`   Chaos compatible: ${executionPlan.chaosCompatible ? '✅' : '❌'}`);

    return new Response(JSON.stringify({
      success: true,
      executionPlan,
      summary: {
        planId: executionPlan.planId,
        waveCount: executionPlan.waves.length,
        stepCount: executionPlan.waves.reduce((sum, w) => sum + w.steps.length, 0),
        estimatedDurationMs: executionPlan.totalEstimatedMs,
        maxHazardClass: `H${executionPlan.maxHazardClass}`,
        chaosCompatible: executionPlan.chaosCompatible,
        hazardBadges: executionPlan.waves.map(w => ({
          wave: w.name,
          hazard: `H${w.maxHazard}`,
          safeForChaos: w.canRunInChaos
        }))
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Planning failed:', error);
    
    return new Response(JSON.stringify({
      error: 'PLANNING_FAILED',
      message: error.message,
      details: error.stack
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle migration execution request
 * POST /execute
 * @param {Request} req - Request object
 * @returns {Response} Execution response
 */
async function handleExecute(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { executionPlan, requesterId } = await req.json();

  if (!executionPlan || !requesterId) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: executionPlan, requesterId'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Create executor and run plan
    const executor = new SlapsExecutor(supabaseUrl, supabaseServiceKey);
    
    console.log(`🚀 Starting execution: ${executionPlan.planId}`);
    
    // Execute asynchronously (don't wait for completion)
    executor.executePlan(executionPlan, requesterId)
      .then(result => {
        console.log(`✅ Execution completed: ${executionPlan.planId}`, result);
      })
      .catch(error => {
        console.error(`❌ Execution failed: ${executionPlan.planId}`, error);
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration execution started',
      planId: executionPlan.planId,
      status: 'RUNNING'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Execution start failed:', error);
    
    return new Response(JSON.stringify({
      error: 'EXECUTION_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle execution status request
 * GET /status?planId=xxx
 * @param {Request} req - Request object
 * @returns {Response} Status response
 */
async function handleStatus(req) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const planId = url.searchParams.get('planId');

  if (!planId) {
    return new Response(JSON.stringify({
      error: 'Missing planId parameter'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const executor = new SlapsExecutor(supabaseUrl, supabaseServiceKey);
    const status = await executor.getExecutionStatus(planId);

    if (!status) {
      return new Response(JSON.stringify({
        error: 'Plan not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Status check failed:', error);
    
    return new Response(JSON.stringify({
      error: 'STATUS_CHECK_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle execution events request
 * GET /events?planId=xxx&limit=50
 * @param {Request} req - Request object
 * @returns {Response} Events response
 */
async function handleEvents(req) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const planId = url.searchParams.get('planId');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  if (!planId) {
    return new Response(JSON.stringify({
      error: 'Missing planId parameter'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const executor = new SlapsExecutor(supabaseUrl, supabaseServiceKey);
    const events = await executor.getExecutionEvents(planId, limit);

    return new Response(JSON.stringify({
      success: true,
      events
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Events fetch failed:', error);
    
    return new Response(JSON.stringify({
      error: 'EVENTS_FETCH_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle execution abort request
 * POST /abort
 * @param {Request} req - Request object
 * @returns {Response} Abort response
 */
async function handleAbort(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { planId, requesterId } = await req.json();

  if (!planId || !requesterId) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: planId, requesterId'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Note: In a real implementation, we'd need to track executor instances
  // For now, this is a placeholder that would signal abortion via database
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const executor = new SlapsExecutor(supabaseUrl, supabaseServiceKey);
    
    // Update execution state to signal abort
    await executor.updateExecutionState(planId, {
      status: 'ABORTED',
      error_message: `Aborted by user ${requesterId}`
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration execution abort signal sent'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Abort failed:', error);
    
    return new Response(JSON.stringify({
      error: 'ABORT_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Development/testing endpoints
 */
export const config = {
  path: '/chaos/runner/*'
};