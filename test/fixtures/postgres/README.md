# Postgres Init Scripts

SQL executed by CI postgres services and local docker-compose runs.

- `00-extensions.sql` – Installs required extensions (pgcrypto, uuid-ossp, etc.). Mounted in `.github/workflows/ci.yml` and `docker-compose.yml`.

Do not add data seeding here—keep it focused on deterministic extension setup.
