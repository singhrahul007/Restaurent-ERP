# Local data services for Niva

PostgreSQL is the only database (no SQLite or MySQL). Redis is for jobs and Socket.IO. MinIO is S3-compatible object storage.

## Start

From the repository root:

```bash
docker compose -f docker/compose.yml up -d
docker compose -f docker/compose.yml ps
```

Wait until `postgres`, `redis`, and `minio` are healthy.

## Defaults (local only)

| Service | URL | Credentials |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | user/password/db: `niva` / `niva` / `niva` |
| Redis | `localhost:6379` | none |
| MinIO S3 | `http://localhost:9000` | `niva` / `nivalocalpass` |
| MinIO console | `http://localhost:9001` | same |

Copy `.env.example` to `.env` at the repo root before running the API, worker, or migrations.

## Stop

```bash
docker compose -f docker/compose.yml down
```

Volumes persist until you pass `-v`.
