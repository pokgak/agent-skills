---
name: lgtm
description: Query observability backends (Loki logs, Prometheus/Mimir metrics, Tempo traces) to investigate production issues, debug errors, check service health, and analyze system behavior. Use this skill whenever the user asks about logs, metrics, traces, error rates, latency, or debugging anything in production — even if they don't say "lgtm" or "observability" explicitly.
allowed-tools: Bash, Read, Glob, Task
license: MIT
---

# LGTM Skill - Query Observability Backends

## Why subagents matter here

`lgtm` commands return raw JSON — sometimes thousands of lines. If you run queries directly in the main conversation, you'll flood the context window and make it harder to reason about what actually matters. Haiku subagents are the right tool: they run the queries, distill the results, and hand you back just the signal you need.

The pattern is: **you orchestrate, haiku executes**.

## Orchestrator Pattern

- **You (orchestrator)**: Coordinate the discovery → investigation flow. Evaluate summaries returned by subagents, decide what to query next, synthesize findings for the user. Don't run `lgtm` commands yourself.
- **Haiku subagent**: All query execution — discovery, investigation, aggregation, analysis. Fast and sufficient for the vast majority of tasks.

Run independent queries in parallel — spawn multiple Task calls in one message when queries don't depend on each other (e.g., check logs AND metrics AND traces simultaneously).

## Two-Phase Approach

### Phase 1: Discovery

Before querying blindly, discover what's available. This avoids wasted queries against wrong label names or nonexistent services.

```
Task tool call:
  subagent_type: "Bash"
  model: "haiku"
  prompt: "Using lgtm CLI, discover available labels and services.
    Run: lgtm loki labels
    Run: lgtm loki label-values app
    Run: lgtm loki label-values namespace
    Run: lgtm tempo tag-values service.name
    Return a concise list of available apps, namespaces, and trace services."
```

### Phase 2: Investigation

With concrete label values in hand, query precisely:

```
Task tool call:
  subagent_type: "Bash"
  model: "haiku"
  prompt: "Using lgtm CLI, investigate errors in the checkout app in prod namespace.
    <specific queries based on discovery results>
    Return ONLY a concise summary, not raw JSON."
```

---

## Setup: Config File Required

Before querying, check if the config file exists at `~/.config/lgtm/config.yaml`. If it doesn't, **stop and tell the user** to run `lgtm discover` (for Grafana Cloud) or create the config manually.

### Grafana Cloud Auto-Discovery

If the user is on Grafana Cloud, they can auto-generate the config:

```bash
# Requires a Grafana Cloud Access Policy token with stacks:read scope
# Create at: Grafana Cloud → Administration → Cloud Access Policies
GRAFANA_CLOUD_API_TOKEN=glc_xxx lgtm discover

# Preview without writing
lgtm discover --dry-run

# Discover for a specific org
lgtm discover --org myorg --token glc_xxx

# Overwrite existing entries
lgtm discover --overwrite
```

This generates config entries for all active stacks with Loki, Prometheus, and Tempo endpoints.

### Error Messages

v1.2.0+ shows clean, actionable errors instead of tracebacks:
- **Nonexistent instance** (`-i nonexistent`): lists available instances
- **Empty config**: suggests running `lgtm discover`
- **Unset env vars**: warns when `${VAR_NAME}` references are not set

---

## CLI Reference

`lgtm` is installed globally. Install with:
```bash
uv tool install lgtm-cli
```

Config file: `~/.config/lgtm/config.yaml`

### Loki (Logs)

```bash
# Discovery
lgtm loki labels
lgtm loki label-values app
lgtm loki label-values namespace

# Basic query (defaults: last 15 min, limit 50)
lgtm loki query '{app="myapp"}'

# Filter for errors
lgtm loki query '{app="myapp"} |= "error"'

# Custom time range and limit
lgtm loki query '{app="myapp"}' --start 2024-01-15T10:00:00Z --end 2024-01-15T11:00:00Z --limit 100

# Aggregations (prefer these over raw log fetches for initial overviews)
lgtm loki instant 'count_over_time({app="myapp"} |= "error" [5m])'
lgtm loki instant 'sum by (level) (count_over_time({app="myapp"} | json [5m]))'
```

### Prometheus/Mimir (Metrics)

```bash
# Discovery
lgtm prom labels
lgtm prom label-values __name__
lgtm prom metadata --metric http_requests_total

# Instant query
lgtm prom query 'up{job="prometheus"}'
lgtm prom query 'rate(http_requests_total[5m])'

# Range query (defaults: last 15 min, 60s step)
lgtm prom range 'rate(http_requests_total[5m])'
lgtm prom range 'up' --start 2024-01-15T10:00:00Z --end 2024-01-15T11:00:00Z --step 5m
```

### Tempo (Traces)

```bash
# Discovery
lgtm tempo tags
lgtm tempo tag-values service.name

# Search (defaults: last 15 min, limit 20)
lgtm tempo search -q '{resource.service.name="api"}'
lgtm tempo search -q '{status=error}'
lgtm tempo search --min-duration 1s
lgtm tempo search -q '{resource.service.name="api" && status=error}' --min-duration 500ms

# Get specific trace by ID
lgtm tempo trace abc123def456
```

### Instance Selection & Discovery

```bash
lgtm instances                              # list configured instances
lgtm -i production loki query '{app="api"}' # use specific instance
lgtm discover                               # auto-discover Grafana Cloud stacks
lgtm discover --dry-run                     # preview without writing config
```

### Kubernetes Port-Forward Instances

Some instances require kubectl port-forwarding to reach services inside a cluster.

```bash
lgtm port-forward          # show port-forward commands for all instances that need them
lgtm -i sandbox port-forward  # show for specific instance
```

Subagent prompt for port-forward instances:

```
Task tool call:
  subagent_type: "Bash"
  model: "haiku"
  prompt: "Query sandbox cluster metrics using lgtm CLI.

    1. Check the port-forward command needed:
       lgtm -i sandbox port-forward

    2. Start the tunnel in the background:
       kubectl port-forward -n monitoring svc/victoria-metrics-server 8428:8428 --context sandbox &
       sleep 2  # wait for tunnel to establish

    3. Run the query:
       lgtm -i sandbox prom query 'sandbox_running_count'

    4. Return a summary of the results."
```

### Output Formatting

All commands output JSON. Subagents should use `jq` to extract what's relevant rather than returning raw output:

```bash
# Extract just log lines
lgtm loki query '{app="api"}' | jq -r '.data.result[].values[][] | select(type == "string")'

# Extract metric values
lgtm prom query 'up' | jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'

# Trace summary
lgtm tempo search -q '{status=error}' | jq -r '.traces[] | "\(.traceID) | \(.rootServiceName) | \(.durationMs)ms"'
```

---

## Subagent Prompt Examples

**Discovery**

```
Discover available observability data using lgtm CLI.

1. lgtm loki labels
2. lgtm loki label-values app
3. lgtm loki label-values namespace
4. lgtm tempo tag-values service.name

Return a concise list:
- Available apps: [list]
- Available namespaces: [list]
- Available trace services: [list]
- Any other relevant labels
```

**Investigate Error Spike**

```
Investigate errors in the checkout service over the last hour using lgtm CLI.

1. Get error counts: lgtm loki instant 'sum by (level) (count_over_time({app="checkout"} | json [1h]))'
2. If errors found, sample logs: lgtm loki query '{app="checkout"} |= "error"' --limit 30
3. Check traces: lgtm tempo search -q '{resource.service.name="checkout" && status=error}'

Summarize:
- Total error count and trend
- Top 3 most frequent error messages
- When errors started
- Affected components/pods
- Any correlated trace IDs

Return only the summary, not raw JSON.
```

**Service Health Check**

```
Check health of the payment-service using lgtm CLI.

1. Error rate: lgtm loki instant 'sum(count_over_time({app="payment-service"} |= "error" [15m]))'
2. P95 latency: lgtm prom query 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="payment"}[5m]))'
3. Recent errors: lgtm loki query '{app="payment-service"} |= "error"' --limit 10

Return:
- Status: healthy/degraded/unhealthy
- Error rate (errors per minute)
- P95 latency
- Any critical issues
```

**Trace Investigation**

```
Investigate slow requests in the API gateway using lgtm CLI.

1. Find slow traces: lgtm tempo search -q '{resource.service.name="api-gateway"}' --min-duration 2s --limit 10
2. For the slowest trace: lgtm tempo trace <traceID>
3. Check downstream: lgtm tempo search -q '{resource.service.name="api-gateway"} >> {duration > 1s}'

Summarize:
- How many slow requests in the last 15 min
- Which downstream service is causing delays
- Common patterns in slow requests
```

---

## Best Practices

**Aggregations over raw data** — count before you fetch. Pulling all error logs is slow and wasteful; getting a count first tells you whether it's worth digging deeper.

**Use specific identifiers when you have them** — if the user gives you a trace ID, request ID, or pod name, filter on it directly rather than scanning broadly.

**Prefer aggregations for the initial overview:**
```bash
# Get the lay of the land first
lgtm loki instant 'sum by (app) (count_over_time({namespace="prod"} |= "error" [15m]))'

# Then drill into the specific app
lgtm loki query '{namespace="prod", app="checkout"} |= "error"' --limit 20
```

---

## Reference

For query syntax, see:
- `reference/logql.md` - LogQL syntax for Loki
- `reference/promql.md` - PromQL syntax for Prometheus
- `reference/traceql.md` - TraceQL syntax for Tempo
