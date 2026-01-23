---
name: lgtm
description: Query observability backends (Loki logs, Prometheus metrics, Tempo traces). Use when user asks about logs, metrics, traces, or debugging production issues.
allowed-tools: Bash, Read, Glob
license: MIT
---

# LGTM Skill - Query Observability Backends

Query Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces) using the `lgtm` CLI.

## Prerequisites

Install the CLI (requires Python 3.12+):

```bash
uv tool install git+https://github.com/pokgak/skills-lgtm
```

Or run directly without installing:

```bash
uvx --from git+https://github.com/pokgak/skills-lgtm lgtm --help
```

## Configuration

**Config file location:** `~/.config/lgtm/config.yaml`

```yaml
version: "1"
default_instance: "local"

instances:
  local:
    loki:
      url: "http://localhost:3100"
    prometheus:
      url: "http://localhost:9090"
    tempo:
      url: "http://localhost:3200"
```

Authentication is handled automatically based on config:
- `token` only → Bearer auth
- `username` + `token` → Basic auth
- `headers` → Custom headers (e.g., `X-Scope-OrgID` for multi-tenant)

Environment variables like `${LOKI_TOKEN}` are expanded automatically.

## Built-in Best Practices

The CLI has sensible defaults to minimize token usage:
- **Default time range:** 15 minutes (not hours/days)
- **Default limits:** 50 for logs, 20 for traces
- **Always use discovery commands first** to understand available labels/metrics/tags

## Loki (Logs)

### Discovery First

```bash
# What labels exist?
lgtm loki labels

# What values for a label?
lgtm loki label-values app
lgtm loki label-values namespace
```

### Query Logs

```bash
# Basic query (defaults: last 15 min, limit 50)
lgtm loki query '{app="myapp"}'

# Filter for errors
lgtm loki query '{app="myapp"} |= "error"'

# With custom time range and limit
lgtm loki query '{app="myapp"}' --start 2024-01-15T10:00:00Z --end 2024-01-15T11:00:00Z --limit 100
```

### Metric Queries (Aggregations)

```bash
# Count errors - use this to get overview first
lgtm loki instant 'count_over_time({app="myapp"} |= "error" [5m])'

# Errors by level
lgtm loki instant 'sum by (level) (count_over_time({app="myapp"} | json [5m]))'
```

## Prometheus/Mimir (Metrics)

### Discovery First

```bash
# What labels exist?
lgtm prom labels

# What metrics exist?
lgtm prom label-values __name__

# Metric metadata
lgtm prom metadata --metric http_requests_total
```

### Query Metrics

```bash
# Instant query
lgtm prom query 'up{job="prometheus"}'

# Rate of requests
lgtm prom query 'rate(http_requests_total[5m])'

# Range query (defaults: last 15 min, 60s step)
lgtm prom range 'rate(http_requests_total[5m])'

# Custom time range
lgtm prom range 'up' --start 2024-01-15T10:00:00Z --end 2024-01-15T11:00:00Z --step 5m
```

## Tempo (Traces)

### Discovery First

```bash
# What tags exist?
lgtm tempo tags

# What services?
lgtm tempo tag-values service.name
```

### Search Traces

```bash
# Search by service (defaults: last 15 min, limit 20)
lgtm tempo search -q '{resource.service.name="api"}'

# Error traces
lgtm tempo search -q '{status=error}'

# Slow traces
lgtm tempo search --min-duration 1s

# Combined filters
lgtm tempo search -q '{resource.service.name="api" && status=error}' --min-duration 500ms
```

### Get Specific Trace

```bash
# When you have a trace ID
lgtm tempo trace abc123def456
```

## Instance Selection

```bash
# Use specific instance
lgtm -i production loki query '{app="api"}'

# List configured instances
lgtm instances
```

## Best Practices Workflow

### 1. Discover → Filter → Query

```bash
# Step 1: What's available?
lgtm loki labels
lgtm loki label-values app

# Step 2: Get overview with aggregation
lgtm loki instant 'sum by (app) (count_over_time({namespace="prod"} |= "error" [15m]))'

# Step 3: Narrow down to specific app
lgtm loki query '{namespace="prod", app="checkout"} |= "error"' --limit 20
```

### 2. Use Specific Identifiers

```bash
# If you have a trace ID, fetch directly
lgtm tempo trace abc123def456

# Filter logs by request ID
lgtm loki query '{app="api"} |= "request_id=abc123"'

# Filter by pod name
lgtm loki query '{pod="api-server-xyz123"}'
```

### 3. Aggregations Over Raw Data

```bash
# BAD: Fetching all error logs
lgtm loki query '{app="api"} |= "error"'

# GOOD: Count first, then drill down
lgtm loki instant 'count_over_time({app="api"} |= "error" [5m])'
```

### 4. Use Subagents for Large Investigations

For complex queries that may return large results, spawn a subagent to fetch and summarize data. This keeps the main conversation context clean.

**When to use subagents:**
- Investigating incidents across multiple services
- Queries that may return many results
- Correlating logs, metrics, and traces together
- When you need analysis, not raw data

**Example: Investigate Error Spike**

Spawn an Explore agent with this prompt:
```
Investigate errors in the checkout service over the last hour using the lgtm CLI.

1. First get error counts: lgtm loki instant 'sum by (level) (count_over_time({app="checkout"} | json [1h]))'
2. If errors found, get sample logs: lgtm loki query '{app="checkout"} |= "error"' --limit 30
3. Check for related traces: lgtm tempo search -q '{resource.service.name="checkout" && status=error}'

Summarize findings:
- Total error count and trend (up/down from normal)
- Top 3 most frequent error messages
- When the errors started
- Affected components/pods
- Any correlated trace IDs for debugging

Return ONLY the summary, not raw JSON output.
```

**Example: Service Health Check**

Spawn an Explore agent with this prompt:
```
Check health of the payment-service using lgtm CLI.

1. Error rate: lgtm loki instant 'sum(count_over_time({app="payment-service"} |= "error" [15m]))'
2. Request latency: lgtm prom query 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="payment"}[5m]))'
3. Recent errors: lgtm loki query '{app="payment-service"} |= "error"' --limit 10

Return a brief health summary:
- Status: healthy/degraded/unhealthy
- Error rate (errors per minute)
- P95 latency
- Any critical issues found
```

**Example: Trace Investigation**

Spawn an Explore agent with this prompt:
```
Investigate slow requests in the API gateway using lgtm CLI.

1. Find slow traces: lgtm tempo search -q '{resource.service.name="api-gateway"}' --min-duration 2s --limit 10
2. For the slowest trace, get details: lgtm tempo trace <traceID>
3. Check if downstream services are slow: lgtm tempo search -q '{resource.service.name="api-gateway"} >> {duration > 1s}'

Summarize:
- How many slow requests in the last 15 min
- Which downstream service is causing delays
- Common patterns in slow requests
```

The subagent processes raw data and returns only actionable insights, dramatically reducing context usage.

## Output Formatting

All commands output JSON. Use `jq` for formatting:

```bash
# Extract just log lines
lgtm loki query '{app="api"}' | jq -r '.data.result[].values[][] | select(type == "string")'

# Extract metric values
lgtm prom query 'up' | jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'

# Trace summary
lgtm tempo search -q '{status=error}' | jq -r '.traces[] | "\(.traceID) | \(.rootServiceName) | \(.durationMs)ms"'
```

## Reference

For query syntax, see:
- `reference/logql.md` - LogQL syntax for Loki
- `reference/promql.md` - PromQL syntax for Prometheus
- `reference/traceql.md` - TraceQL syntax for Tempo
