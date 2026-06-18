# Query Insights — metric primer & query recipes

A reference for which metric answers which question, plus copy-paste Cloud Monitoring API and
`gcloud` recipes. All examples use placeholders — replace `MY_PROJECT` and `my-postgres-instance`.

The instance is always selected with `resource.labels.resource_id="MY_PROJECT:my-postgres-instance"`
(NOT `database_id` — that 400s).

## Pick the metric that matches the question

| Question | Group / metric | How to aggregate |
|---|---|---|
| What queries cost the most total CPU/time? | `perquery/execution_time` | `ALIGN_DELTA`, sum, rank desc |
| Where is the database load coming from right now? | `aggregate/execution_time` | `ALIGN_RATE` → "average active sessions" (DB load) |
| Which queries wait on locks? | `perquery/lock_time` | `ALIGN_DELTA`, rank desc |
| Which queries are IO-bound (disk, not cache)? | `perquery/io_time` | `ALIGN_DELTA`, rank desc |
| Which queries cause buffer-cache misses? | `perquery/shared_blk_access_count` (label `access_type=miss`) | `ALIGN_DELTA`, rank desc |
| Which queries scan/return the most rows? | `perquery/row_count` | `ALIGN_DELTA`, rank desc |
| What's the p95/p99 latency? | `perquery/latencies` (DISTRIBUTION) | `ALIGN_DELTA` + `crossSeriesReducer=REDUCE_PERCENTILE_99`/`_95`/`_50` |
| Which app route / endpoint drives DB load? | `pertag/execution_time` | `ALIGN_DELTA`, group by tag labels* |

\* `pertag/*` is only populated when the instance has `record_application_tags = true` and the app
sends [sqlcommenter](https://google.github.io/sqlcommenter/) tags (`route`, `action`, `framework`, …).

### Metric facts
- All `insights/*` metrics are `CUMULATIVE`. `*_time` are INT64 **microseconds**; `row_count` and
  `shared_blk_access_count` are INT64 counts; `latencies` is a `DISTRIBUTION`.
- Resource type: `cloudsql_instance_database`. Resource labels: `project_id`, `location`,
  `resource_id`, `database`.
- `perquery` metric labels: `user`, `querystring` (normalized, truncated to `query_string_length`),
  `query_hash`, `client_addr` (blank unless `record_client_address = true`).
- `io_time` adds label `io_type` (read/write); `lock_time` adds `lock_type` (lw/hw/buffer_pin);
  `shared_blk_access_count` adds `access_type` (hit/miss).

## Aligners & reducers cheat-sheet

- `perSeriesAligner`: `ALIGN_DELTA` (total over the window — best for ranking), `ALIGN_RATE`
  (per-second, for load/trend), `ALIGN_SUM`.
  - Note: `ALIGN_PERCENTILE_*` does **not** work on `latencies` — it's a CUMULATIVE DISTRIBUTION and
    the API rejects it. Use `ALIGN_DELTA` then reduce with `REDUCE_PERCENTILE_*` (see latency recipe).
- `crossSeriesReducer` + `groupByFields`: collapse many series into per-group totals server-side,
  e.g. `crossSeriesReducer=REDUCE_SUM` with `groupByFields=metric.label.query_hash` gives one clean
  total per query instead of many short-lived series you have to sum yourself. `REDUCE_PERCENTILE_99`
  /`_95`/`_50` computes latency percentiles from merged distribution buckets.

---

## Recipes via the bundled script

```bash
S=skills/cloudsql-query-insights/scripts/query_insights.py

# Biggest DB load contributors (default metric = execution_time)
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --top 10

# Lock contention over the last day
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --metric lock_time --hours 24

# IO-heavy queries over 6h
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --metric io_time --hours 6

# Row-count hogs
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --metric row_count

# Per-endpoint load (requires record_application_tags=true)
uv run "$S" --project MY_PROJECT --instance my-postgres-instance --pertag --metric execution_time
```

## Recipes via raw API (things the script doesn't do)

Common setup:

```bash
TOKEN=$(gcloud auth print-access-token)
PROJECT=MY_PROJECT
INST="MY_PROJECT:my-postgres-instance"
START=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)   # GNU: date -u -d '1 hour ago' +...
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
api() { curl -s -G "https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "interval.startTime=${START}" \
  --data-urlencode "interval.endTime=${END}" "$@"; }
```

### Database load (average active sessions) over time

This is the headline number on the Query Insights dashboard — the rate of `aggregate/execution_time`.

```bash
api --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/aggregate/execution_time\" AND resource.labels.resource_id=\"${INST}\"" \
    --data-urlencode "aggregation.alignmentPeriod=60s" \
    --data-urlencode "aggregation.perSeriesAligner=ALIGN_RATE"
# value ≈ average number of concurrently-executing queries in each minute
```

### p99 latency (instance-wide, across all queries)

`latencies` is a CUMULATIVE DISTRIBUTION, so `ALIGN_PERCENTILE_*` is rejected. Align with
`ALIGN_DELTA`, then let `REDUCE_PERCENTILE_99` compute the percentile from the merged buckets:

```bash
api --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/perquery/latencies\" AND resource.labels.resource_id=\"${INST}\"" \
    --data-urlencode "aggregation.alignmentPeriod=300s" \
    --data-urlencode "aggregation.perSeriesAligner=ALIGN_DELTA" \
    --data-urlencode "aggregation.crossSeriesReducer=REDUCE_PERCENTILE_99"
# swap REDUCE_PERCENTILE_99 for _95 or _50; values are in microseconds
```

For **per-query** latency, drop the reducer and add `view=FULL`: each series returns a
`distributionValue` (with `mean` and bucket counts) per `querystring` — read `mean` directly or
compute a percentile from `bucketOptions`/`bucketCounts` client-side.

### Clean per-query totals (server-side grouping, no client summing)

```bash
api --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/perquery/execution_time\" AND resource.labels.resource_id=\"${INST}\"" \
    --data-urlencode "aggregation.alignmentPeriod=3600s" \
    --data-urlencode "aggregation.perSeriesAligner=ALIGN_DELTA" \
    --data-urlencode "aggregation.crossSeriesReducer=REDUCE_SUM" \
    --data-urlencode "aggregation.groupByFields=metric.label.query_hash" \
    --data-urlencode "aggregation.groupByFields=metric.label.querystring"
```

### Buffer-cache misses only (disk reads)

```bash
api --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/perquery/shared_blk_access_count\" AND resource.labels.resource_id=\"${INST}\" AND metric.labels.access_type=\"miss\"" \
    --data-urlencode "aggregation.alignmentPeriod=3600s" \
    --data-urlencode "aggregation.perSeriesAligner=ALIGN_DELTA"
```

### Lock waits broken down by lock type

```bash
api --data-urlencode "filter=metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/perquery/lock_time\" AND resource.labels.resource_id=\"${INST}\"" \
    --data-urlencode "aggregation.alignmentPeriod=3600s" \
    --data-urlencode "aggregation.perSeriesAligner=ALIGN_DELTA" \
    --data-urlencode "aggregation.crossSeriesReducer=REDUCE_SUM" \
    --data-urlencode "aggregation.groupByFields=metric.label.lock_type"
# lock_type: lw (lightweight), hw (heavyweight), buffer_pin
```

## Recipe via `gcloud` (no curl)

```bash
gcloud monitoring time-series list \
  --project=MY_PROJECT \
  --filter='metric.type="cloudsql.googleapis.com/database/postgresql/insights/perquery/execution_time" AND resource.labels.resource_id="MY_PROJECT:my-postgres-instance"' \
  --format=json
```

## Promote to dashboards / alerts

All `insights/*` series are scrapeable through GCP Managed Prometheus; in PromQL the metric name
becomes e.g. `cloudsql_googleapis_com:database_postgresql_insights_perquery_execution_time`. Pair
with a Grafana/Mimir setup to chart per-query load or alert on lock_time spikes.
