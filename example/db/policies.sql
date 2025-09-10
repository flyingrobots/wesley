-- S.E.O. Row Level Security Policies
-- Multi-role demo with bulletproof security that still allows chaos

-- ==================================================
-- HELPER FUNCTIONS
-- ==================================================

-- Who am I in the demo org?
CREATE OR REPLACE FUNCTION app.current_employee_id() 
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT id FROM employee WHERE auth.uid() = id AND org_id = 'demo_org';
$$;

-- What's my current role in the demo?
CREATE OR REPLACE FUNCTION app.current_employee_role() 
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM employee WHERE auth.uid() = id AND org_id = 'demo_org';
$$;

-- Get my current bandwidth score
CREATE OR REPLACE FUNCTION app.current_bandwidth_score()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_bandwidth FROM employee WHERE auth.uid() = id AND org_id = 'demo_org';
$$;

-- Am I a manager of this employee?
CREATE OR REPLACE FUNCTION app.is_manager_of(target_employee_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee e1, employee e2
    WHERE e1.id = auth.uid() 
      AND e2.id = target_employee_id
      AND e1.role = 'manager'
      AND e1.department_id = e2.department_id  -- Same department
      AND e1.org_id = 'demo_org'
      AND e2.org_id = 'demo_org'
  );
$$;

-- ==================================================
-- EMPLOYEE TABLE POLICIES
-- ==================================================

ALTER TABLE employee ENABLE ROW LEVEL SECURITY;

-- Workers see themselves only
CREATE POLICY worker_self_view ON employee
  FOR ALL USING (
    auth.uid() = id 
    AND role = 'worker' 
    AND org_id = 'demo_org'
  );

-- Managers see their department + themselves  
CREATE POLICY manager_department_view ON employee
  FOR ALL USING (
    org_id = 'demo_org' AND (
      auth.uid() = id OR  -- Always see self
      EXISTS (
        SELECT 1 FROM employee manager 
        WHERE manager.id = auth.uid()
          AND manager.role = 'manager'
          AND manager.department_id = employee.department_id
          AND manager.org_id = 'demo_org'
      )
    )
  );

-- Executives see everyone in demo org
CREATE POLICY exec_god_mode ON employee
  FOR ALL USING (
    org_id = 'demo_org' AND EXISTS (
      SELECT 1 FROM employee exec
      WHERE exec.id = auth.uid() 
        AND exec.role = 'exec'
        AND exec.org_id = 'demo_org'
    )
  );

-- ==================================================
-- ACTIVITY EVENT POLICIES  
-- ==================================================

ALTER TABLE activity_event ENABLE ROW LEVEL SECURITY;

-- Workers see only their own activity
CREATE POLICY activity_self_only ON activity_event
  FOR ALL USING (
    employee_id = auth.uid()
  );

-- Managers see their department's activity (aggregated through views)
CREATE POLICY activity_manager_view ON activity_event
  FOR SELECT USING (
    app.is_manager_of(employee_id) OR
    employee_id = auth.uid()
  );

-- Executives see all activity in demo org
CREATE POLICY activity_exec_view ON activity_event
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employee e1, employee e2
      WHERE e1.id = auth.uid()
        AND e1.role = 'exec' 
        AND e1.org_id = 'demo_org'
        AND e2.id = activity_event.employee_id
        AND e2.org_id = 'demo_org'
    )
  );

-- ==================================================
-- PLATE ITEM (TASK) POLICIES
-- ==================================================

ALTER TABLE plate_item ENABLE ROW LEVEL SECURITY;

-- Everyone in demo org can see public plates
CREATE POLICY plate_visibility ON plate_item
  FOR SELECT USING (
    org_id = 'demo_org' AND (
      is_visible_to_team = true OR
      assigned_to = auth.uid() OR
      originally_assigned_to = auth.uid()
    )
  );

-- Can modify plates you own or if you're a manager
CREATE POLICY plate_modification ON plate_item
  FOR UPDATE USING (
    org_id = 'demo_org' AND (
      assigned_to = auth.uid() OR
      app.is_manager_of(assigned_to) OR
      app.current_employee_role() = 'exec'
    )
  );

-- Can insert plates into demo org
CREATE POLICY plate_creation ON plate_item
  FOR INSERT WITH CHECK (
    org_id = 'demo_org' AND
    assigned_to = auth.uid()
  );

-- ==================================================
-- DELEGATION EVENT POLICIES
-- ==================================================

ALTER TABLE delegation_event ENABLE ROW LEVEL SECURITY;

-- Public delegations visible to all (for the shame/accountability)
CREATE POLICY delegation_transparency ON delegation_event
  FOR SELECT USING (
    is_public = true AND EXISTS (
      SELECT 1 FROM employee e 
      WHERE e.id = auth.uid() AND e.org_id = 'demo_org'
    )
  );

-- Can create delegations if you own the plate
CREATE POLICY delegation_ownership ON delegation_event
  FOR INSERT WITH CHECK (
    from_employee = auth.uid() AND
    EXISTS (
      SELECT 1 FROM plate_item p
      WHERE p.id = delegation_event.plate_item_id
        AND p.assigned_to = auth.uid()
        AND p.org_id = 'demo_org'
    )
  );

-- ==================================================
-- TOUCHPOINT MESSAGE POLICIES
-- ==================================================

ALTER TABLE touchpoint_message ENABLE ROW LEVEL SECURITY;

-- See messages in channels you have access to
CREATE POLICY touchpoint_channel_access ON touchpoint_message
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM touchpoint_channel c, employee e
      WHERE c.id = touchpoint_message.channel_id
        AND e.id = auth.uid()
        AND e.org_id = 'demo_org'
        AND e.current_bandwidth >= c.minimum_engagement_score
    )
  );

-- Can send messages if bandwidth is sufficient
CREATE POLICY touchpoint_send_permission ON touchpoint_message
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    app.current_bandwidth_score() >= (
      SELECT minimum_engagement_score 
      FROM touchpoint_channel 
      WHERE id = touchpoint_message.channel_id
    )
  );

-- ==================================================
-- TOUCHPOINT CHANNEL POLICIES  
-- ==================================================

ALTER TABLE touchpoint_channel ENABLE ROW LEVEL SECURITY;

-- All demo org employees can see channels (but access depends on bandwidth)
CREATE POLICY channel_visibility ON touchpoint_channel
  FOR SELECT USING (
    org_id = 'demo_org' AND EXISTS (
      SELECT 1 FROM employee e 
      WHERE e.id = auth.uid() AND e.org_id = 'demo_org'
    )
  );

-- ==================================================
-- IDEATION SLIDE POLICIES
-- ==================================================

ALTER TABLE ideation_slide ENABLE ROW LEVEL SECURITY;

-- Published slides visible to all demo org
CREATE POLICY ideation_public_view ON ideation_slide
  FOR SELECT USING (
    is_published = true AND 
    company_wide_visibility = true AND
    EXISTS (
      SELECT 1 FROM employee e 
      WHERE e.id = auth.uid() AND e.org_id = 'demo_org'
    )
  );

-- Can edit your own slides
CREATE POLICY ideation_ownership ON ideation_slide
  FOR ALL USING (
    creator_id = auth.uid()
  );

-- ==================================================
-- DEEP DIVE SESSION POLICIES
-- ==================================================

ALTER TABLE deep_dive_session ENABLE ROW LEVEL SECURITY;

-- Can see sessions you're invited to or created
CREATE POLICY session_participation ON deep_dive_session
  FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM deep_dive_participant p
      WHERE p.session_id = deep_dive_session.id
        AND p.employee_id = auth.uid()
    )
  );

-- ==================================================
-- DEEP DIVE PARTICIPANT POLICIES  
-- ==================================================

ALTER TABLE deep_dive_participant ENABLE ROW LEVEL SECURITY;

-- See participants in sessions you're part of
CREATE POLICY participant_session_view ON deep_dive_participant
  FOR SELECT USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM deep_dive_participant p2
      WHERE p2.session_id = deep_dive_participant.session_id
        AND p2.employee_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM deep_dive_session s
      WHERE s.id = deep_dive_participant.session_id
        AND s.created_by = auth.uid()
    )
  );

-- ==================================================
-- LIVE CURSOR POLICIES (Real-time collaboration)
-- ==================================================

ALTER TABLE live_cursor ENABLE ROW LEVEL SECURITY;

-- See cursors on boards you have access to
CREATE POLICY cursor_board_access ON live_cursor
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employee e
      WHERE e.id = auth.uid() 
        AND e.org_id = 'demo_org'
    )
  );

-- ==================================================
-- BANDWIDTH PAIRING POLICIES
-- ==================================================

ALTER TABLE bandwidth_pairing ENABLE ROW LEVEL SECURITY;

-- See pairings you're involved in
CREATE POLICY pairing_involvement ON bandwidth_pairing
  FOR SELECT USING (
    low_bandwidth_employee = auth.uid() OR
    mentor_employee = auth.uid() OR
    app.current_employee_role() IN ('manager', 'exec')
  );

-- ==================================================
-- MIGRATION AUDIT POLICIES (For chaos mode transparency)
-- ==================================================

ALTER TABLE migration_audit ENABLE ROW LEVEL SECURITY;

-- Everyone in demo org can see migration history (transparency!)
CREATE POLICY migration_transparency ON migration_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employee e 
      WHERE e.id = auth.uid() AND e.org_id = 'demo_org'
    )
  );

-- Can create audit entries (system/service role only)
CREATE POLICY migration_audit_system ON migration_audit
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role' OR
    requester_id = auth.uid()
  );

-- ==================================================
-- SECURITY FUNCTIONS FOR RPC CALLS
-- ==================================================

-- Ensure user is authenticated demo employee
CREATE OR REPLACE FUNCTION app.require_demo_employee()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF app.current_employee_id() IS NULL THEN
    RAISE EXCEPTION 'DEMO_ACCESS_REQUIRED' USING 
      DETAIL = 'Must be authenticated demo organization employee';
  END IF;
END;
$$;

-- Ensure sufficient bandwidth for action
CREATE OR REPLACE FUNCTION app.require_bandwidth(min_score numeric)
RETURNS void  
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF app.current_bandwidth_score() < min_score THEN
    RAISE EXCEPTION 'ENGAGEMENT_TOO_LOW' USING
      DETAIL = format('Required bandwidth: %s, Current: %s', 
                     min_score, app.current_bandwidth_score());
  END IF;
END;
$$;

-- Ensure user has required role
CREATE OR REPLACE FUNCTION app.require_role(required_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER  
SET search_path = public
AS $$
BEGIN
  IF app.current_employee_role() != required_role THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS' USING
      DETAIL = format('Required role: %s, Current: %s',
                     required_role, app.current_employee_role());
  END IF;
END;
$$;

NOTIFY policies_loaded;