-- S.E.O. Demo Seed Data
-- Creates the shared corporate nightmare everyone participates in

-- Demo organization (everyone belongs here)
INSERT INTO organization (id, name, domain, created_at) VALUES 
('demo_org', 'WorkVybez™ Innovation Labs', 'workvybez.demo', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo departments
INSERT INTO department (id, org_id, name, created_at) VALUES 
('dept_eng', 'demo_org', 'Engineering', NOW()),
('dept_sales', 'demo_org', 'Sales & Growth', NOW()),
('dept_marketing', 'demo_org', 'Brand Synergy', NOW()),
('dept_hr', 'demo_org', 'People Operations', NOW()),
('dept_exec', 'demo_org', 'Strategic Leadership', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo teams within departments
INSERT INTO team (id, org_id, department_id, name, created_at) VALUES 
('team_frontend', 'demo_org', 'dept_eng', 'Frontend Innovators', NOW()),
('team_backend', 'demo_org', 'dept_eng', 'Infrastructure Architects', NOW()),
('team_growth', 'demo_org', 'dept_sales', 'Revenue Accelerators', NOW()),
('team_content', 'demo_org', 'dept_marketing', 'Content Strategists', NOW()),
('team_culture', 'demo_org', 'dept_hr', 'Culture Champions', NOW()),
('team_c_suite', 'demo_org', 'dept_exec', 'Executive Vision', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo role templates (users can switch between these)
INSERT INTO employee_role_template (role, display_name, permissions, surveillance_level) VALUES 
('worker', 'Individual Contributor', ARRAY['self_view', 'peer_chat', 'task_manage'], 1),
('manager', 'Team Lead', ARRAY['team_view', 'team_manage', 'intervention_trigger'], 3),
('exec', 'Executive', ARRAY['org_view', 'policy_override', 'strategic_insights'], 5)
ON CONFLICT (role) DO NOTHING;

-- Sample demo employees (bots that participate in the chaos)
INSERT INTO employee (id, email, display_name, org_id, department_id, role, current_bandwidth, engagement_level, created_at) VALUES 
('bot_sarah', 'sarah.chen@workvybez.demo', 'Sarah Chen', 'demo_org', 'dept_eng', 'manager', 87.3, 'ROCK_STAR', NOW() - INTERVAL '3 months'),
('bot_alex', 'alex.kim@workvybez.demo', 'Alex Kim', 'demo_org', 'dept_eng', 'worker', 52.8, 'STEADY', NOW() - INTERVAL '2 months'), 
('bot_jordan', 'jordan.park@workvybez.demo', 'Jordan Park', 'demo_org', 'dept_sales', 'worker', 44.1, 'AT_RISK', NOW() - INTERVAL '1 month'),
('bot_casey', 'casey.taylor@workvybez.demo', 'Casey Taylor', 'demo_org', 'dept_marketing', 'manager', 78.9, 'ROCK_STAR', NOW() - INTERVAL '6 months'),
('bot_riley', 'riley.morgan@workvybez.demo', 'Riley Morgan', 'demo_org', 'dept_hr', 'worker', 91.2, 'ROCK_STAR', NOW() - INTERVAL '4 months'),
('bot_ceo', 'jennifer.wright@workvybez.demo', 'Jennifer Wright', 'demo_org', 'dept_exec', 'exec', 95.7, 'ROCK_STAR', NOW() - INTERVAL '1 year')
ON CONFLICT (id) DO NOTHING;

-- Demo plates (tasks) that people can delegate
INSERT INTO plate_item (id, title, description, plate_size, estimated_hours, assigned_to, org_id, is_visible_to_team, created_at) VALUES 
('plate_mockups', 'Design new dashboard mockups', 'Create wireframes and high-fidelity designs for Q4 engagement dashboard', 'ENTREE', 6, 'bot_alex', 'demo_org', true, NOW() - INTERVAL '2 days'),
('plate_presentation', 'Prepare Q4 strategy presentation', 'Compile metrics and create executive-level strategic overview', 'FAMILY_STYLE', 16, 'bot_sarah', 'demo_org', true, NOW() - INTERVAL '1 day'),
('plate_research', 'Competitive analysis deep-dive', 'Research emerging productivity platforms and ideation tools', 'APPETIZER', 2, 'bot_jordan', 'demo_org', true, NOW() - INTERVAL '3 hours'),
('plate_launch', 'Product launch campaign execution', 'Coordinate cross-functional go-to-market strategy', 'THANKSGIVING', 120, 'bot_casey', 'demo_org', true, NOW() - INTERVAL '1 week')
ON CONFLICT (id) DO NOTHING;

-- Demo chat channels for touchpoint spam
INSERT INTO touchpoint_channel (id, name, description, org_id, minimum_engagement_score, created_at) VALUES 
('chan_general', 'general-synergy', 'Company-wide collaboration and thought leadership', 'demo_org', 40.0, NOW() - INTERVAL '6 months'),
('chan_random', 'random-ideation', 'Casual innovation and creative brainstorming', 'demo_org', 30.0, NOW() - INTERVAL '6 months'),
('chan_leadership', 'leadership-excellence', 'Strategic discussions and executive insights', 'demo_org', 70.0, NOW() - INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;

-- Sample touchpoint messages (corporate buzzword paradise)
INSERT INTO touchpoint_message (id, sender_id, channel_id, content, buzzword_count, sentiment_score, created_at) VALUES 
('msg_1', 'bot_sarah', 'chan_general', 'Let''s circle back on this low-hanging fruit and leverage our core competencies for maximum synergy! 🚀', 5, 0.8, NOW() - INTERVAL '2 hours'),
('msg_2', 'bot_alex', 'chan_general', 'I''m looking for thought leadership on how we can operationalize our holistic approach to bandwidth optimization.', 4, 0.6, NOW() - INTERVAL '90 minutes'),
('msg_3', 'bot_jordan', 'chan_random', 'Quick sync needed - my bandwidth is declining but I''m committed to moving the needle on our deliverables! 💪', 3, 0.4, NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- Demo ideation slides with mandatory buzzword compliance
INSERT INTO ideation_slide (id, title, creator_id, leveraging_field, operationalizing_field, scalability_field, roi_potential_field, cross_functional_field, thought_leadership_field, buzzword_compliance_score, is_published, created_at) VALUES 
('slide_ai', 'AI-Powered Bandwidth Enhancement', 'bot_sarah', 
 'Leveraging our existing employee engagement data and productivity metrics to create predictive models', 
 'Operationalizing through real-time algorithm deployment with automated coaching triggers and intervention workflows',
 'Scalability achieved via cloud-native microservices architecture supporting unlimited concurrent employee analysis',
 'ROI potential estimated at 300% productivity improvement with 67% reduction in performance management overhead',
 'Cross-functional collaboration between Engineering, HR, and Data Science teams with executive sponsorship',
 'Thought leadership opportunity to pioneer next-generation workplace optimization through algorithmic excellence',
 94.2, true, NOW() - INTERVAL '3 days'),
('slide_remote', 'Remote Synergy Amplification Framework', 'bot_casey',
 'Leveraging distributed team dynamics and asynchronous collaboration patterns for enhanced creative output',
 'Operationalizing via structured ideation sessions with mandatory compliance frameworks and output metrics', 
 'Scalability through standardized remote engagement protocols applicable across all organizational verticals',
 'ROI potential includes 45% reduction in coordination overhead and 23% increase in cross-team innovation velocity',
 'Cross-functional impact spanning Operations, Technology, and Strategic Planning with culture transformation focus',
 'Thought leadership positioning around future of work optimization and distributed team excellence methodologies',
 89.7, true, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Demo migration audit log (so people can see the chaos history)
INSERT INTO migration_audit (id, requester_id, plan_title, plan_json, status, execution_time_ms, rows_affected, created_at) VALUES 
('audit_coffee', 'bot_alex', 'Coffee Dependency Tracking', '{"ops":[{"op":"add_column","table":"employee","name":"coffee_dependency","type":"numeric"}]}', 'SUCCESS', 1247, 47, NOW() - INTERVAL '4 hours'),
('audit_focus', 'bot_sarah', 'Focus Time Optimization', '{"ops":[{"op":"add_index_concurrently","table":"activity_event","cols":["employee_id","created_at"]}]}', 'SUCCESS', 892, 0, NOW() - INTERVAL '2 hours'),
('audit_failed', 'bot_jordan', 'Productivity Multiplier', '{"ops":[{"op":"add_column","table":"nonexistent_table","name":"multiplier","type":"float"}]}', 'FAILED', 156, 0, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- Demo birthday setup (for The Birthday Experience™)
UPDATE employee SET 
  date_of_birth = CASE 
    WHEN id = 'bot_alex' THEN (CURRENT_DATE - INTERVAL '1 day')  -- Yesterday was Alex's birthday
    WHEN id = 'bot_jordan' THEN CURRENT_DATE                     -- Today is Jordan's birthday!
    WHEN id = 'bot_sarah' THEN (CURRENT_DATE + INTERVAL '3 days') -- Sarah's birthday coming up
    ELSE (CURRENT_DATE - INTERVAL '6 months' + (RANDOM() * 365)::integer)
  END
WHERE id LIKE 'bot_%';

-- Initialize activity events for realistic bandwidth scores
INSERT INTO activity_event (id, employee_id, activity_type, raw_data, productivity_impact, engagement_factor, created_at)
SELECT 
  gen_random_uuid(),
  e.id,
  (ARRAY['KEYSTROKE', 'MOUSE_MOVEMENT', 'CHAT_PARTICIPATION', 'COLLABORATION'])[floor(random() * 4 + 1)],
  '{"simulated": true}',
  random() * 2 - 1,  -- -1 to 1 impact
  random(),          -- 0 to 1 engagement
  NOW() - (random() * INTERVAL '2 hours')
FROM employee e, generate_series(1, 20) -- 20 events per bot employee
WHERE e.id LIKE 'bot_%'
ON CONFLICT DO NOTHING;

-- Demo forced pairing (Jordan needs help!)
INSERT INTO bandwidth_pairing (id, low_bandwidth_employee, current_bandwidth_score, mentor_employee, mentor_bandwidth_score, reason, expected_duration_hours, is_active, created_at) VALUES 
('pairing_help_jordan', 'bot_jordan', 44.1, 'bot_sarah', 87.3, 'Automated pairing due to bandwidth decline below 45% - focusing on task prioritization and engagement strategies', 4, true, NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- Demo deep dive session happening "right now"  
INSERT INTO deep_dive_session (id, title, description, scheduled_start, scheduled_end, camera_required, facial_analysis_enabled, engagement_monitoring, created_by, created_at) VALUES 
('session_q4_strategy', 'Q4 Strategy Deep Dive', 'Cross-functional alignment on strategic priorities and bandwidth optimization initiatives', NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '45 minutes', true, true, true, 'bot_ceo', NOW() - INTERVAL '20 minutes')
ON CONFLICT (id) DO NOTHING;

-- Demo participants in the session
INSERT INTO deep_dive_participant (id, session_id, employee_id, camera_on_percentage, engagement_score, joined_at) VALUES 
('part_ceo', 'session_q4_strategy', 'bot_ceo', 98.5, 94.2, NOW() - INTERVAL '15 minutes'),
('part_sarah', 'session_q4_strategy', 'bot_sarah', 87.3, 78.9, NOW() - INTERVAL '12 minutes'),
('part_casey', 'session_q4_strategy', 'bot_casey', 91.7, 82.4, NOW() - INTERVAL '8 minutes')
ON CONFLICT (id) DO NOTHING;

-- Recent delegation broadcast (public accountability in action)
INSERT INTO delegation_event (id, plate_item_id, from_employee, to_employee, reason, is_public, team_notified, created_at) VALUES 
('delegate_mockups', 'plate_mockups', 'bot_alex', 'bot_sarah', 'Sarah has stronger design system expertise and available bandwidth for this critical Q4 initiative', true, true, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- Update plate ownership after delegation
UPDATE plate_item SET 
  assigned_to = 'bot_sarah',
  delegated_by = 'bot_alex',
  delegation_count = 1
WHERE id = 'plate_mockups';

NOTIFY demo_seeded;