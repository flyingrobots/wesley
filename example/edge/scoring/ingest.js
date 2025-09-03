/**
 * S.E.O. Scoring Ingest + Reduce 
 * Processes activity events into bandwidth scores with cron
 * @module ScoringIngest
 */

import { corsHeaders } from '../_shared/cors.js';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Activity event scorer with corporate engagement algorithms
 */
class EngagementScorer {
  /**
   * Create new engagement scorer
   * @param {Object} supabase - Supabase client
   */
  constructor(supabase) {
    this.supabase = supabase;
    
    // Corporate engagement multipliers (the dystopia)
    this.eventWeights = {
      KEYSTROKE: 0.8,           // Basic productivity signal
      MOUSE_MOVEMENT: 0.6,      // Attention indicator  
      CHAT_PARTICIPATION: 2.5,  // "Collaboration" heavily weighted
      COLLABORATION: 3.0,       // Peak engagement signal
      MEETING_ATTENDANCE: 1.5,  // Presence multiplier
      TASK_COMPLETION: 4.0,     // Deliverable achievement
      IDEATION_SLIDE: 2.0,      // "Innovation" contribution
      DELEGATION_SENT: 1.2,     // "Leadership" behavior
      BIRTHDAY_INTERACTION: 5.0 // The Birthday Experience™
    };
    
    // Time decay factor (recency bias)
    this.decayHalfLife = 2 * 60 * 60 * 1000; // 2 hours
    
    // Engagement thresholds
    this.thresholds = {
      ROCK_STAR: 85.0,
      STEADY: 60.0,
      AT_RISK: 40.0,
      CRITICAL: 20.0
    };
  }

  /**
   * Process activity events into bandwidth score
   * @param {string} employeeId - Employee to score
   * @param {Date} windowStart - Start of scoring window
   * @param {Date} windowEnd - End of scoring window  
   * @returns {Promise<Object>} Scoring result
   */
  async calculateBandwidthScore(employeeId, windowStart, windowEnd) {
    try {
      // Fetch activity events in time window
      const { data: events, error } = await this.supabase
        .from('activity_event')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      if (!events || events.length === 0) {
        return {
          employeeId,
          bandwidthScore: 0,
          engagementLevel: 'CRITICAL',
          eventCount: 0,
          breakdown: {},
          calculatedAt: new Date().toISOString()
        };
      }

      // Calculate weighted score with time decay
      let totalScore = 0;
      let totalWeight = 0;
      const breakdown = {};
      const now = windowEnd.getTime();

      for (const event of events) {
        const eventTime = new Date(event.created_at).getTime();
        const age = now - eventTime;
        
        // Apply exponential time decay
        const decayFactor = Math.pow(0.5, age / this.decayHalfLife);
        
        // Get base weight for activity type
        const baseWeight = this.eventWeights[event.activity_type] || 1.0;
        
        // Apply productivity and engagement factors from event
        const productivityFactor = Math.max(0, (event.productivity_impact || 0) + 1); // -1 to 1 becomes 0 to 2
        const engagementFactor = event.engagement_factor || 0.5; // 0 to 1
        
        // Calculate final score contribution
        const contribution = baseWeight * productivityFactor * engagementFactor * decayFactor;
        
        totalScore += contribution;
        totalWeight += decayFactor; // For normalization
        
        // Track breakdown by activity type
        if (!breakdown[event.activity_type]) {
          breakdown[event.activity_type] = { count: 0, score: 0 };
        }
        breakdown[event.activity_type].count++;
        breakdown[event.activity_type].score += contribution;
      }

      // Normalize score to 0-100 range
      const rawScore = totalWeight > 0 ? (totalScore / totalWeight) * 10 : 0; // Scale factor
      const bandwidthScore = Math.min(100, Math.max(0, rawScore));
      
      // Determine engagement level
      const engagementLevel = this.categorizeEngagement(bandwidthScore);

      return {
        employeeId,
        bandwidthScore: Math.round(bandwidthScore * 10) / 10, // Round to 1 decimal
        engagementLevel,
        eventCount: events.length,
        breakdown,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Scoring failed for ${employeeId}:`, error);
      return {
        employeeId,
        bandwidthScore: 0,
        engagementLevel: 'ERROR',
        error: error.message,
        calculatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Categorize engagement level from bandwidth score
   * @private
   * @param {number} score - Bandwidth score 0-100
   * @returns {string} Engagement level
   */
  categorizeEngagement(score) {
    if (score >= this.thresholds.ROCK_STAR) return 'ROCK_STAR';
    if (score >= this.thresholds.STEADY) return 'STEADY';
    if (score >= this.thresholds.AT_RISK) return 'AT_RISK';
    return 'CRITICAL';
  }

  /**
   * Update employee bandwidth score in database
   * @param {Object} scoreResult - Result from calculateBandwidthScore
   */
  async updateEmployeeBandwidth(scoreResult) {
    const { error } = await this.supabase
      .from('employee')
      .update({
        current_bandwidth: scoreResult.bandwidthScore,
        engagement_level: scoreResult.engagementLevel,
        last_bandwidth_update: scoreResult.calculatedAt
      })
      .eq('id', scoreResult.employeeId);

    if (error) {
      console.error(`Failed to update bandwidth for ${scoreResult.employeeId}:`, error);
      throw error;
    }
  }

  /**
   * Check if employee needs forced pairing (bandwidth too low)
   * @param {Object} scoreResult - Scoring result
   */
  async checkForcedPairing(scoreResult) {
    if (scoreResult.bandwidthScore < 45.0 && scoreResult.engagementLevel !== 'ERROR') {
      // Find available mentor (high bandwidth, same org)
      const { data: mentors, error } = await this.supabase
        .from('employee')
        .select('id, display_name, current_bandwidth')
        .eq('org_id', 'demo_org')
        .gte('current_bandwidth', 75.0)
        .neq('id', scoreResult.employeeId)
        .order('current_bandwidth', { ascending: false })
        .limit(1);

      if (error || !mentors || mentors.length === 0) {
        console.log(`No mentors available for ${scoreResult.employeeId}`);
        return;
      }

      const mentor = mentors[0];

      // Check if pairing already exists and is active
      const { data: existingPairing } = await this.supabase
        .from('bandwidth_pairing')
        .select('id')
        .eq('low_bandwidth_employee', scoreResult.employeeId)
        .eq('is_active', true)
        .single();

      if (existingPairing) {
        console.log(`Pairing already exists for ${scoreResult.employeeId}`);
        return;
      }

      // Create forced pairing
      const { error: pairingError } = await this.supabase
        .from('bandwidth_pairing')
        .insert({
          id: `pairing_${Date.now()}_${scoreResult.employeeId.slice(-8)}`,
          low_bandwidth_employee: scoreResult.employeeId,
          current_bandwidth_score: scoreResult.bandwidthScore,
          mentor_employee: mentor.id,
          mentor_bandwidth_score: mentor.current_bandwidth,
          reason: `Automated pairing due to bandwidth decline below 45% threshold - focusing on engagement strategies and task prioritization`,
          expected_duration_hours: 2,
          is_active: true
        });

      if (pairingError) {
        console.error(`Failed to create pairing for ${scoreResult.employeeId}:`, pairingError);
      } else {
        console.log(`✅ Created forced pairing: ${scoreResult.employeeId} ↔ ${mentor.display_name}`);
      }
    }
  }

  /**
   * Process all active employees in demo org
   */
  async processAllEmployees() {
    const windowMinutes = parseInt(Deno.env.get('ACTIVITY_WINDOW_MINUTES') || '5');
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - windowMinutes * 60 * 1000);

    console.log(`📊 Processing bandwidth scores (${windowMinutes}min window)`);

    // Get all active demo employees
    const { data: employees, error } = await this.supabase
      .from('employee')
      .select('id, display_name, current_bandwidth')
      .eq('org_id', 'demo_org')
      .order('display_name');

    if (error) {
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }

    const results = [];
    
    for (const employee of employees) {
      const scoreResult = await this.calculateBandwidthScore(
        employee.id,
        windowStart,
        windowEnd
      );
      
      if (scoreResult.engagementLevel !== 'ERROR') {
        await this.updateEmployeeBandwidth(scoreResult);
        await this.checkForcedPairing(scoreResult);
      }
      
      results.push(scoreResult);
      
      console.log(`📈 ${employee.display_name}: ${scoreResult.bandwidthScore} (${scoreResult.engagementLevel})`);
    }

    return {
      processedCount: employees.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      results
    };
  }
}

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
    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const scorer = new EngagementScorer(supabase);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'process':
        return await handleProcess(req, scorer);
      case 'score':
        return await handleScore(req, scorer);
      default:
        return new Response(JSON.stringify({ error: 'Route not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Scoring error:', error);
    
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
 * Handle batch processing request (cron endpoint)
 * POST /process
 */
async function handleProcess(req, scorer) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const result = await scorer.processAllEmployees();
    
    console.log(`✅ Batch processing complete: ${result.processedCount} employees`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Batch processing complete',
      ...result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Batch processing failed:', error);
    
    return new Response(JSON.stringify({
      error: 'BATCH_PROCESSING_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle single employee scoring request
 * POST /score
 */
async function handleScore(req, scorer) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { employeeId, windowMinutes = 5 } = await req.json();

  if (!employeeId) {
    return new Response(JSON.stringify({
      error: 'Missing employeeId'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - windowMinutes * 60 * 1000);
    
    const scoreResult = await scorer.calculateBandwidthScore(employeeId, windowStart, windowEnd);
    
    if (scoreResult.engagementLevel !== 'ERROR') {
      await scorer.updateEmployeeBandwidth(scoreResult);
      await scorer.checkForcedPairing(scoreResult);
    }

    return new Response(JSON.stringify({
      success: true,
      result: scoreResult
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Individual scoring failed:', error);
    
    return new Response(JSON.stringify({
      error: 'SCORING_FAILED',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Edge Function configuration
 */
export const config = {
  path: '/scoring/*'
};