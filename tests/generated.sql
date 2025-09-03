-- ══════════════════════════════════════════════════════════════════
-- Wesley Generated pgTAP Test Suite
-- Generated: 2025-09-03T18:35:17.946Z
-- SHA: uncommitted
-- ══════════════════════════════════════════════════════════════════

-- Setup test environment
BEGIN;

-- Set deterministic environment
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '5s';

-- Count tests for plan
SELECT plan(336);

-- ══════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- STRUCTURE TESTS
-- Testing tables, columns, and types
-- ══════════════════════════════════════════════════════

-- Table: Organization (weight: 3)
SELECT has_table('Organization', 'Table Organization should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:Organization.id -> no evidence map
SELECT has_column('Organization', 'id', 'Column Organization.id should exist');
SELECT col_type_is('Organization', 'id', 'uuid', 'Organization.id should be type uuid');
SELECT col_not_null('Organization', 'id', 'Organization.id should not be nullable');
SELECT col_is_pk('Organization', 'id', 'Organization.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: name
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:Organization.name -> no evidence map
SELECT has_column('Organization', 'name', 'Column Organization.name should exist');
SELECT col_type_is('Organization', 'name', 'text', 'Organization.name should be type text');

-- Field: surveillance_level
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Organization.surveillance_level -> no evidence map
SELECT has_column('Organization', 'surveillance_level', 'Column Organization.surveillance_level should exist');
SELECT col_type_is('Organization', 'surveillance_level', 'integer', 'Organization.surveillance_level should be type integer');
SELECT col_not_null('Organization', 'surveillance_level', 'Organization.surveillance_level should not be nullable');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Organization.created_at -> no evidence map
SELECT has_column('Organization', 'created_at', 'Column Organization.created_at should exist');
SELECT col_type_is('Organization', 'created_at', 'timestamptz', 'Organization.created_at should be type timestamptz');
SELECT col_not_null('Organization', 'created_at', 'Organization.created_at should not be nullable');

-- Field: deleted_at
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Organization.deleted_at -> no evidence map
SELECT has_column('Organization', 'deleted_at', 'Column Organization.deleted_at should exist');
SELECT col_type_is('Organization', 'deleted_at', 'timestamptz', 'Organization.deleted_at should be type timestamptz');

-- Table: Department (weight: 3)
SELECT has_table('Department', 'Table Department should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:Department.id -> no evidence map
SELECT has_column('Department', 'id', 'Column Department.id should exist');
SELECT col_type_is('Department', 'id', 'uuid', 'Department.id should be type uuid');
SELECT col_not_null('Department', 'id', 'Department.id should not be nullable');
SELECT col_is_pk('Department', 'id', 'Department.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: organization_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:Department.organization_id -> no evidence map
SELECT has_column('Department', 'organization_id', 'Column Department.organization_id should exist');
SELECT col_type_is('Department', 'organization_id', 'uuid', 'Department.organization_id should be type uuid');
SELECT col_not_null('Department', 'organization_id', 'Department.organization_id should not be nullable');
SELECT fk_ok('Department', 'organization_id', 'Organization', 'id', 'Department.organization_id references Organization');

-- Field: name
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:Department.name -> no evidence map
SELECT has_column('Department', 'name', 'Column Department.name should exist');
SELECT col_type_is('Department', 'name', 'text', 'Department.name should be type text');

-- Field: budget
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Department.budget -> no evidence map
SELECT has_column('Department', 'budget', 'Column Department.budget should exist');
SELECT col_type_is('Department', 'budget', 'double precision', 'Department.budget should be type double precision');

-- Field: manager_override_surveillance
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Department.manager_override_surveillance -> no evidence map
SELECT has_column('Department', 'manager_override_surveillance', 'Column Department.manager_override_surveillance should exist');
SELECT col_type_is('Department', 'manager_override_surveillance', 'boolean', 'Department.manager_override_surveillance should be type boolean');
SELECT col_not_null('Department', 'manager_override_surveillance', 'Department.manager_override_surveillance should not be nullable');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Department.created_at -> no evidence map
SELECT has_column('Department', 'created_at', 'Column Department.created_at should exist');
SELECT col_type_is('Department', 'created_at', 'timestamptz', 'Department.created_at should be type timestamptz');
SELECT col_not_null('Department', 'created_at', 'Department.created_at should not be nullable');

-- Table: Employee (weight: 3)
SELECT has_table('Employee', 'Table Employee should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:Employee.id -> no evidence map
SELECT has_column('Employee', 'id', 'Column Employee.id should exist');
SELECT col_type_is('Employee', 'id', 'uuid', 'Employee.id should be type uuid');
SELECT col_not_null('Employee', 'id', 'Employee.id should not be nullable');
SELECT col_is_pk('Employee', 'id', 'Employee.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: user_id
-- Weight: 40/100
-- Test Depth: STANDARD
-- Attributes: UNIQUE, NOT NULL
-- EVIDENCE: col:Employee.user_id -> no evidence map
SELECT has_column('Employee', 'user_id', 'Column Employee.user_id should exist');
SELECT col_type_is('Employee', 'user_id', 'uuid', 'Employee.user_id should be type uuid');
SELECT col_not_null('Employee', 'user_id', 'Employee.user_id should not be nullable');
SELECT col_is_unique('Employee', 'user_id', 'Employee.user_id should be unique');

-- Field: email
-- Weight: 40/100
-- Test Depth: STANDARD
-- Attributes: UNIQUE, NOT NULL
-- EVIDENCE: col:Employee.email -> no evidence map
SELECT has_column('Employee', 'email', 'Column Employee.email should exist');
SELECT col_type_is('Employee', 'email', 'text', 'Employee.email should be type text');
SELECT col_not_null('Employee', 'email', 'Employee.email should not be nullable');
SELECT col_is_unique('Employee', 'email', 'Employee.email should be unique');

-- Field: name
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:Employee.name -> no evidence map
SELECT has_column('Employee', 'name', 'Column Employee.name should exist');
SELECT col_type_is('Employee', 'name', 'text', 'Employee.name should be type text');

-- Field: surveillance_level
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Employee.surveillance_level -> no evidence map
SELECT has_column('Employee', 'surveillance_level', 'Column Employee.surveillance_level should exist');
SELECT col_type_is('Employee', 'surveillance_level', 'integer', 'Employee.surveillance_level should be type integer');
SELECT col_not_null('Employee', 'surveillance_level', 'Employee.surveillance_level should not be nullable');

-- Field: productivity_score
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Employee.productivity_score -> no evidence map
SELECT has_column('Employee', 'productivity_score', 'Column Employee.productivity_score should exist');
SELECT col_type_is('Employee', 'productivity_score', 'double precision', 'Employee.productivity_score should be type double precision');

-- Field: current_bandwidth
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Employee.current_bandwidth -> no evidence map
SELECT has_column('Employee', 'current_bandwidth', 'Column Employee.current_bandwidth should exist');
SELECT col_type_is('Employee', 'current_bandwidth', 'double precision', 'Employee.current_bandwidth should be type double precision');

-- Field: is_being_coached
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Employee.is_being_coached -> no evidence map
SELECT has_column('Employee', 'is_being_coached', 'Column Employee.is_being_coached should exist');
SELECT col_type_is('Employee', 'is_being_coached', 'boolean', 'Employee.is_being_coached should be type boolean');
SELECT col_not_null('Employee', 'is_being_coached', 'Employee.is_being_coached should not be nullable');

-- Field: last_activity
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Employee.last_activity -> no evidence map
SELECT has_column('Employee', 'last_activity', 'Column Employee.last_activity should exist');
SELECT col_type_is('Employee', 'last_activity', 'timestamptz', 'Employee.last_activity should be type timestamptz');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Employee.created_at -> no evidence map
SELECT has_column('Employee', 'created_at', 'Column Employee.created_at should exist');
SELECT col_type_is('Employee', 'created_at', 'timestamptz', 'Employee.created_at should be type timestamptz');
SELECT col_not_null('Employee', 'created_at', 'Employee.created_at should not be nullable');

-- Table: OrganizationAdmin (weight: 3)
SELECT has_table('OrganizationAdmin', 'Table OrganizationAdmin should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:OrganizationAdmin.id -> no evidence map
SELECT has_column('OrganizationAdmin', 'id', 'Column OrganizationAdmin.id should exist');
SELECT col_type_is('OrganizationAdmin', 'id', 'uuid', 'OrganizationAdmin.id should be type uuid');
SELECT col_not_null('OrganizationAdmin', 'id', 'OrganizationAdmin.id should not be nullable');
SELECT col_is_pk('OrganizationAdmin', 'id', 'OrganizationAdmin.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:OrganizationAdmin.user_id -> no evidence map
SELECT has_column('OrganizationAdmin', 'user_id', 'Column OrganizationAdmin.user_id should exist');
SELECT col_type_is('OrganizationAdmin', 'user_id', 'uuid', 'OrganizationAdmin.user_id should be type uuid');
SELECT col_not_null('OrganizationAdmin', 'user_id', 'OrganizationAdmin.user_id should not be nullable');
SELECT fk_ok('OrganizationAdmin', 'user_id', 'Employee', 'user_id', 'OrganizationAdmin.user_id references Employee');

-- Field: org_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:OrganizationAdmin.org_id -> no evidence map
SELECT has_column('OrganizationAdmin', 'org_id', 'Column OrganizationAdmin.org_id should exist');
SELECT col_type_is('OrganizationAdmin', 'org_id', 'uuid', 'OrganizationAdmin.org_id should be type uuid');
SELECT col_not_null('OrganizationAdmin', 'org_id', 'OrganizationAdmin.org_id should not be nullable');
SELECT fk_ok('OrganizationAdmin', 'org_id', 'Organization', 'id', 'OrganizationAdmin.org_id references Organization');

-- Field: granted_by
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: FK
-- EVIDENCE: col:OrganizationAdmin.granted_by -> no evidence map
SELECT has_column('OrganizationAdmin', 'granted_by', 'Column OrganizationAdmin.granted_by should exist');
SELECT col_type_is('OrganizationAdmin', 'granted_by', 'uuid', 'OrganizationAdmin.granted_by should be type uuid');
SELECT fk_ok('OrganizationAdmin', 'granted_by', 'Employee', 'user_id', 'OrganizationAdmin.granted_by references Employee');

-- Field: granted_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:OrganizationAdmin.granted_at -> no evidence map
SELECT has_column('OrganizationAdmin', 'granted_at', 'Column OrganizationAdmin.granted_at should exist');
SELECT col_type_is('OrganizationAdmin', 'granted_at', 'timestamptz', 'OrganizationAdmin.granted_at should be type timestamptz');
SELECT col_not_null('OrganizationAdmin', 'granted_at', 'OrganizationAdmin.granted_at should not be nullable');

-- Table: DepartmentMember (weight: 3)
SELECT has_table('DepartmentMember', 'Table DepartmentMember should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:DepartmentMember.id -> no evidence map
SELECT has_column('DepartmentMember', 'id', 'Column DepartmentMember.id should exist');
SELECT col_type_is('DepartmentMember', 'id', 'uuid', 'DepartmentMember.id should be type uuid');
SELECT col_not_null('DepartmentMember', 'id', 'DepartmentMember.id should not be nullable');
SELECT col_is_pk('DepartmentMember', 'id', 'DepartmentMember.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentMember.user_id -> no evidence map
SELECT has_column('DepartmentMember', 'user_id', 'Column DepartmentMember.user_id should exist');
SELECT col_type_is('DepartmentMember', 'user_id', 'uuid', 'DepartmentMember.user_id should be type uuid');
SELECT col_not_null('DepartmentMember', 'user_id', 'DepartmentMember.user_id should not be nullable');
SELECT fk_ok('DepartmentMember', 'user_id', 'Employee', 'user_id', 'DepartmentMember.user_id references Employee');

-- Field: dept_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentMember.dept_id -> no evidence map
SELECT has_column('DepartmentMember', 'dept_id', 'Column DepartmentMember.dept_id should exist');
SELECT col_type_is('DepartmentMember', 'dept_id', 'uuid', 'DepartmentMember.dept_id should be type uuid');
SELECT col_not_null('DepartmentMember', 'dept_id', 'DepartmentMember.dept_id should not be nullable');
SELECT fk_ok('DepartmentMember', 'dept_id', 'Department', 'id', 'DepartmentMember.dept_id references Department');

-- Field: organization_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentMember.organization_id -> no evidence map
SELECT has_column('DepartmentMember', 'organization_id', 'Column DepartmentMember.organization_id should exist');
SELECT col_type_is('DepartmentMember', 'organization_id', 'uuid', 'DepartmentMember.organization_id should be type uuid');
SELECT col_not_null('DepartmentMember', 'organization_id', 'DepartmentMember.organization_id should not be nullable');
SELECT fk_ok('DepartmentMember', 'organization_id', 'Organization', 'id', 'DepartmentMember.organization_id references Organization');

-- Field: role
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:DepartmentMember.role -> no evidence map
SELECT has_column('DepartmentMember', 'role', 'Column DepartmentMember.role should exist');
SELECT col_type_is('DepartmentMember', 'role', 'text', 'DepartmentMember.role should be type text');
SELECT col_not_null('DepartmentMember', 'role', 'DepartmentMember.role should not be nullable');

-- Field: joined_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:DepartmentMember.joined_at -> no evidence map
SELECT has_column('DepartmentMember', 'joined_at', 'Column DepartmentMember.joined_at should exist');
SELECT col_type_is('DepartmentMember', 'joined_at', 'timestamptz', 'DepartmentMember.joined_at should be type timestamptz');
SELECT col_not_null('DepartmentMember', 'joined_at', 'DepartmentMember.joined_at should not be nullable');

-- Table: DepartmentManager (weight: 3)
SELECT has_table('DepartmentManager', 'Table DepartmentManager should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:DepartmentManager.id -> no evidence map
SELECT has_column('DepartmentManager', 'id', 'Column DepartmentManager.id should exist');
SELECT col_type_is('DepartmentManager', 'id', 'uuid', 'DepartmentManager.id should be type uuid');
SELECT col_not_null('DepartmentManager', 'id', 'DepartmentManager.id should not be nullable');
SELECT col_is_pk('DepartmentManager', 'id', 'DepartmentManager.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentManager.user_id -> no evidence map
SELECT has_column('DepartmentManager', 'user_id', 'Column DepartmentManager.user_id should exist');
SELECT col_type_is('DepartmentManager', 'user_id', 'uuid', 'DepartmentManager.user_id should be type uuid');
SELECT col_not_null('DepartmentManager', 'user_id', 'DepartmentManager.user_id should not be nullable');
SELECT fk_ok('DepartmentManager', 'user_id', 'Employee', 'user_id', 'DepartmentManager.user_id references Employee');

-- Field: dept_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentManager.dept_id -> no evidence map
SELECT has_column('DepartmentManager', 'dept_id', 'Column DepartmentManager.dept_id should exist');
SELECT col_type_is('DepartmentManager', 'dept_id', 'uuid', 'DepartmentManager.dept_id should be type uuid');
SELECT col_not_null('DepartmentManager', 'dept_id', 'DepartmentManager.dept_id should not be nullable');
SELECT fk_ok('DepartmentManager', 'dept_id', 'Department', 'id', 'DepartmentManager.dept_id references Department');

-- Field: appointed_by
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:DepartmentManager.appointed_by -> no evidence map
SELECT has_column('DepartmentManager', 'appointed_by', 'Column DepartmentManager.appointed_by should exist');
SELECT col_type_is('DepartmentManager', 'appointed_by', 'uuid', 'DepartmentManager.appointed_by should be type uuid');
SELECT col_not_null('DepartmentManager', 'appointed_by', 'DepartmentManager.appointed_by should not be nullable');
SELECT fk_ok('DepartmentManager', 'appointed_by', 'Employee', 'user_id', 'DepartmentManager.appointed_by references Employee');

-- Field: appointed_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:DepartmentManager.appointed_at -> no evidence map
SELECT has_column('DepartmentManager', 'appointed_at', 'Column DepartmentManager.appointed_at should exist');
SELECT col_type_is('DepartmentManager', 'appointed_at', 'timestamptz', 'DepartmentManager.appointed_at should be type timestamptz');
SELECT col_not_null('DepartmentManager', 'appointed_at', 'DepartmentManager.appointed_at should not be nullable');

-- Table: ActivityEvent (weight: 3)
SELECT has_table('ActivityEvent', 'Table ActivityEvent should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:ActivityEvent.id -> no evidence map
SELECT has_column('ActivityEvent', 'id', 'Column ActivityEvent.id should exist');
SELECT col_type_is('ActivityEvent', 'id', 'uuid', 'ActivityEvent.id should be type uuid');
SELECT col_not_null('ActivityEvent', 'id', 'ActivityEvent.id should not be nullable');
SELECT col_is_pk('ActivityEvent', 'id', 'ActivityEvent.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: employee_user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:ActivityEvent.employee_user_id -> no evidence map
SELECT has_column('ActivityEvent', 'employee_user_id', 'Column ActivityEvent.employee_user_id should exist');
SELECT col_type_is('ActivityEvent', 'employee_user_id', 'uuid', 'ActivityEvent.employee_user_id should be type uuid');
SELECT col_not_null('ActivityEvent', 'employee_user_id', 'ActivityEvent.employee_user_id should not be nullable');
SELECT fk_ok('ActivityEvent', 'employee_user_id', 'Employee', 'user_id', 'ActivityEvent.employee_user_id references Employee');

-- Field: event_type
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:ActivityEvent.event_type -> no evidence map
SELECT has_column('ActivityEvent', 'event_type', 'Column ActivityEvent.event_type should exist');
SELECT col_type_is('ActivityEvent', 'event_type', 'text', 'ActivityEvent.event_type should be type text');

-- Field: raw_data
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:ActivityEvent.raw_data -> no evidence map
SELECT has_column('ActivityEvent', 'raw_data', 'Column ActivityEvent.raw_data should exist');
SELECT col_type_is('ActivityEvent', 'raw_data', 'text', 'ActivityEvent.raw_data should be type text');

-- Field: productivity_impact
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:ActivityEvent.productivity_impact -> no evidence map
SELECT has_column('ActivityEvent', 'productivity_impact', 'Column ActivityEvent.productivity_impact should exist');
SELECT col_type_is('ActivityEvent', 'productivity_impact', 'double precision', 'ActivityEvent.productivity_impact should be type double precision');

-- Field: surveillance_triggered
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:ActivityEvent.surveillance_triggered -> no evidence map
SELECT has_column('ActivityEvent', 'surveillance_triggered', 'Column ActivityEvent.surveillance_triggered should exist');
SELECT col_type_is('ActivityEvent', 'surveillance_triggered', 'boolean', 'ActivityEvent.surveillance_triggered should be type boolean');
SELECT col_not_null('ActivityEvent', 'surveillance_triggered', 'ActivityEvent.surveillance_triggered should not be nullable');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:ActivityEvent.created_at -> no evidence map
SELECT has_column('ActivityEvent', 'created_at', 'Column ActivityEvent.created_at should exist');
SELECT col_type_is('ActivityEvent', 'created_at', 'timestamptz', 'ActivityEvent.created_at should be type timestamptz');
SELECT col_not_null('ActivityEvent', 'created_at', 'ActivityEvent.created_at should not be nullable');

-- Table: CoachingPair (weight: 3)
SELECT has_table('CoachingPair', 'Table CoachingPair should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:CoachingPair.id -> no evidence map
SELECT has_column('CoachingPair', 'id', 'Column CoachingPair.id should exist');
SELECT col_type_is('CoachingPair', 'id', 'uuid', 'CoachingPair.id should be type uuid');
SELECT col_not_null('CoachingPair', 'id', 'CoachingPair.id should not be nullable');
SELECT col_is_pk('CoachingPair', 'id', 'CoachingPair.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: coach_user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:CoachingPair.coach_user_id -> no evidence map
SELECT has_column('CoachingPair', 'coach_user_id', 'Column CoachingPair.coach_user_id should exist');
SELECT col_type_is('CoachingPair', 'coach_user_id', 'uuid', 'CoachingPair.coach_user_id should be type uuid');
SELECT col_not_null('CoachingPair', 'coach_user_id', 'CoachingPair.coach_user_id should not be nullable');
SELECT fk_ok('CoachingPair', 'coach_user_id', 'Employee', 'user_id', 'CoachingPair.coach_user_id references Employee');

-- Field: coachee_user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:CoachingPair.coachee_user_id -> no evidence map
SELECT has_column('CoachingPair', 'coachee_user_id', 'Column CoachingPair.coachee_user_id should exist');
SELECT col_type_is('CoachingPair', 'coachee_user_id', 'uuid', 'CoachingPair.coachee_user_id should be type uuid');
SELECT col_not_null('CoachingPair', 'coachee_user_id', 'CoachingPair.coachee_user_id should not be nullable');
SELECT fk_ok('CoachingPair', 'coachee_user_id', 'Employee', 'user_id', 'CoachingPair.coachee_user_id references Employee');

-- Field: pairing_reason
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:CoachingPair.pairing_reason -> no evidence map
SELECT has_column('CoachingPair', 'pairing_reason', 'Column CoachingPair.pairing_reason should exist');
SELECT col_type_is('CoachingPair', 'pairing_reason', 'text', 'CoachingPair.pairing_reason should be type text');

-- Field: target_bandwidth
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:CoachingPair.target_bandwidth -> no evidence map
SELECT has_column('CoachingPair', 'target_bandwidth', 'Column CoachingPair.target_bandwidth should exist');
SELECT col_type_is('CoachingPair', 'target_bandwidth', 'double precision', 'CoachingPair.target_bandwidth should be type double precision');

-- Field: sessions_completed
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:CoachingPair.sessions_completed -> no evidence map
SELECT has_column('CoachingPair', 'sessions_completed', 'Column CoachingPair.sessions_completed should exist');
SELECT col_type_is('CoachingPair', 'sessions_completed', 'integer', 'CoachingPair.sessions_completed should be type integer');
SELECT col_not_null('CoachingPair', 'sessions_completed', 'CoachingPair.sessions_completed should not be nullable');

-- Field: is_active
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:CoachingPair.is_active -> no evidence map
SELECT has_column('CoachingPair', 'is_active', 'Column CoachingPair.is_active should exist');
SELECT col_type_is('CoachingPair', 'is_active', 'boolean', 'CoachingPair.is_active should be type boolean');
SELECT col_not_null('CoachingPair', 'is_active', 'CoachingPair.is_active should not be nullable');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:CoachingPair.created_at -> no evidence map
SELECT has_column('CoachingPair', 'created_at', 'Column CoachingPair.created_at should exist');
SELECT col_type_is('CoachingPair', 'created_at', 'timestamptz', 'CoachingPair.created_at should be type timestamptz');
SELECT col_not_null('CoachingPair', 'created_at', 'CoachingPair.created_at should not be nullable');

-- Field: completed_at
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:CoachingPair.completed_at -> no evidence map
SELECT has_column('CoachingPair', 'completed_at', 'Column CoachingPair.completed_at should exist');
SELECT col_type_is('CoachingPair', 'completed_at', 'timestamptz', 'CoachingPair.completed_at should be type timestamptz');

-- Table: MeetingEngagement (weight: 3)
SELECT has_table('MeetingEngagement', 'Table MeetingEngagement should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:MeetingEngagement.id -> no evidence map
SELECT has_column('MeetingEngagement', 'id', 'Column MeetingEngagement.id should exist');
SELECT col_type_is('MeetingEngagement', 'id', 'uuid', 'MeetingEngagement.id should be type uuid');
SELECT col_not_null('MeetingEngagement', 'id', 'MeetingEngagement.id should not be nullable');
SELECT col_is_pk('MeetingEngagement', 'id', 'MeetingEngagement.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: employee_user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:MeetingEngagement.employee_user_id -> no evidence map
SELECT has_column('MeetingEngagement', 'employee_user_id', 'Column MeetingEngagement.employee_user_id should exist');
SELECT col_type_is('MeetingEngagement', 'employee_user_id', 'uuid', 'MeetingEngagement.employee_user_id should be type uuid');
SELECT col_not_null('MeetingEngagement', 'employee_user_id', 'MeetingEngagement.employee_user_id should not be nullable');
SELECT fk_ok('MeetingEngagement', 'employee_user_id', 'Employee', 'user_id', 'MeetingEngagement.employee_user_id references Employee');

-- Field: meeting_id
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:MeetingEngagement.meeting_id -> no evidence map
SELECT has_column('MeetingEngagement', 'meeting_id', 'Column MeetingEngagement.meeting_id should exist');
SELECT col_type_is('MeetingEngagement', 'meeting_id', 'uuid', 'MeetingEngagement.meeting_id should be type uuid');

-- Field: engagement_score
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:MeetingEngagement.engagement_score -> no evidence map
SELECT has_column('MeetingEngagement', 'engagement_score', 'Column MeetingEngagement.engagement_score should exist');
SELECT col_type_is('MeetingEngagement', 'engagement_score', 'double precision', 'MeetingEngagement.engagement_score should be type double precision');

-- Field: eye_contact_percentage
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:MeetingEngagement.eye_contact_percentage -> no evidence map
SELECT has_column('MeetingEngagement', 'eye_contact_percentage', 'Column MeetingEngagement.eye_contact_percentage should exist');
SELECT col_type_is('MeetingEngagement', 'eye_contact_percentage', 'double precision', 'MeetingEngagement.eye_contact_percentage should be type double precision');

-- Field: speaking_time_seconds
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:MeetingEngagement.speaking_time_seconds -> no evidence map
SELECT has_column('MeetingEngagement', 'speaking_time_seconds', 'Column MeetingEngagement.speaking_time_seconds should exist');
SELECT col_type_is('MeetingEngagement', 'speaking_time_seconds', 'integer', 'MeetingEngagement.speaking_time_seconds should be type integer');

-- Field: distraction_count
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:MeetingEngagement.distraction_count -> no evidence map
SELECT has_column('MeetingEngagement', 'distraction_count', 'Column MeetingEngagement.distraction_count should exist');
SELECT col_type_is('MeetingEngagement', 'distraction_count', 'integer', 'MeetingEngagement.distraction_count should be type integer');
SELECT col_not_null('MeetingEngagement', 'distraction_count', 'MeetingEngagement.distraction_count should not be nullable');

-- Field: facial_expression_data
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:MeetingEngagement.facial_expression_data -> no evidence map
SELECT has_column('MeetingEngagement', 'facial_expression_data', 'Column MeetingEngagement.facial_expression_data should exist');
SELECT col_type_is('MeetingEngagement', 'facial_expression_data', 'text', 'MeetingEngagement.facial_expression_data should be type text');

-- Field: alert_triggered
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:MeetingEngagement.alert_triggered -> no evidence map
SELECT has_column('MeetingEngagement', 'alert_triggered', 'Column MeetingEngagement.alert_triggered should exist');
SELECT col_type_is('MeetingEngagement', 'alert_triggered', 'boolean', 'MeetingEngagement.alert_triggered should be type boolean');
SELECT col_not_null('MeetingEngagement', 'alert_triggered', 'MeetingEngagement.alert_triggered should not be nullable');

-- Field: timestamp
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:MeetingEngagement.timestamp -> no evidence map
SELECT has_column('MeetingEngagement', 'timestamp', 'Column MeetingEngagement.timestamp should exist');
SELECT col_type_is('MeetingEngagement', 'timestamp', 'timestamptz', 'MeetingEngagement.timestamp should be type timestamptz');
SELECT col_not_null('MeetingEngagement', 'timestamp', 'MeetingEngagement.timestamp should not be nullable');


-- ══════════════════════════════════════════════════════
-- CONSTRAINT TESTS
-- Testing PK, FK, unique, check constraints
-- ══════════════════════════════════════════════════════

-- Constraints for Organization
SELECT col_is_pk('Organization', 'id', 'Organization.id should be primary key');

-- Constraints for Department
SELECT col_is_pk('Department', 'id', 'Department.id should be primary key');
SELECT fk_ok(
  'Department', 'organization_id',
  'Organization', 'id',
  'Department.organization_id should reference Organization.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Organization" (id) VALUES ('test-parent-id');
  INSERT INTO "Department" ("organization_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for Employee
SELECT col_is_pk('Employee', 'id', 'Employee.id should be primary key');
SELECT col_is_unique('Employee', 'user_id', 'Employee.user_id should be unique');
SELECT col_is_unique('Employee', 'email', 'Employee.email should be unique');
-- Email uniqueness should be case-insensitive
DO $$
BEGIN
  INSERT INTO "Employee" ("email") VALUES ('Test@Example.com');
  PERFORM throws_ok(
    $SQL$ INSERT INTO "Employee" ("email") VALUES ('test@example.com') $SQL$,
    '23505',
    'Should enforce case-insensitive email uniqueness'
  );
  ROLLBACK;
END $$;

-- Constraints for OrganizationAdmin
SELECT col_is_pk('OrganizationAdmin', 'id', 'OrganizationAdmin.id should be primary key');
SELECT fk_ok(
  'OrganizationAdmin', 'user_id',
  'Employee', 'user_id',
  'OrganizationAdmin.user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "OrganizationAdmin" ("user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'OrganizationAdmin', 'org_id',
  'Organization', 'id',
  'OrganizationAdmin.org_id should reference Organization.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Organization" (id) VALUES ('test-parent-id');
  INSERT INTO "OrganizationAdmin" ("org_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'OrganizationAdmin', 'granted_by',
  'Employee', 'user_id',
  'OrganizationAdmin.granted_by should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "OrganizationAdmin" ("granted_by") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for DepartmentMember
SELECT col_is_pk('DepartmentMember', 'id', 'DepartmentMember.id should be primary key');
SELECT fk_ok(
  'DepartmentMember', 'user_id',
  'Employee', 'user_id',
  'DepartmentMember.user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentMember" ("user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'DepartmentMember', 'dept_id',
  'Department', 'id',
  'DepartmentMember.dept_id should reference Department.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Department" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentMember" ("dept_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'DepartmentMember', 'organization_id',
  'Organization', 'id',
  'DepartmentMember.organization_id should reference Organization.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Organization" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentMember" ("organization_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for DepartmentManager
SELECT col_is_pk('DepartmentManager', 'id', 'DepartmentManager.id should be primary key');
SELECT fk_ok(
  'DepartmentManager', 'user_id',
  'Employee', 'user_id',
  'DepartmentManager.user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentManager" ("user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'DepartmentManager', 'dept_id',
  'Department', 'id',
  'DepartmentManager.dept_id should reference Department.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Department" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentManager" ("dept_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'DepartmentManager', 'appointed_by',
  'Employee', 'user_id',
  'DepartmentManager.appointed_by should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "DepartmentManager" ("appointed_by") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for ActivityEvent
SELECT col_is_pk('ActivityEvent', 'id', 'ActivityEvent.id should be primary key');
SELECT fk_ok(
  'ActivityEvent', 'employee_user_id',
  'Employee', 'user_id',
  'ActivityEvent.employee_user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "ActivityEvent" ("employee_user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for CoachingPair
SELECT col_is_pk('CoachingPair', 'id', 'CoachingPair.id should be primary key');
SELECT fk_ok(
  'CoachingPair', 'coach_user_id',
  'Employee', 'user_id',
  'CoachingPair.coach_user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "CoachingPair" ("coach_user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;
SELECT fk_ok(
  'CoachingPair', 'coachee_user_id',
  'Employee', 'user_id',
  'CoachingPair.coachee_user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "CoachingPair" ("coachee_user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;

-- Constraints for MeetingEngagement
SELECT col_is_pk('MeetingEngagement', 'id', 'MeetingEngagement.id should be primary key');
SELECT fk_ok(
  'MeetingEngagement', 'employee_user_id',
  'Employee', 'user_id',
  'MeetingEngagement.employee_user_id should reference Employee.user_id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "Employee" (id) VALUES ('test-parent-id');
  INSERT INTO "MeetingEngagement" ("employee_user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;


-- ══════════════════════════════════════════════════════
-- DEFAULT VALUE TESTS
-- Testing default expressions
-- ══════════════════════════════════════════════════════

-- Test default for Organization.surveillance_level
SELECT col_has_default('Organization', 'surveillance_level', 'Organization.surveillance_level should have default');
SELECT col_default_is(
  'Organization', 'surveillance_level',
  '3',
  'Default should be 3'
);

-- Test default for Organization.created_at
SELECT col_has_default('Organization', 'created_at', 'Organization.created_at should have default');
SELECT col_default_is(
  'Organization', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for Department.manager_override_surveillance
SELECT col_has_default('Department', 'manager_override_surveillance', 'Department.manager_override_surveillance should have default');
SELECT col_default_is(
  'Department', 'manager_override_surveillance',
  'false',
  'Default should be false'
);

-- Test default for Department.created_at
SELECT col_has_default('Department', 'created_at', 'Department.created_at should have default');
SELECT col_default_is(
  'Department', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for Employee.surveillance_level
SELECT col_has_default('Employee', 'surveillance_level', 'Employee.surveillance_level should have default');
SELECT col_default_is(
  'Employee', 'surveillance_level',
  '2',
  'Default should be 2'
);

-- Test default for Employee.productivity_score
SELECT col_has_default('Employee', 'productivity_score', 'Employee.productivity_score should have default');
SELECT col_default_is(
  'Employee', 'productivity_score',
  '50.0',
  'Default should be 50.0'
);

-- Test default for Employee.current_bandwidth
SELECT col_has_default('Employee', 'current_bandwidth', 'Employee.current_bandwidth should have default');
SELECT col_default_is(
  'Employee', 'current_bandwidth',
  '0.0',
  'Default should be 0.0'
);

-- Test default for Employee.is_being_coached
SELECT col_has_default('Employee', 'is_being_coached', 'Employee.is_being_coached should have default');
SELECT col_default_is(
  'Employee', 'is_being_coached',
  'false',
  'Default should be false'
);

-- Test default for Employee.last_activity
SELECT col_has_default('Employee', 'last_activity', 'Employee.last_activity should have default');
SELECT col_default_is(
  'Employee', 'last_activity',
  'now()',
  'Default should be now()'
);

-- Test default for Employee.created_at
SELECT col_has_default('Employee', 'created_at', 'Employee.created_at should have default');
SELECT col_default_is(
  'Employee', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for OrganizationAdmin.granted_at
SELECT col_has_default('OrganizationAdmin', 'granted_at', 'OrganizationAdmin.granted_at should have default');
SELECT col_default_is(
  'OrganizationAdmin', 'granted_at',
  'now()',
  'Default should be now()'
);

-- Test default for DepartmentMember.role
SELECT col_has_default('DepartmentMember', 'role', 'DepartmentMember.role should have default');
SELECT col_default_is(
  'DepartmentMember', 'role',
  'member',
  'Default should be member'
);

-- Test default for DepartmentMember.joined_at
SELECT col_has_default('DepartmentMember', 'joined_at', 'DepartmentMember.joined_at should have default');
SELECT col_default_is(
  'DepartmentMember', 'joined_at',
  'now()',
  'Default should be now()'
);

-- Test default for DepartmentManager.appointed_at
SELECT col_has_default('DepartmentManager', 'appointed_at', 'DepartmentManager.appointed_at should have default');
SELECT col_default_is(
  'DepartmentManager', 'appointed_at',
  'now()',
  'Default should be now()'
);

-- Test default for ActivityEvent.surveillance_triggered
SELECT col_has_default('ActivityEvent', 'surveillance_triggered', 'ActivityEvent.surveillance_triggered should have default');
SELECT col_default_is(
  'ActivityEvent', 'surveillance_triggered',
  'false',
  'Default should be false'
);

-- Test default for ActivityEvent.created_at
SELECT col_has_default('ActivityEvent', 'created_at', 'ActivityEvent.created_at should have default');
SELECT col_default_is(
  'ActivityEvent', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for CoachingPair.sessions_completed
SELECT col_has_default('CoachingPair', 'sessions_completed', 'CoachingPair.sessions_completed should have default');
SELECT col_default_is(
  'CoachingPair', 'sessions_completed',
  '0',
  'Default should be 0'
);

-- Test default for CoachingPair.is_active
SELECT col_has_default('CoachingPair', 'is_active', 'CoachingPair.is_active should have default');
SELECT col_default_is(
  'CoachingPair', 'is_active',
  'true',
  'Default should be true'
);

-- Test default for CoachingPair.created_at
SELECT col_has_default('CoachingPair', 'created_at', 'CoachingPair.created_at should have default');
SELECT col_default_is(
  'CoachingPair', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for MeetingEngagement.distraction_count
SELECT col_has_default('MeetingEngagement', 'distraction_count', 'MeetingEngagement.distraction_count should have default');
SELECT col_default_is(
  'MeetingEngagement', 'distraction_count',
  '0',
  'Default should be 0'
);

-- Test default for MeetingEngagement.alert_triggered
SELECT col_has_default('MeetingEngagement', 'alert_triggered', 'MeetingEngagement.alert_triggered should have default');
SELECT col_default_is(
  'MeetingEngagement', 'alert_triggered',
  'false',
  'Default should be false'
);

-- Test default for MeetingEngagement.timestamp
SELECT col_has_default('MeetingEngagement', 'timestamp', 'MeetingEngagement.timestamp should have default');
SELECT col_default_is(
  'MeetingEngagement', 'timestamp',
  'now()',
  'Default should be now()'
);


-- ══════════════════════════════════════════════════════
-- INDEX TESTS
-- Testing index existence and usage
-- ══════════════════════════════════════════════════════

-- Index test for Employee.user_id
SELECT has_index('Employee', 'Employee_user_id_idx', 'Index Employee_user_id_idx should exist');
-- Verify index is used in query plans
SELECT like(
  (SELECT json_agg(plan) FROM (
    EXPLAIN (FORMAT JSON) SELECT * FROM "Employee" WHERE "user_id" = 'test'
  ) AS t(plan))::text,
  '%Index Scan%',
  'Query on user_id should use index'
);

-- Index test for Employee.email
SELECT has_index('Employee', 'Employee_email_idx', 'Index Employee_email_idx should exist');
-- Verify index is used in query plans
SELECT like(
  (SELECT json_agg(plan) FROM (
    EXPLAIN (FORMAT JSON) SELECT * FROM "Employee" WHERE "email" = 'test'
  ) AS t(plan))::text,
  '%Index Scan%',
  'Query on email should use index'
);


-- ══════════════════════════════════════════════════════
-- RLS TESTS (Supabase Row Level Security)
-- Testing access control policies
-- ══════════════════════════════════════════════════════

-- RLS tests for Organization
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "Organization" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "Organization" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy

-- Test UPDATE policy
SELECT lives_ok(
  $$ UPDATE "Organization" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow update for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ UPDATE "Organization" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block update for non-owner'
);

-- Test DELETE policy

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'Organization'),
  true,
  'RLS should be enabled on Organization'
);

-- RLS tests for Department
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "Department" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "Department" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "Department" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "Department" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy
SELECT lives_ok(
  $$ UPDATE "Department" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow update for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ UPDATE "Department" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block update for non-owner'
);

-- Test DELETE policy
SELECT lives_ok(
  $$ DELETE FROM "Department" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow delete for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ DELETE FROM "Department" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block delete for non-owner'
);

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'Department'),
  true,
  'RLS should be enabled on Department'
);

-- RLS tests for Employee
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "Employee" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "Employee" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "Employee" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "Employee" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy
SELECT lives_ok(
  $$ UPDATE "Employee" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow update for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ UPDATE "Employee" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block update for non-owner'
);

-- Test DELETE policy

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'Employee'),
  true,
  'RLS should be enabled on Employee'
);

-- RLS tests for OrganizationAdmin
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "OrganizationAdmin" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "OrganizationAdmin" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "OrganizationAdmin" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "OrganizationAdmin" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy

-- Test DELETE policy
SELECT lives_ok(
  $$ DELETE FROM "OrganizationAdmin" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow delete for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ DELETE FROM "OrganizationAdmin" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block delete for non-owner'
);

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'OrganizationAdmin'),
  true,
  'RLS should be enabled on OrganizationAdmin'
);

-- RLS tests for DepartmentMember
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "DepartmentMember" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "DepartmentMember" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "DepartmentMember" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "DepartmentMember" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy

-- Test DELETE policy
SELECT lives_ok(
  $$ DELETE FROM "DepartmentMember" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow delete for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ DELETE FROM "DepartmentMember" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block delete for non-owner'
);

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'DepartmentMember'),
  true,
  'RLS should be enabled on DepartmentMember'
);

-- RLS tests for DepartmentManager
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "DepartmentManager" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "DepartmentManager" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "DepartmentManager" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "DepartmentManager" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy

-- Test DELETE policy
SELECT lives_ok(
  $$ DELETE FROM "DepartmentManager" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow delete for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ DELETE FROM "DepartmentManager" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block delete for non-owner'
);

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'DepartmentManager'),
  true,
  'RLS should be enabled on DepartmentManager'
);

-- RLS tests for ActivityEvent
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "ActivityEvent" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "ActivityEvent" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "ActivityEvent" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "ActivityEvent" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy

-- Test DELETE policy

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'ActivityEvent'),
  true,
  'RLS should be enabled on ActivityEvent'
);

-- RLS tests for CoachingPair
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "CoachingPair" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "CoachingPair" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy
SELECT lives_ok(
  $$ INSERT INTO "CoachingPair" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS should allow insert for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO "CoachingPair" (id, user_id) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002'::uuid) $$,
  '42501',
  'RLS should block insert for non-owner'
);

-- Test UPDATE policy
SELECT lives_ok(
  $$ UPDATE "CoachingPair" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow update for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ UPDATE "CoachingPair" SET updated_at = now() WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block update for non-owner'
);

-- Test DELETE policy
SELECT lives_ok(
  $$ DELETE FROM "CoachingPair" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow delete for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ DELETE FROM "CoachingPair" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block delete for non-owner'
);

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'CoachingPair'),
  true,
  'RLS should be enabled on CoachingPair'
);

-- RLS tests for MeetingEngagement
-- Setting RLS context for testing

-- Test as resource owner
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test SELECT policy
SELECT lives_ok(
  $$ SELECT * FROM "MeetingEngagement" WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'RLS should allow select for owner'
);

-- Switch to different user
SELECT set_config('request.jwt.claims', 
  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT throws_ok(
  $$ SELECT * FROM "MeetingEngagement" WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'RLS should block select for non-owner'
);

-- Test INSERT policy

-- Test UPDATE policy

-- Test DELETE policy

-- Verify RLS is enabled on table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'MeetingEngagement'),
  true,
  'RLS should be enabled on MeetingEngagement'
);

-- ══════════════════════════════════════════════════════════════════
-- Cleanup
SELECT * FROM finish();
ROLLBACK;