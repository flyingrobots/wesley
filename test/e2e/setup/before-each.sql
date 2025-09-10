-- Before each test - ensure clean state
-- This runs before each individual test

SET search_path TO wesley_e2e_test;

-- Clean up any tables from previous test runs
DROP SCHEMA IF EXISTS wesley_e2e_test CASCADE;
CREATE SCHEMA wesley_e2e_test;
SET search_path TO wesley_e2e_test;