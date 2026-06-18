# cloudsql-query-insights

Read Cloud SQL for PostgreSQL **Query Insights** data programmatically via the Cloud Monitoring
API — the same per-query load/latency data shown in the GCP console, without a database connection
and without any new infrastructure.

## Installation

```bash
npx skills add pokgak/agent-skills
```

## Requirements

- `gcloud` authenticated with `roles/monitoring.viewer` (or broader) on the target project.
- Query Insights enabled on the instance (`insights_config { query_insights_enabled = true }`).
- Python 3.9+ (the helper script is pure standard library — no dependencies).

## Features

- Discover which Cloud SQL instances emit Query Insights data (`--list-instances`).
- Rank top queries by execution time, IO time, lock time, row count, etc.
- Per-query (`perquery`) or per-application-tag (`pertag`) breakdowns.
- Handles the undocumented `resource_id` filter gotcha (docs say `database_id`, which 400s).
- Agent- and runtime-agnostic: just `gcloud` + Python stdlib + the Monitoring REST API.

## Usage

```bash
S=skills/cloudsql-query-insights/scripts/query_insights.py
uv run "$S" --project <project> --list-instances
uv run "$S" --project <project> --instance <instance-name> --top 10
uv run "$S" --instance <instance-name> --metric lock_time --hours 24
```

## Not covered

The individual sampled **trace waterfall** view (per-query wait events) is console-only — no public
API. For ad-hoc query stats over a live connection use `pg_stat_statements`; for per-statement
timing use `log_min_duration_statement` → Cloud Logging. See `SKILL.md` for details.
