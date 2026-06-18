---
name: cloudsql-query-insights
description: >
  Query Cloud SQL for PostgreSQL "Query Insights" data programmatically via the Cloud
  Monitoring API — the same per-query load/latency data shown in the GCP console, without
  a DB connection. Use this skill whenever the user wants to find expensive/slow queries,
  query load, top queries by execution time / IO / locks, or per-query latency for a Cloud
  SQL Postgres instance — even if they don't say "Query Insights" explicitly. Also use when
  they ask how to access Cloud SQL query stats outside the console or programmatically.
license: MIT
---

# Cloud SQL Query Insights — programmatic access

## What this is

GCP Cloud SQL "Query Insights" (the per-query load/latency dashboard in the console) publishes
its data to **Cloud Monitoring** under `cloudsql.googleapis.com/database/postgresql/insights/*`.
You can read it programmatically with the Monitoring v3 `timeSeries` API — **no database
connection, no new infra**. This gives aggregated, per-normalized-query stats.

What you do **not** get this way: the individual sampled *trace waterfall* view (with end-to-end
wait events) — that view is console-only. For that, or for ad-hoc query stats over a DB
connection, use `pg_stat_statements` instead.

## Prerequisites

- `gcloud` authenticated as an identity with `roles/monitoring.viewer` (or broader) on the project.
  The script uses `gcloud auth print-access-token`.
- Query Insights must be enabled on the instance (`insights_config { query_insights_enabled = true }`
  in Terraform, or via console). If `--list-instances` shows nothing, it isn't enabled anywhere.

## The one gotcha that wastes everyone's time

The instance is selected by the resource label **`resource_id`** with value `"<project>:<instance>"`
— **NOT** `database_id` as the public metrics docs imply. Filtering on `database_id` returns:

```
HTTP 400: The supplied filter does not specify a valid combination of metric and
monitored resource descriptors.
```

The bundled script handles this for you. If you ever hand-write a filter, use:

```
metric.type="cloudsql.googleapis.com/database/postgresql/insights/perquery/execution_time"
AND resource.labels.resource_id="<project>:<instance>"
```

## Quick start (use the script)

`scripts/query_insights.py` is pure Python standard library — no dependencies, no virtualenv.
`S` below points at the script relative to this skill's directory.

```bash
S="$(dirname "$0")/scripts/query_insights.py"   # or the absolute path to scripts/query_insights.py

# 1. Discover which instances emit insights data + the exact resource_id to use
uv run "$S" --project MY_PROJECT --list-instances

# 2. Top 10 queries by total execution time on an instance, last 1h
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --top 10

# 3. Other metrics / longer window
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --metric io_time --hours 6
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --metric lock_time --hours 24

# 4. Per-tag breakdown (needs record_application_tags=true on the instance)
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --pertag --metric execution_time
```

`--project` falls back to the active gcloud project (`gcloud config get-value project`) if omitted.
The script prefixes `--instance` with the project automatically; you can also pass a full
`project:instance` string.

## Available metrics

Three groups exist, each with the same six metrics:

- `insights/perquery/*` — broken down per normalized query (`querystring`, `query_hash`)
- `insights/pertag/*` — broken down per application tag (`action`, `route`, `framework`, …); only
  populated when `record_application_tags = true`
- `insights/aggregate/*` — instance-wide totals

Metrics (all `CUMULATIVE`; `*_time` are INT64 **microseconds**, `latencies` is a DISTRIBUTION):

| metric | meaning |
|---|---|
| `execution_time` | total query execution time (μs) — best "what's expensive" ranking |
| `io_time` | time in IO (μs) |
| `lock_time` | time waiting on locks (μs) |
| `latencies` | latency distribution |
| `row_count` | rows returned/affected |
| `shared_blk_access_count` | shared buffer accesses (hit/miss) |

Metric labels: `user`, `querystring`, `query_hash`, `client_addr` (empty unless
`record_client_address = true`). Resource: type `cloudsql_instance_database`, labels
`project_id`, `region`/`location`, `resource_id`, `database`.

For a metric-selection primer (which metric answers which question), p95/p99 latency,
server-side grouping, lock-type/cache-miss breakdowns, and `gcloud`/PromQL variants, see
[`reference/recipes.md`](reference/recipes.md).

## Raw API (no script)

```bash
TOKEN=$(gcloud auth print-access-token)
PROJECT=my-project
INST="my-project:my-postgres-instance"
curl -s -G "https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/perquery/execution_time\" AND resource.labels.resource_id=\"${INST}\"" \
  --data-urlencode "interval.startTime=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "interval.endTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "aggregation.alignmentPeriod=3600s" \
  --data-urlencode "aggregation.perSeriesAligner=ALIGN_DELTA" \
  --data-urlencode "view=FULL"
```

(`date -u -v-1H` is macOS/BSD; on GNU/Linux use `date -u -d '1 hour ago'`.)

## When to reach for something else

- **Individual query traces / wait-event waterfall** → GCP console Query Insights (no public API).
- **Ad-hoc query stats over a live connection, fully portable** → enable `pg_stat_statements`
  (`CREATE EXTENSION pg_stat_statements;` — Cloud SQL preloads the library) and query the view.
- **Per-statement timing logs** → set `log_min_duration_statement` (use a threshold, not `0`, on
  busy prod instances) and read Cloud Logging.
- **Dashboards/alerting** → these metrics scrape cleanly into Prometheus/Mimir via GCP Managed
  Prometheus (pairs well with the `lgtm` skill).
