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

## Charts

When the user asks for metrics with visual charts (or you determine a chart would be more useful than raw numbers), use `lgtm chart` to render terminal charts. This is built into `lgtm-cli` (v1.4.0+).

### Chart Types

**timeseries** (default) — Line chart for trends over time
```bash
lgtm prom range 'rate(http_requests_total[5m])' > /tmp/data.json
lgtm chart /tmp/data.json -t "Request Rate"
```

**bar** — Horizontal bars for comparing current values across series
```bash
lgtm prom range 'topk(10, sum by (job)(rate(http_requests_total[5m])))' > /tmp/data.json
lgtm chart /tmp/data.json --type bar -t "Top 10 Jobs"
```

**heatmap** — Intensity grid for histogram bucket distributions over time
```bash
lgtm prom range 'rate(http_request_duration_seconds_bucket[5m])' > /tmp/data.json
lgtm chart /tmp/data.json --type heatmap -t "Latency Distribution"
```

### Chart Rendering Pattern

Charts are for human consumption — always render them directly with the Bash tool so the output goes to the user's terminal, never inside a subagent.

Use subagents to run the queries and save results to a file, then render the chart yourself:

```
Step 1 — Subagent fetches data:
Task tool call:
  subagent_type: "Bash"
  model: "haiku"
  prompt: "Run this range query and save the result:
    lgtm prom range 'rate(http_requests_total[5m])' --step 1m > /tmp/lgtm-chart-data.json
    Report the file size and number of series in the result."

Step 2 — You render the chart directly (Bash tool, not subagent):
  lgtm chart /tmp/lgtm-chart-data.json -t 'HTTP Request Rate' --type timeseries
```

### CLI Options

```
Options:
  --type         Chart type: timeseries, bar, heatmap (default: timeseries)
  --title, -t    Chart title
  --width, -w    Chart width in columns (default: terminal width or 80)
  --height       Chart height in rows (default: 20)
```

### When to Use Which Type

- **timeseries**: Range queries over time, trend analysis, multi-series comparison
- **bar**: Top-K comparisons, current value rankings, instant query results
- **heatmap**: Histogram bucket distributions (le-labeled series), latency analysis
- **Tables/text**: Single values, label discovery, instant queries with few results

---

## DPM / Billing Investigation

Use this workflow when asked about Grafana Cloud billing spikes, high DPM, or metric cardinality costs.

In Grafana Cloud, **DPM = 1 per active series**. High billing = too many active series. The goal is to find which stack and which metrics are responsible.

### Phase 1: Rank stacks by active series

If the config includes a `grafanacloud-usage` instance (a Grafana Cloud datasource proxy), use it to compare all stacks at once:

```bash
# Active series per stack — proxy for DPM
lgtm -i <org>-grafanacloud-usage prom query \
  'sum by (stack_id) (grafanacloud_instance_active_series)' 2>&1 \
  | jq -r '.data.result[] | "\(.metric.stack_id) | \(.value[1] | tonumber | floor) series"' \
  | sort -t'|' -k2 -rn | head -10

# Ingestion rate per stack
lgtm -i <org>-grafanacloud-usage prom query \
  'sum by (stack_id) (grafanacloud_instance_samples_per_second)' 2>&1 \
  | jq -r '.data.result[] | "\(.metric.stack_id) | \(.value[1] | tonumber | floor) samples/sec"' \
  | sort -t'|' -k2 -rn | head -10
```

To find **when** DPM spiked, use a range query:

```bash
lgtm -i <org>-grafanacloud-usage prom range \
  'sum by (stack_id) (grafanacloud_instance_active_series)' \
  --start $(date -u -v-30d +%Y-%m-%dT%H:%M:%SZ) \
  --end $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --step 1d > /tmp/dpm-trend.json 2>&1

# Show first vs last per stack to find biggest growers
cat /tmp/dpm-trend.json | jq -r '
  .data.result[] |
  "\(.metric.stack_id): first=\(.values[0][1] | tonumber | floor) last=\(.values[-1][1] | tonumber | floor) delta=\((.values[-1][1] | tonumber) - (.values[0][1] | tonumber) | floor)"
' | sort -t= -k4 -rn | head -10
```

Then render a chart directly (not in subagent):
```bash
lgtm chart /tmp/dpm-trend.json -t "Active Series by Stack (30d)" --type timeseries
```

### Phase 2: Drill into the top stack

Once you know the target stack's lgtm instance name, find which jobs and metrics have the highest cardinality:

```bash
# Top jobs by series count
lgtm -i <instance> prom query \
  'topk(20, count by (job) ({__name__=~".+"}))' 2>&1 \
  | jq -r '.data.result[] | "\(.metric.job // "unknown") | \(.value[1]) series"' \
  | sort -t'|' -k2 -rn

# Top metric names by series count
lgtm -i <instance> prom query \
  'topk(20, count by (__name__) ({__name__=~".+"}))' 2>&1 \
  | jq -r '.data.result[] | "\(.metric.__name__) | \(.value[1]) series"' \
  | sort -t'|' -k2 -rn

# Drill into a specific job
lgtm -i <instance> prom query \
  'count by (__name__) ({job="<job_name>"})' 2>&1 \
  | jq -r '.data.result[] | "\(.metric.__name__) | \(.value[1]) series"' \
  | sort -t'|' -k2 -rn | head -20
```

### Phase 3: Find the high-cardinality label

For the top offending metric, check which labels have many unique values:

```bash
for label in job instance model model_id node k8s_pod_name le; do
  count=$(lgtm -i <instance> prom query \
    "count by ($label) (<metric_name>)" 2>/dev/null \
    | jq '.data.result | length' 2>/dev/null)
  echo "$label: $count unique values"
done
```

High cardinality typically comes from:
- **`model` / `model_id`** — one value per ML model being served (can reach 100+)
- **`k8s_pod_name` / `instance`** — one per pod, fine alone but explosive when crossed with other labels
- **`le`** — histogram bucket boundaries (16+ values) multiplied by all other labels
- **`request_id` / `trace_id`** — unbounded IDs in labels (anti-pattern, should never be a label)

Common fix: use metric relabeling to drop or aggregate the offending label at scrape time, or replace high-resolution histograms with native histograms.

---

## Reference

For query syntax, see:
- `reference/logql.md` - LogQL syntax for Loki
- `reference/promql.md` - PromQL syntax for Prometheus
- `reference/traceql.md` - TraceQL syntax for Tempo
