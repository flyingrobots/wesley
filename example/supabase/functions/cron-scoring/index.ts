// S.E.O. Scoring Cron Job
// Runs every 5 minutes to update employee bandwidth scores

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    console.log('🕐 Starting scheduled scoring job...')
    
    // Call the scoring ingest function
    const scoringUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/scoring/process`
    
    const response = await fetch(scoringUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Scoring job failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Scoring job completed:', result)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scoring job completed successfully',
        ...result
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Scoring cron job failed:', error)
    
    return new Response(
      JSON.stringify({
        error: 'Cron job failed',
        message: error.message
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})