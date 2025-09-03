-- S.E.O. RPC Functions
-- All business logic secured behind database functions (RPC-heavy architecture)

-- ==================================================
-- BANDWIDTH CALCULATION & SCORING
-- ==================================================

-- Recompute bandwidth scores based on recent activity
CREATE OR REPLACE FUNCTION app_recompute_bandwidth_scores()
RETURNS TABLE (employee_id uuid, new_score numeric)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  WITH activity_window AS (
    -- Recent activity in rolling window
    SELECT 
      ae.employee_id,
      SUM(ae.productivity_impact * ae.engagement_factor) as activity_score,
      COUNT(*) as event_count
    FROM activity_event ae
    WHERE ae.created_at > NOW() - INTERVAL '5 minutes'
    GROUP BY ae.employee_id
  ),
  score_updates AS (
    -- Apply exponential decay with activity boost
    SELECT 
      e.id,
      GREATEST(0, LEAST(100, 
        COALESCE(current_value('score_decay')::numeric, 0.90) * e.current_bandwidth + 
        COALESCE(aw.activity_score * 2, 0)  -- Activity multiplier
      )) as new_bandwidth
    FROM employee e
    LEFT JOIN activity_window aw ON e.id = aw.employee_id
    WHERE e.org_id = 'demo_org'
  )
  UPDATE employee e
  SET 
    current_bandwidth = su.new_bandwidth,
    engagement_level = CASE 
      WHEN su.new_bandwidth >= 85 THEN 'ROCK_STAR'
      WHEN su.new_bandwidth >= 65 THEN 'STEADY'  
      WHEN su.new_bandwidth >= 45 THEN 'AT_RISK'
      ELSE 'BANDWIDTH_DEFICIT'
    END,
    updated_at = NOW()
  FROM score_updates su
  WHERE e.id = su.id
  RETURNING e.id, e.current_bandwidth;
$$;

-- Calculate individual bandwidth score on demand
CREATE OR REPLACE FUNCTION app_calculate_bandwidth_score(
  target_employee_id uuid,
  time_window interval DEFAULT '24 hours'
) 
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keystroke_score numeric := 0;
  engagement_score numeric := 0; 
  collaboration_score numeric := 0;
  final_score numeric;
BEGIN
  -- Require demo access
  PERFORM app.require_demo_employee();
  
  -- Only allow self or manager/exec access
  IF target_employee_id != auth.uid() AND 
     app.current_employee_role() NOT IN ('manager', 'exec') THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- Weighted activity analysis
  SELECT 
    COALESCE(AVG(CASE WHEN activity_type = 'KEYSTROKE' 
                      THEN productivity_impact * 0.4 END), 0),
    COALESCE(AVG(CASE WHEN activity_type = 'CAMERA_ENGAGEMENT'
                      THEN engagement_factor * 0.3 END), 0), 
    COALESCE(AVG(CASE WHEN activity_type = 'COLLABORATION'
                      THEN collaboration_weight * 0.3 END), 0)
  INTO keystroke_score, engagement_score, collaboration_score
  FROM activity_event
  WHERE employee_id = target_employee_id
    AND created_at > NOW() - time_window;

  -- WorkVybez™ proprietary scoring algorithm
  final_score := GREATEST(0, LEAST(100, 
    (keystroke_score * 0.4 + engagement_score * 0.3 + collaboration_score * 0.3) * 100
  ));

  -- Update employee record if it's a significant change
  IF ABS(final_score - (SELECT current_bandwidth FROM employee WHERE id = target_employee_id)) > 2.0 THEN
    UPDATE employee 
    SET current_bandwidth = final_score,
        updated_at = NOW()
    WHERE id = target_employee_id;
  END IF;

  RETURN final_score;
END;
$$;

-- ==================================================
-- FORCED PAIRING SYSTEM  
-- ==================================================

-- Find optimal mentor for struggling employee
CREATE OR REPLACE FUNCTION app_find_optimal_mentor(struggling_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public  
AS $$
DECLARE
  mentor_id uuid;
BEGIN
  -- Find high-bandwidth colleague in same department who isn't busy
  SELECT e.id INTO mentor_id
  FROM employee e
  WHERE e.org_id = 'demo_org'
    AND e.department_id = (SELECT department_id FROM employee WHERE id = struggling_employee_id)
    AND e.current_bandwidth > 75.0
    AND e.id != struggling_employee_id
    AND NOT EXISTS (
      SELECT 1 FROM bandwidth_pairing bp
      WHERE bp.mentor_employee = e.id 
        AND bp.is_active = true
    )
  ORDER BY e.current_bandwidth DESC, RANDOM()
  LIMIT 1;

  RETURN mentor_id;
END;
$$;

-- Create forced pairing when bandwidth drops
CREATE OR REPLACE FUNCTION app_create_forced_pairing(struggling_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER  
SET search_path = public
AS $$
DECLARE
  mentor_id uuid;
  pairing_id uuid;
  struggling_score numeric;
  mentor_score numeric;
BEGIN
  -- Get current scores
  SELECT current_bandwidth INTO struggling_score
  FROM employee WHERE id = struggling_employee_id;

  -- Only trigger if actually struggling
  IF struggling_score > 45.0 THEN
    RAISE EXCEPTION 'BANDWIDTH_NOT_CRITICAL' USING
      DETAIL = format('Score %s not low enough for intervention', struggling_score);
  END IF;

  -- Find mentor
  mentor_id := app_find_optimal_mentor(struggling_employee_id);
  
  IF mentor_id IS NULL THEN
    RAISE EXCEPTION 'NO_MENTOR_AVAILABLE' USING
      DETAIL = 'No available mentors with sufficient bandwidth';
  END IF;

  SELECT current_bandwidth INTO mentor_score
  FROM employee WHERE id = mentor_id;

  -- Create pairing record
  INSERT INTO bandwidth_pairing (
    low_bandwidth_employee,
    current_bandwidth_score,
    mentor_employee, 
    mentor_bandwidth_score,
    reason,
    expected_duration_hours,
    is_active
  ) VALUES (
    struggling_employee_id,
    struggling_score,
    mentor_id,
    mentor_score,
    format('Automated pairing due to bandwidth decline to %s%% - focusing on productivity optimization', struggling_score),
    4,
    true
  ) RETURNING id INTO pairing_id;

  -- Broadcast the pairing to realtime
  PERFORM pg_notify('realtime:bandwidth', json_build_object(
    'type', 'forced_pairing_created',
    'pairing_id', pairing_id,
    'mentee', struggling_employee_id,
    'mentor', mentor_id,
    'reason', 'bandwidth_critical'
  )::text);

  RETURN pairing_id;
END;
$$;

-- Complete pairing session
CREATE OR REPLACE FUNCTION app_complete_pairing_session(
  pairing_id uuid,
  outcomes jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pairing_record bandwidth_pairing;
BEGIN
  -- Get pairing details
  SELECT * INTO pairing_record
  FROM bandwidth_pairing
  WHERE id = pairing_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAIRING_NOT_FOUND';
  END IF;

  -- Only participants can complete
  IF auth.uid() NOT IN (pairing_record.low_bandwidth_employee, pairing_record.mentor_employee) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- Mark completed
  UPDATE bandwidth_pairing 
  SET 
    is_active = false,
    completion_percentage = 100.0,
    completed_at = NOW(),
    mentee_feedback = outcomes->>'mentee_feedback',
    mentor_feedback = outcomes->>'mentor_feedback'
  WHERE id = pairing_id;

  RETURN true;
END;
$$;

-- ==================================================
-- TASK DELEGATION & PLATE MANAGEMENT
-- ==================================================

-- Delegate task with public broadcast
CREATE OR REPLACE FUNCTION app_delegate_task(
  plate_item_id uuid,
  to_employee_id uuid,
  reason text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delegation_id uuid;
  task_title text;
  from_name text;
  to_name text;
BEGIN
  -- Require demo access and minimum bandwidth
  PERFORM app.require_demo_employee();
  PERFORM app.require_bandwidth(40.0);  -- Need some bandwidth to delegate

  -- Validate ownership
  IF NOT EXISTS (
    SELECT 1 FROM plate_item 
    WHERE id = plate_item_id 
      AND assigned_to = auth.uid()
      AND org_id = 'demo_org'
  ) THEN
    RAISE EXCEPTION 'NOT_TASK_OWNER';
  END IF;

  -- Get names for broadcast
  SELECT pi.title, e1.display_name, e2.display_name
  INTO task_title, from_name, to_name
  FROM plate_item pi, employee e1, employee e2
  WHERE pi.id = plate_item_id
    AND e1.id = auth.uid()
    AND e2.id = to_employee_id;

  -- Create delegation event
  INSERT INTO delegation_event (
    plate_item_id, from_employee, to_employee, reason,
    is_public, manager_notified, team_notified
  ) VALUES (
    plate_item_id, auth.uid(), to_employee_id, reason,
    true, true, true
  ) RETURNING id INTO delegation_id;

  -- Update plate ownership  
  UPDATE plate_item
  SET 
    assigned_to = to_employee_id,
    delegated_by = auth.uid(),
    delegation_count = delegation_count + 1,
    updated_at = NOW()
  WHERE id = plate_item_id;

  -- Public broadcast for accountability
  PERFORM pg_notify('realtime:delegations', json_build_object(
    'type', 'task_delegated',
    'delegation_id', delegation_id,
    'task_title', task_title,
    'from_name', from_name,
    'to_name', to_name,
    'reason', reason,
    'timestamp', extract(epoch from NOW())
  )::text);

  RETURN delegation_id;
END;
$$;

-- ==================================================
-- TOUCHPOINT (CHAT) FUNCTIONS
-- ==================================================

-- Send touchpoint message with engagement check
CREATE OR REPLACE FUNCTION app_send_touchpoint(
  channel_id uuid,
  content text,
  template_used text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER  
SET search_path = public
AS $$
DECLARE
  message_id uuid;
  min_score numeric;
  current_score numeric;
  buzzword_count integer := 0;
BEGIN
  -- Require demo access
  PERFORM app.require_demo_employee();

  -- Check channel engagement requirements
  SELECT minimum_engagement_score INTO min_score
  FROM touchpoint_channel 
  WHERE id = channel_id;

  current_score := app.current_bandwidth_score();
  
  IF current_score < min_score THEN
    RAISE EXCEPTION 'ENGAGEMENT_TOO_LOW' USING
      DETAIL = format('Required: %s%%, Current: %s%%', min_score, current_score);
  END IF;

  -- Count buzzwords for scoring
  buzzword_count := (
    LENGTH(content) - LENGTH(REPLACE(LOWER(content), 'synergy', '')) +
    LENGTH(content) - LENGTH(REPLACE(LOWER(content), 'leverage', '')) +  
    LENGTH(content) - LENGTH(REPLACE(LOWER(content), 'holistic', '')) +
    LENGTH(content) - LENGTH(REPLACE(LOWER(content), 'circle back', '')) +
    LENGTH(content) - LENGTH(REPLACE(LOWER(content), 'bandwidth', ''))
  ) / 10;

  -- Insert message
  INSERT INTO touchpoint_message (
    sender_id, channel_id, content, template_used,
    buzzword_count, sender_engagement_score
  ) VALUES (
    auth.uid(), channel_id, content, template_used,
    buzzword_count, current_score
  ) RETURNING id INTO message_id;

  -- Broadcast for realtime
  PERFORM pg_notify('realtime:touchpoints', json_build_object(
    'type', 'message_sent',
    'message_id', message_id,
    'channel_id', channel_id,
    'sender_id', auth.uid(),
    'buzzword_count', buzzword_count
  )::text);

  RETURN message_id;
END;
$$;

-- ==================================================
-- IDEATION DECK FUNCTIONS
-- ==================================================

-- Validate buzzword compliance and publish slide
CREATE OR REPLACE FUNCTION app_publish_ideation_slide(
  slide_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slide_record ideation_slide;
  compliance_score numeric;
BEGIN
  -- Get slide
  SELECT * INTO slide_record
  FROM ideation_slide 
  WHERE id = slide_id AND creator_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLIDE_NOT_FOUND';
  END IF;

  -- Calculate compliance (all fields must be >= 20 chars)
  compliance_score := CASE 
    WHEN LENGTH(slide_record.leveraging_field) >= 20 
     AND LENGTH(slide_record.operationalizing_field) >= 20
     AND LENGTH(slide_record.scalability_field) >= 20
     AND LENGTH(slide_record.roi_potential_field) >= 20
     AND LENGTH(slide_record.cross_functional_field) >= 20
     AND LENGTH(slide_record.thought_leadership_field) >= 20
    THEN 95.0 + RANDOM() * 5  -- Slight randomization
    ELSE 40.0 + RANDOM() * 30
  END;

  -- Update and publish
  UPDATE ideation_slide
  SET 
    buzzword_compliance_score = compliance_score,
    is_published = true,
    published_at = NOW(),
    company_wide_visibility = true
  WHERE id = slide_id;

  -- Broadcast to thought leadership feed
  PERFORM pg_notify('realtime:ideation', json_build_object(
    'type', 'slide_published',
    'slide_id', slide_id,
    'creator_id', auth.uid(),
    'compliance_score', compliance_score,
    'title', slide_record.title
  )::text);

  RETURN true;
END;
$$;

-- ==================================================
-- MEETING SURVEILLANCE FUNCTIONS
-- ==================================================

-- Record facial engagement data (simulated)
CREATE OR REPLACE FUNCTION app_record_facial_engagement(
  session_id uuid,
  engagement_data jsonb
)
RETURNS boolean  
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update participant engagement
  UPDATE deep_dive_participant
  SET 
    engagement_score = (engagement_data->>'overall_score')::numeric,
    last_engagement_update = NOW()
  WHERE session_id = session_id
    AND employee_id = auth.uid();

  -- Trigger alert if engagement too low
  IF (engagement_data->>'overall_score')::numeric < 40.0 THEN
    PERFORM app_trigger_focus_alert(session_id, auth.uid(), 'LOSING_FOCUS');
  END IF;

  RETURN true;
END;
$$;

-- Trigger focus alert during meeting
CREATE OR REPLACE FUNCTION app_trigger_focus_alert(
  session_id uuid,
  employee_id uuid,
  alert_type text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER  
SET search_path = public
AS $$
DECLARE
  alert_message text;
BEGIN
  -- Generate helpful condescending message
  alert_message := CASE alert_type
    WHEN 'LOSING_FOCUS' THEN 'It looks like you''re losing focus. Let''s take this offline and circle back when your bandwidth frees up later! 💪'
    WHEN 'LOW_ENGAGEMENT' THEN 'Your engagement score could use a boost! Try asking a clarifying question to re-energize the discussion! 🚀'
    WHEN 'CAMERA_AVOIDANCE' THEN 'Great ideas need great visibility! Consider adjusting your camera for better team collaboration! 📹'
    ELSE 'Let''s optimize your meeting experience for maximum productivity! ✨'
  END;

  -- Insert alert
  INSERT INTO deep_dive_alert (
    session_id, employee_id, alert_type, message, confidence_score
  ) VALUES (
    session_id, employee_id, alert_type, alert_message, 85.0 + RANDOM() * 15
  );

  -- Realtime notification  
  PERFORM pg_notify('realtime:meetings', json_build_object(
    'type', 'focus_alert',
    'session_id', session_id,
    'employee_id', employee_id,
    'alert_type', alert_type,
    'message', alert_message
  )::text);

  RETURN true;
END;
$$;

-- ==================================================
-- MIGRATION LOCKING (For Chaos Mode)
-- ==================================================

-- Take migration advisory lock
CREATE OR REPLACE FUNCTION app_take_migration_lock()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock with magic number 7777777
  IF NOT pg_try_advisory_lock(7777777) THEN
    RAISE EXCEPTION 'MIGRATION_LOCKED' USING
      DETAIL = 'Another migration is in progress';
  END IF;
END;
$$;

-- Release migration lock
CREATE OR REPLACE FUNCTION app_release_migration_lock()
RETURNS void  
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_unlock(7777777);
END;
$$;

-- Execute migration statements with safety rails
CREATE OR REPLACE FUNCTION app_run_migration_statements(stmts text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stmt text;
BEGIN
  -- Set strict timeouts
  PERFORM set_config('lock_timeout', '2000', true);      -- 2 second lock timeout
  PERFORM set_config('statement_timeout', '10000', true); -- 10 second statement timeout  
  PERFORM set_config('client_min_messages', 'warning', true);

  -- Execute each statement in transaction
  BEGIN
    FOREACH stmt IN ARRAY stmts LOOP
      RAISE NOTICE 'Executing: %', stmt;
      EXECUTE stmt;
    END LOOP;
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE EXCEPTION 'MIGRATION_FAILED: %', SQLERRM;
  END;
  
  RAISE NOTICE 'Migration completed successfully';
END;
$$;

-- ==================================================
-- ANALYTICS & REPORTING
-- ==================================================

-- Generate team surveillance metrics (for managers)
CREATE OR REPLACE FUNCTION app_get_team_metrics(manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metrics jsonb;
BEGIN
  -- Require manager or exec role
  IF app.current_employee_role() NOT IN ('manager', 'exec') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
  END IF;

  -- Aggregate team data
  SELECT json_build_object(
    'team_size', COUNT(*),
    'average_bandwidth', ROUND(AVG(current_bandwidth), 1),
    'engagement_distribution', json_build_object(
      'rock_star', COUNT(*) FILTER (WHERE engagement_level = 'ROCK_STAR'),
      'steady', COUNT(*) FILTER (WHERE engagement_level = 'STEADY'),  
      'at_risk', COUNT(*) FILTER (WHERE engagement_level = 'AT_RISK'),
      'deficit', COUNT(*) FILTER (WHERE engagement_level = 'BANDWIDTH_DEFICIT')
    ),
    'interventions_needed', COUNT(*) FILTER (WHERE current_bandwidth < 45),
    'top_performer', (SELECT display_name FROM employee e2 WHERE e2.id = e.id ORDER BY current_bandwidth DESC LIMIT 1),
    'needs_attention', array_agg(display_name) FILTER (WHERE current_bandwidth < 45)
  ) INTO metrics
  FROM employee e
  WHERE e.org_id = 'demo_org'
    AND (manager_id = auth.uid() OR app.current_employee_role() = 'exec');

  RETURN metrics;
END;
$$;

NOTIFY rpc_functions_loaded;