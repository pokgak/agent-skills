---
name: lgtm
description: Query observability backends (Loki logs, Prometheus metrics, Tempo traces). Use when user asks about logs, metrics, traces, or debugging production issues.
allowed-tools: Bash, Read, Glob
license: MIT
---

# LGTM Skill - Query Observability Backends

Query Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces) using curl.

## Configuration

**Config file location:** `~/.config/lgtm/config.yaml`

Read the config file first to get instance URLs and authentication:

```bash
cat ~/.config/lgtm/config.yaml
```

### Config Format

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

### Environment Variable Expansion

Config values like `${VAR_NAME}` should be expanded. When constructing curl commands, use the actual environment variable:

```bash
# If config has token: "${LOKI_TOKEN}"
curl -H "Authorization: Bearer $LOKI_TOKEN" ...
```

## Authentication

Construct auth headers based on config:

| Config Fields | Auth Type | curl Flag |
|---------------|-----------|-----------|
| `token` only | Bearer | `-H "Authorization: Bearer $TOKEN"` |
| `username` + `token` | Basic | `-u "$USERNAME:$TOKEN"` |
| `headers` | Custom | `-H "Header-Name: value"` for each |

## Instance Selection

1. User specifies instance → use that instance
2. No specification → use `default_instance` from config
3. No default → use first instance

## Best Practices (Minimize Token Usage)

Observability queries can return massive amounts of data. Follow these practices to keep context size manageable:

### 1. Discover Before Querying

**Always start with metadata discovery** to understand what's available:

```bash
# Loki: What labels exist?
curl "$LOKI_URL/loki/api/v1/labels" | jq '.data[]'

# Loki: What values for a label?
curl "$LOKI_URL/loki/api/v1/label/app/values" | jq '.data[]'

# Prometheus: What metrics exist?
curl "$PROM_URL/api/v1/label/__name__/values" | jq '.data[]'

# Tempo: What services/tags exist?
curl "$TEMPO_URL/api/search/tags" | jq '.tagNames[]'
curl "$TEMPO_URL/api/search/tag/service.name/values" | jq '.tagValues[]'
```

### 2. Use Narrow Time Ranges

**Start with the smallest reasonable time window:**

| Scenario | Recommended Range |
|----------|-------------------|
| Recent issue | Last 15-30 minutes |
| Known incident time | ±15 minutes around incident |
| General exploration | Last 1 hour max |
| Historical analysis | Only expand if needed |

```bash
# BAD: Querying 24 hours of logs
--data-urlencode "start=$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)"

# GOOD: Start with 15 minutes
--data-urlencode "start=$(date -u -v-15M +%Y-%m-%dT%H:%M:%SZ)"
```

### 3. Filter Aggressively

**Add as many filters as possible to reduce result size:**

```logql
# BAD: Broad query
{namespace="production"}

# GOOD: Specific filters
{namespace="production", app="api", pod=~"api-server-.*"} |= "error" | json | level="error"
```

```promql
# BAD: All series
http_requests_total

# GOOD: Filtered
http_requests_total{job="api", status=~"5.."}
```

```traceql
# BAD: All traces
{ }

# GOOD: Specific service and condition
{ resource.service.name = "checkout" && status = error && duration > 1s }
```

### 4. Use Known Identifiers

**When investigating specific issues, filter by ID immediately:**

```bash
# If you have a trace ID, fetch it directly
curl "$TEMPO_URL/api/traces/abc123def456"

# If you have a request ID, filter logs by it
{app="api"} |= "request_id=abc123"

# If you have a pod name
{pod="api-server-xyz123"}
```

### 5. Limit Results

**Always set reasonable limits:**

```bash
# Loki: limit parameter
--data-urlencode "limit=50"    # Default can be 1000+

# Tempo: limit parameter
--data-urlencode "limit=20"

# Prometheus: use topk/bottomk
topk(10, sum by (pod) (rate(http_requests_total[5m])))
```

### 6. Use Aggregations Over Raw Data

**Prefer aggregated metrics over raw logs/traces:**

```bash
# BAD: Fetching all error logs
{app="api"} |= "error"

# GOOD: Count errors first, then drill down if needed
count_over_time({app="api"} |= "error" [5m])
sum by (level) (count_over_time({app="api"} | json [5m]))
```

### 7. Progressive Refinement

**Query in stages, narrowing down each time:**

1. **Get overview**: Use aggregations to identify problem areas
2. **Narrow scope**: Filter to specific service/pod/time
3. **Get details**: Fetch specific logs/traces only when needed

Example workflow:
```bash
# Step 1: Which services have errors?
sum by (app) (count_over_time({namespace="prod"} |= "error" [15m]))

# Step 2: Found "checkout" has errors, narrow down
{namespace="prod", app="checkout"} |= "error" | json | line_format "{{.message}}"

# Step 3: Get specific trace for investigation
curl "$TEMPO_URL/api/traces/<traceID>"
```

### 8. Extract Only What You Need

**Use jq to filter response data:**

```bash
# Extract only log lines, not metadata
jq -r '.data.result[].values[][] | select(type == "string")'

# Extract only trace IDs and durations
jq '.traces[] | {traceID, durationMs}'

# Get just metric names
jq -r '.data.result[].metric.__name__' | sort -u
```

## Loki API (Logs)

Base URL from config: `instances.<name>.loki.url`

### Query Logs (Range Query)

```bash
curl -G "$LOKI_URL/loki/api/v1/query_range" \
  --data-urlencode 'query={app="myapp"} |= "error"' \
  --data-urlencode "start=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "end=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "limit=100" \
  | jq '.data.result[].values[] | .[1]'
```

### Instant Query

```bash
curl -G "$LOKI_URL/loki/api/v1/query" \
  --data-urlencode 'query=count_over_time({app="myapp"}[5m])' \
  | jq '.data.result'
```

### Get Labels

```bash
curl "$LOKI_URL/loki/api/v1/labels" | jq '.data[]'
```

### Get Label Values

```bash
curl "$LOKI_URL/loki/api/v1/label/app/values" | jq '.data[]'
```

### Get Series

```bash
curl -G "$LOKI_URL/loki/api/v1/series" \
  --data-urlencode 'match[]={app="myapp"}' \
  | jq '.data[]'
```

## Prometheus/Mimir API (Metrics)

Base URL from config: `instances.<name>.prometheus.url`

### Instant Query

```bash
curl -G "$PROM_URL/api/v1/query" \
  --data-urlencode 'query=up{job="prometheus"}' \
  | jq '.data.result[] | {metric: .metric, value: .value[1]}'
```

### Range Query

```bash
curl -G "$PROM_URL/api/v1/query_range" \
  --data-urlencode 'query=rate(http_requests_total[5m])' \
  --data-urlencode "start=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "end=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "step=60" \
  | jq '.data.result'
```

### Get Labels

```bash
curl "$PROM_URL/api/v1/labels" | jq '.data[]'
```

### Get Label Values

```bash
curl "$PROM_URL/api/v1/label/job/values" | jq '.data[]'
```

### Get Metric Metadata

```bash
curl "$PROM_URL/api/v1/metadata" | jq 'keys[]'
```

### Get Series

```bash
curl -G "$PROM_URL/api/v1/series" \
  --data-urlencode 'match[]=up' \
  | jq '.data[]'
```

## Tempo API (Traces)

Base URL from config: `instances.<name>.tempo.url`

### Get Trace by ID

```bash
curl "$TEMPO_URL/api/traces/<traceID>" | jq '.'
```

### Search Traces

```bash
curl -G "$TEMPO_URL/api/search" \
  --data-urlencode 'q={resource.service.name="myservice"}' \
  --data-urlencode "start=$(date -u -v-1H +%s)" \
  --data-urlencode "end=$(date -u +%s)" \
  | jq '.traces[] | {traceID, rootServiceName, startTimeUnixNano, durationMs}'
```

### Search with Duration Filter

```bash
curl -G "$TEMPO_URL/api/search" \
  --data-urlencode 'q={duration > 100ms}' \
  --data-urlencode 'minDuration=100ms' \
  | jq '.traces[]'
```

### Get Tags

```bash
curl "$TEMPO_URL/api/search/tags" | jq '.tagNames[]'
```

### Get Tag Values

```bash
curl "$TEMPO_URL/api/search/tag/service.name/values" | jq '.tagValues[]'
```

## Time Formats

| Backend | Format | Example |
|---------|--------|---------|
| Loki | RFC3339 or Unix nano | `2024-01-15T10:00:00Z` |
| Prometheus | RFC3339 or Unix seconds | `2024-01-15T10:00:00Z` |
| Tempo | Unix seconds | `1705312800` |

### Time Helpers (macOS)

```bash
# Current time RFC3339
date -u +%Y-%m-%dT%H:%M:%SZ

# 1 hour ago RFC3339
date -u -v-1H +%Y-%m-%dT%H:%M:%SZ

# 24 hours ago RFC3339
date -u -v-24H +%Y-%m-%dT%H:%M:%SZ

# Unix seconds
date -u +%s

# 1 hour ago Unix seconds
date -u -v-1H +%s
```

### Time Helpers (Linux)

```bash
# Current time RFC3339
date -u +%Y-%m-%dT%H:%M:%SZ

# 1 hour ago RFC3339
date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ

# Unix seconds
date -u +%s

# 1 hour ago Unix seconds
date -u -d '1 hour ago' +%s
```

## Output Formatting

### Pretty Print Logs

```bash
# Extract just log lines from Loki
jq -r '.data.result[].values[][] | select(type == "string")'

# With timestamps
jq -r '.data.result[].values[] | "\(.[0] | tonumber / 1000000000 | strftime("%Y-%m-%d %H:%M:%S")) \(.[1])"'
```

### Format Metrics

```bash
# Simple value extraction
jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'

# Table format
jq -r '.data.result[] | [.metric.job, .metric.instance, .value[1]] | @tsv'
```

### Format Traces

```bash
# Summary of traces
jq -r '.traces[] | "\(.traceID) | \(.rootServiceName) | \(.durationMs)ms"'
```

## Error Handling

Always check response status:

```bash
response=$(curl -s -w "\n%{http_code}" "$URL")
body=$(echo "$response" | head -n -1)
status=$(echo "$response" | tail -n 1)

if [ "$status" != "200" ]; then
  echo "Error: HTTP $status"
  echo "$body" | jq '.message // .error // .'
fi
```

Common errors:
- 401: Authentication failed - check token/credentials
- 400: Bad query syntax - check LogQL/PromQL/TraceQL
- 404: Endpoint not found - check URL configuration
- 500: Server error - check backend logs

## Reference

For query syntax reference, see:
- `reference/logql.md` - LogQL syntax for Loki
- `reference/promql.md` - PromQL syntax for Prometheus
- `reference/traceql.md` - TraceQL syntax for Tempo
