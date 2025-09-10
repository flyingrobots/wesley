-- S.E.O. Cron Jobs for Engagement Scoring + Birthday Experience™
-- Automated scheduling for corporate surveillance metrics

-- Enable pg_cron extension (requires superuser - done in Supabase dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==================================================
-- BANDWIDTH SCORING JOB (Every 5 minutes)
-- ==================================================

-- Schedule bandwidth score updates
SELECT cron.schedule(
  'bandwidth-scoring',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  -- Call scoring Edge Function via HTTP
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scoring/process',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ==================================================
-- BIRTHDAY EXPERIENCE™ NOTIFICATIONS (Daily at 9 AM)
-- ==================================================

-- Daily birthday check and notification generation
SELECT cron.schedule(
  'birthday-experience',
  '0 9 * * *',  -- 9 AM every day
  $$
  -- Generate birthday touchpoint messages for today's birthdays
  WITH birthday_employees AS (
    SELECT 
      e.id, 
      e.display_name, 
      e.org_id,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_of_birth)) as age
    FROM employee e
    WHERE e.org_id = 'demo_org'
      AND EXTRACT(MONTH FROM e.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM e.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
  ),
  birthday_messages AS (
    SELECT 
      gen_random_uuid() as id,
      'bot_ceo' as sender_id,
      'chan_general' as channel_id,
      format('🎉 Happy Birthday %s! Another year of crushing deliverables and maximizing synergistic impact! The team is grateful for your %s years of excellence. Let''s leverage this milestone to amplify our collective bandwidth! 🚀', 
             be.display_name, be.age) as content,
      6 as buzzword_count,  -- "deliverables", "synergistic", "leverage", "amplify", "collective", "bandwidth"
      0.95 as sentiment_score,
      NOW() as created_at
    FROM birthday_employees be
  )
  INSERT INTO touchpoint_message (id, sender_id, channel_id, content, buzzword_count, sentiment_score, created_at)
  SELECT * FROM birthday_messages;
  
  -- Also update birthday employee bandwidth (+20 boost for the day)
  UPDATE employee 
  SET current_bandwidth = LEAST(100, current_bandwidth + 20)
  WHERE org_id = 'demo_org'
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE);
  $$
);

-- ==================================================
-- BANDWIDTH DECAY JOB (Every hour)
-- ==================================================

-- Apply gradual bandwidth decay to simulate engagement decline
SELECT cron.schedule(
  'bandwidth-decay',
  '0 * * * *',  -- Every hour
  $$
  UPDATE employee 
  SET current_bandwidth = current_bandwidth * COALESCE(
    nullif(current_setting('app.score_decay', true), '')::numeric, 
    0.98
  )
  WHERE org_id = 'demo_org'
    AND current_bandwidth > 0
    AND last_activity_at < NOW() - INTERVAL '2 hours';
  $$
);

-- ==================================================
-- CLEANUP JOBS
-- ==================================================

-- Clean old migration events (weekly)
SELECT cron.schedule(
  'cleanup-migration-events',
  '0 2 * * 0',  -- 2 AM every Sunday
  $$
  DELETE FROM migration_execution_events 
  WHERE created_at < NOW() - INTERVAL '7 days';
  $$
);

-- Clean old activity events (monthly)
SELECT cron.schedule(
  'cleanup-activity-events',
  '0 1 1 * *',  -- 1 AM first day of each month
  $$
  DELETE FROM activity_event 
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND activity_type NOT IN ('BIRTHDAY_INTERACTION', 'TASK_COMPLETION');
  $$
);

-- Clean completed bandwidth pairings (daily)
SELECT cron.schedule(
  'cleanup-completed-pairings',
  '0 3 * * *',  -- 3 AM daily
  $$
  UPDATE bandwidth_pairing 
  SET is_active = false
  WHERE is_active = true 
    AND created_at < NOW() - INTERVAL '24 hours'
    AND expected_duration_hours <= EXTRACT(HOURS FROM NOW() - created_at);
  $$
);

-- ==================================================
-- DEMO DATA GENERATION (Every 15 minutes during business hours)
-- ==================================================

-- Generate realistic activity events for bot employees
SELECT cron.schedule(
  'generate-demo-activity',
  '*/15 8-18 * * 1-5',  -- Every 15min, 8am-6pm, weekdays only
  $$
  WITH activity_generation AS (
    SELECT 
      e.id as employee_id,
      -- Weight activity types based on engagement level
      CASE 
        WHEN random() < 0.4 THEN 'KEYSTROKE'
        WHEN random() < 0.6 THEN 'MOUSE_MOVEMENT'  
        WHEN random() < 0.7 THEN 'CHAT_PARTICIPATION'
        WHEN random() < 0.8 THEN 'COLLABORATION'
        WHEN random() < 0.9 THEN 'TASK_COMPLETION'
        ELSE 'MEETING_ATTENDANCE'
      END as activity_type,
      jsonb_build_object(
        'simulated', true,
        'intensity', random(),
        'context', 'automated_demo_generation'
      ) as raw_data,
      -- Productivity impact influenced by current bandwidth
      (random() * 2 - 1) * (e.current_bandwidth / 100.0) as productivity_impact,
      -- Engagement factor also bandwidth-influenced  
      random() * (e.current_bandwidth / 100.0) as engagement_factor
    FROM employee e
    WHERE e.org_id = 'demo_org'
      AND e.id LIKE 'bot_%'  -- Only bot employees
      AND random() < 0.7     -- 70% chance each bot generates activity
  )
  INSERT INTO activity_event (id, employee_id, activity_type, raw_data, productivity_impact, engagement_factor)
  SELECT 
    gen_random_uuid(),
    employee_id,
    activity_type,
    raw_data,
    productivity_impact,
    engagement_factor
  FROM activity_generation;
  $$
);

-- ==================================================
-- QUERY SCHEDULED JOBS
-- ==================================================

-- View all scheduled jobs
-- SELECT * FROM cron.job ORDER BY jobname;

-- Manually run a job (for testing)
-- SELECT cron.run_job('bandwidth-scoring');

-- Unschedule a job  
-- SELECT cron.unschedule('job-name');

-- ==================================================
-- APPLICATION SETTINGS (for cron jobs)
-- ==================================================

-- Set application settings that cron jobs can access
-- These would typically be set via environment variables

-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';  
-- ALTER DATABASE postgres SET app.score_decay = '0.98';

NOTIFY cron_jobs_configured;