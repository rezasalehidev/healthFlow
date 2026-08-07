-- HealthFlow PostgreSQL bootstrap
-- Creates one database with logical schemas per service (portfolio simplicity).
-- Production can split into separate databases / instances later.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS patient;
CREATE SCHEMA IF NOT EXISTS doctor;
CREATE SCHEMA IF NOT EXISTS appointment;

GRANT ALL ON SCHEMA auth TO CURRENT_USER;
GRANT ALL ON SCHEMA patient TO CURRENT_USER;
GRANT ALL ON SCHEMA doctor TO CURRENT_USER;
GRANT ALL ON SCHEMA appointment TO CURRENT_USER;
