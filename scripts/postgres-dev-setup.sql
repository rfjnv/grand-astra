-- Один раз под суперпользователем PostgreSQL (часто postgres на Windows), из корня репозитория:
--   psql -h localhost -U postgres -d postgres -f scripts/postgres-dev-setup.sql
--
-- Если роль уже есть, но пароль другой:
--   ALTER ROLE grandastra WITH PASSWORD 'grandastra';
-- Если БД уже есть, строку CREATE DATABASE пропустите.

CREATE ROLE grandastra WITH LOGIN PASSWORD 'grandastra';
CREATE DATABASE grandastra OWNER grandastra;
