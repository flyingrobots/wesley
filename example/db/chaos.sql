-- S.L.A.P.S: Staged, Lock-Aware, Phased Steps
-- Database functions for migration execution with idempotency + monitoring

-- ==================================================
-- IDEMPOTENCY LEDGER
-- ==================================================

-- Track applied migration steps to prevent double-execution
CREATE TABLE IF NOT EXISTS migration_step_ledger (
  step_sha text PRIMARY KEY,
  plan_id text NOT NULL,
  wave_name text NOT NULL,
  step_data jsonb NOT NULL,
  applied_at timestamptz DEFAULT NOW(),
  applied_by uuid REFERENCES employee(id),
  execution_time_ms integer,
  rows_affected integer DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  
  -- Audit fields
  created_at timestamptz DEFAULT NOW(),
  CONSTRAINT valid_step_sha CHECK (length(step_sha) = 16)
);

-- Index for fast lookups during execution
CREATE INDEX IF NOT EXISTS idx_migration_step_ledger_plan 
  ON migration_step_ledger(plan_id, wave_name, applied_at);

-- ==================================================
-- EXECUTION STATE TRACKING
-- ==================================================

-- Track overall migration plan execution
CREATE TABLE IF NOT EXISTS migration_execution_state (
  plan_id text PRIMARY KEY,
  title text NOT NULL,
  requester_id uuid NOT NULL REFERENCES employee(id),
  current_wave text,
  current_wave_number integer DEFAULT 1,
  status text CHECK (status IN ('PLANNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'ROLLED_BACK')) DEFAULT 'PLANNED',
  
  -- Progress tracking
  waves_completed integer DEFAULT 0,
  steps_completed integer DEFAULT 0,
  total_steps integer NOT NULL,
  
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  estimated_completion timestamptz,
  
  -- Resource tracking  
  advisory_lock_id bigint,
  max_concurrent_ops integer DEFAULT 1,
  
  -- Error handling
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 2,
  
  -- Metadata
  plan_json jsonb NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Real-time execution events for live monitoring
CREATE TABLE IF NOT EXISTS migration_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES migration_execution_state(plan_id),
  event_type text NOT NULL CHECK (event_type IN (
    'plan.accepted', 'wave.start', 'step.start', 'step.ok', 'step.fail', 
    'wave.complete', 'abort.reason', 'governor.backpressure', 'lock.acquired', 'lock.timeout'
  )),
  
  -- Event data
  wave_name text,
  step_sha text,
  message text NOT NULL,
  metrics jsonb, -- {rows_touched, lock_wait_ms, stmt_ms, cpu_percent, etc}
  
  created_at timestamptz DEFAULT NOW()
);

-- Index for event streaming
CREATE INDEX IF NOT EXISTS idx_migration_events_plan_time 
  ON migration_execution_events(plan_id, created_at DESC);

-- ==================================================
-- ADVISORY LOCK MANAGEMENT
-- ==================================================

-- Acquire chaos migration lock (prevent concurrent migrations)
CREATE OR REPLACE FUNCTION app.acquire_migration_lock(plan_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_id bigint := 7777777; -- Fixed chaos mode lock ID
  acquired boolean := false;
BEGIN
  -- Try to acquire advisory lock (non-blocking)
  SELECT pg_try_advisory_lock(lock_id) INTO acquired;
  
  IF acquired THEN
    -- Update execution state with lock info
    UPDATE migration_execution_state 
    SET advisory_lock_id = lock_id,
        started_at = NOW(),
        status = 'RUNNING'
    WHERE migration_execution_state.plan_id = acquire_migration_lock.plan_id;
    
    -- Emit lock acquired event
    INSERT INTO migration_execution_events (plan_id, event_type, message, metrics)
    VALUES (acquire_migration_lock.plan_id, 'lock.acquired', 'Advisory lock acquired', 
            jsonb_build_object('lock_id', lock_id, 'timestamp', extract(epoch from now()) * 1000));
  ELSE
    -- Emit lock timeout event  
    INSERT INTO migration_execution_events (plan_id, event_type, message, metrics)
    VALUES (acquire_migration_lock.plan_id, 'lock.timeout', 'Could not acquire advisory lock - another migration in progress', 
            jsonb_build_object('lock_id', lock_id, 'timestamp', extract(epoch from now()) * 1000));
  END IF;
  
  RETURN acquired;
END;
$$;

-- Release chaos migration lock
CREATE OR REPLACE FUNCTION app.release_migration_lock(plan_id text)  
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_id bigint;
  released boolean := false;
BEGIN
  -- Get lock ID from execution state
  SELECT advisory_lock_id INTO lock_id 
  FROM migration_execution_state 
  WHERE migration_execution_state.plan_id = release_migration_lock.plan_id;
  
  IF lock_id IS NOT NULL THEN
    SELECT pg_advisory_unlock(lock_id) INTO released;
    
    -- Clear lock from execution state
    UPDATE migration_execution_state
    SET advisory_lock_id = NULL,
        completed_at = NOW()
    WHERE migration_execution_state.plan_id = release_migration_lock.plan_id;
    
    -- Emit lock release event
    INSERT INTO migration_execution_events (plan_id, event_type, message, metrics)
    VALUES (release_migration_lock.plan_id, 'lock.released', 'Advisory lock released',
            jsonb_build_object('lock_id', lock_id, 'timestamp', extract(epoch from now()) * 1000));
  END IF;
  
  RETURN released;
END;
$$;

-- ==================================================  
-- SAFE STEP EXECUTION
-- ==================================================

-- Apply one migration step with full safety rails
CREATE OR REPLACE FUNCTION app.apply_step(
  plan_id text,
  wave_name text,
  step_sha text, 
  stmt text,
  prechecks text[] DEFAULT ARRAY[]::text[],
  postchecks text[] DEFAULT ARRAY[]::text[],
  max_lock_ms integer DEFAULT 2000,
  max_stmt_ms integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  execution_time_ms integer;
  rows_affected integer := 0;
  result jsonb;
  check_sql text;
  check_result boolean;
  error_occurred boolean := false;
  error_msg text;
BEGIN
  start_time := clock_timestamp();
  
  -- Set timeouts for this statement
  PERFORM set_config('lock_timeout', max_lock_ms::text, true);
  PERFORM set_config('statement_timeout', max_stmt_ms::text, true);
  PERFORM set_config('idle_in_transaction_session_timeout', '5000', true);
  
  -- Emit step start event
  INSERT INTO migration_execution_events (plan_id, event_type, wave_name, step_sha, message, metrics)
  VALUES (apply_step.plan_id, 'step.start', apply_step.wave_name, apply_step.step_sha, 
          'Starting step execution', 
          jsonb_build_object('stmt', stmt, 'start_time', extract(epoch from start_time) * 1000));
  
  -- Check if already applied (idempotency)
  IF EXISTS (SELECT 1 FROM migration_step_ledger WHERE step_sha = apply_step.step_sha) THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'reason', 'already_applied',
      'step_sha', step_sha,
      'execution_time_ms', 0
    );
  END IF;
  
  BEGIN
    -- Run prechecks
    FOREACH check_sql IN ARRAY prechecks LOOP
      EXECUTE format('SELECT (%s)', check_sql) INTO check_result;
      IF NOT check_result THEN
        RAISE EXCEPTION 'Precheck failed: %', check_sql;
      END IF;
    END LOOP;
    
    -- Execute the statement
    EXECUTE stmt;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    -- Run postchecks  
    FOREACH check_sql IN ARRAY postchecks LOOP
      EXECUTE format('SELECT (%s)', check_sql) INTO check_result;
      IF NOT check_result THEN
        RAISE EXCEPTION 'Postcheck failed: %', check_sql;
      END IF;
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::integer;
    
    -- Record successful execution
    INSERT INTO migration_step_ledger (
      step_sha, plan_id, wave_name, step_data, applied_by, 
      execution_time_ms, rows_affected, success
    ) VALUES (
      apply_step.step_sha, apply_step.plan_id, apply_step.wave_name, 
      jsonb_build_object('stmt', stmt), app.current_employee_id(),
      execution_time_ms, rows_affected, true
    );
    
    -- Emit success event
    INSERT INTO migration_execution_events (plan_id, event_type, wave_name, step_sha, message, metrics)
    VALUES (apply_step.plan_id, 'step.ok', apply_step.wave_name, apply_step.step_sha,
            'Step completed successfully',
            jsonb_build_object(
              'execution_time_ms', execution_time_ms,
              'rows_affected', rows_affected,
              'stmt', stmt
            ));
    
    result := jsonb_build_object(
      'status', 'success',
      'step_sha', step_sha,
      'execution_time_ms', execution_time_ms,
      'rows_affected', rows_affected
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      error_occurred := true;
      error_msg := SQLERRM;
      end_time := clock_timestamp();
      execution_time_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::integer;
      
      -- Record failed execution
      INSERT INTO migration_step_ledger (
        step_sha, plan_id, wave_name, step_data, applied_by,
        execution_time_ms, rows_affected, success, error_message
      ) VALUES (
        apply_step.step_sha, apply_step.plan_id, apply_step.wave_name,
        jsonb_build_object('stmt', stmt), app.current_employee_id(),
        execution_time_ms, 0, false, error_msg
      );
      
      -- Emit failure event  
      INSERT INTO migration_execution_events (plan_id, event_type, wave_name, step_sha, message, metrics)
      VALUES (apply_step.plan_id, 'step.fail', apply_step.wave_name, apply_step.step_sha,
              format('Step failed: %s', error_msg),
              jsonb_build_object(
                'execution_time_ms', execution_time_ms,
                'error', error_msg,
                'stmt', stmt
              ));
      
      result := jsonb_build_object(
        'status', 'failed',
        'step_sha', step_sha,
        'execution_time_ms', execution_time_ms,
        'error', error_msg
      );
  END;
  
  RETURN result;
END;
$$;

-- ==================================================
-- SCHEMA VALIDATION HELPERS  
-- ==================================================

-- Check if table exists
CREATE OR REPLACE FUNCTION table_exists(table_name text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = table_exists.table_name
  );
$$;

-- Check if column exists
CREATE OR REPLACE FUNCTION column_exists(table_name text, column_name text)
RETURNS boolean  
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = column_exists.table_name 
      AND column_name = column_exists.column_name
  );
$$;

-- Check if index exists
CREATE OR REPLACE FUNCTION index_exists(index_name text)
RETURNS boolean
LANGUAGE sql STABLE  
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = index_exists.index_name
  );
$$;

-- Check if constraint exists
CREATE OR REPLACE FUNCTION constraint_exists(table_name text, constraint_name text)  
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = constraint_exists.table_name
      AND constraint_name = constraint_exists.constraint_name
  );
$$;

-- Check if constraint is valid (not NOT VALID)
CREATE OR REPLACE FUNCTION constraint_valid(table_name text, constraint_name text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT convalidated FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid  
     WHERE t.relname = constraint_valid.table_name 
       AND c.conname = constraint_valid.constraint_name), 
    false
  );
$$;

-- Check column nullability
CREATE OR REPLACE FUNCTION column_nullable(table_name text, column_name text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_nullable = 'YES' FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = column_nullable.table_name
       AND column_name = column_nullable.column_name),
    false
  );
$$;

-- Count null values in column (for SET NOT NULL readiness)
CREATE OR REPLACE FUNCTION count_nulls(table_name text, column_name text)
RETURNS bigint
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  null_count bigint;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE %I IS NULL', table_name, column_name)
  INTO null_count;
  RETURN null_count;
END;
$$;

-- Get column type
CREATE OR REPLACE FUNCTION column_type(table_name text, column_name text)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT data_type FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = column_type.table_name  
    AND column_name = column_type.column_name;
$$;

-- Check if index is valid (not corrupt/invalid)
CREATE OR REPLACE FUNCTION index_valid(index_name text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT indisvalid FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = index_valid.index_name),
    false  
  );
$$;

-- ==================================================
-- GOVERNOR: BACKPRESSURE + CIRCUIT BREAKER
-- ==================================================

-- Check system health and apply backpressure if needed
CREATE OR REPLACE FUNCTION app.check_governor_health(plan_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER  
AS $$
DECLARE
  active_connections integer;
  cpu_usage numeric;
  lock_wait_time numeric;
  recent_errors integer;
  health_status text := 'healthy';
  metrics jsonb;
  action_taken text := 'none';
BEGIN
  -- Get current system metrics
  SELECT count(*) INTO active_connections 
  FROM pg_stat_activity 
  WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';
  
  -- Estimate CPU usage from query runtime
  SELECT COALESCE(avg(extract(epoch from now() - query_start)), 0) INTO cpu_usage
  FROM pg_stat_activity 
  WHERE state = 'active' AND query_start IS NOT NULL;
  
  -- Check for lock contention
  SELECT count(*) INTO lock_wait_time
  FROM pg_stat_activity
  WHERE wait_event_type = 'Lock';
  
  -- Count recent step failures (last 5 minutes)
  SELECT count(*) INTO recent_errors
  FROM migration_execution_events
  WHERE event_type = 'step.fail' 
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND migration_execution_events.plan_id = check_governor_health.plan_id;
  
  -- Apply health thresholds
  IF active_connections > 50 OR recent_errors > 5 THEN
    health_status := 'degraded';
    action_taken := 'backpressure_applied';
    
    -- Emit governor event
    INSERT INTO migration_execution_events (plan_id, event_type, message, metrics)
    VALUES (check_governor_health.plan_id, 'governor.backpressure',
            'System under stress, applying backpressure',
            jsonb_build_object(
              'active_connections', active_connections,
              'recent_errors', recent_errors,
              'action', action_taken
            ));
    
  ELSIF active_connections > 80 OR recent_errors > 10 THEN
    health_status := 'circuit_open';
    action_taken := 'circuit_breaker_open';
    
    -- Update execution state to paused
    UPDATE migration_execution_state
    SET status = 'PAUSED', 
        error_message = 'Circuit breaker opened due to system stress'
    WHERE migration_execution_state.plan_id = check_governor_health.plan_id;
  END IF;
  
  metrics := jsonb_build_object(
    'health_status', health_status,
    'active_connections', active_connections,
    'estimated_cpu_usage', cpu_usage,
    'lock_contention', lock_wait_time,
    'recent_errors', recent_errors,
    'action_taken', action_taken,
    'timestamp', extract(epoch from now()) * 1000
  );
  
  RETURN metrics;
END;
$$;

NOTIFY chaos_ledger_loaded;