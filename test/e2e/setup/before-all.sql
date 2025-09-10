-- Before all tests - setup test database state
-- This runs once before all E2E tests

-- Create a test schema for isolation
CREATE SCHEMA IF NOT EXISTS wesley_e2e_test;
SET search_path TO wesley_e2e_test;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test-specific roles if needed
-- (Supabase will already have authenticated, anon, etc.)