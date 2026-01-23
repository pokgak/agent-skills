# PromQL Reference

PromQL is Prometheus's query language for metrics.

## Selectors

### Instant Vector

Select current values:

```promql
up
up{job="prometheus"}
http_requests_total{method="GET", status="200"}
```

### Range Vector

Select values over time:

```promql
http_requests_total[5m]
http_requests_total{job="api"}[1h]
```

### Label Matchers

| Operator | Description |
|----------|-------------|
| `=` | Exact match |
| `!=` | Not equal |
| `=~` | Regex match |
| `!~` | Regex not match |

```promql
up{job=~".*server"}
up{job!~"test.*"}
http_requests_total{status=~"5.."}
```

## Time Durations

| Unit | Description |
|------|-------------|
| `ms` | Milliseconds |
| `s` | Seconds |
| `m` | Minutes |
| `h` | Hours |
| `d` | Days |
| `w` | Weeks |
| `y` | Years |

```promql
rate(http_requests_total[5m])
increase(errors_total[1h])
```

## Offset Modifier

Query historical data:

```promql
http_requests_total offset 1h
rate(http_requests_total[5m] offset 1d)
```

## @ Modifier

Query at specific timestamp:

```promql
http_requests_total @ 1609459200
rate(http_requests_total[5m]) @ end()
```

## Functions

### Rate Functions

```promql
# Per-second rate
rate(http_requests_total[5m])

# Instantaneous rate (more volatile)
irate(http_requests_total[5m])

# Total increase
increase(http_requests_total[1h])

# Change in gauge
delta(temperature[1h])

# Rate for gauges
deriv(temperature[1h])
```

### Aggregation Over Time

```promql
avg_over_time(temperature[1h])
max_over_time(memory_usage[1d])
min_over_time(cpu_usage[5m])
sum_over_time(requests[1h])
count_over_time(up[1d])
quantile_over_time(0.95, response_time[1h])
stddev_over_time(latency[1h])
```

### Math Functions

```promql
abs(delta(temperature[1h]))
ceil(request_duration_seconds)
floor(request_duration_seconds)
round(request_duration_seconds, 0.1)
ln(http_requests_total)
log2(http_requests_total)
log10(http_requests_total)
exp(metric)
sqrt(metric)
clamp(metric, 0, 100)
clamp_min(metric, 0)
clamp_max(metric, 100)
```

### Time Functions

```promql
time()                    # Current Unix timestamp
timestamp(up)             # Timestamp of sample
day_of_week()            # 0-6 (Sunday=0)
day_of_month()           # 1-31
day_of_year()            # 1-366
hour()                   # 0-23
minute()                 # 0-59
month()                  # 1-12
year()
```

### Label Functions

```promql
label_join(metric, "dst", ",", "src1", "src2")
label_replace(metric, "dst", "$1", "src", "regex")
```

### Histogram Functions

```promql
histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))
histogram_quantile(0.99, sum by (le) (rate(request_duration_bucket[5m])))
```

### Other Functions

```promql
absent(up{job="missing"})           # Returns 1 if no series
absent_over_time(up[5m])            # Returns 1 if no data in range
changes(config_reloads[1h])         # Count of value changes
resets(counter[1h])                 # Count of counter resets
sort(metric)                        # Sort ascending
sort_desc(metric)                   # Sort descending
vector(1)                           # Scalar to vector
scalar(sum(up))                     # Vector to scalar
```

## Aggregation Operators

```promql
sum(http_requests_total)
avg(cpu_usage)
min(memory_available)
max(response_time)
count(up)
stddev(latency)
stdvar(latency)
topk(5, http_requests_total)
bottomk(5, http_requests_total)
group(up)                           # Returns 1 for each series
count_values("version", build_info) # Count unique values
```

### By/Without Clauses

```promql
sum by (job, instance) (rate(http_requests_total[5m]))
sum without (instance) (rate(http_requests_total[5m]))
avg by (namespace) (container_memory_usage_bytes)
max by (pod) (container_cpu_usage_seconds_total)
```

## Binary Operators

### Arithmetic

```promql
http_requests_total + 1
memory_used / memory_total * 100
rate(requests_total[5m]) * 60
```

### Comparison

Returns 0 or 1, or filters:

```promql
http_requests_total > 100
http_requests_total > bool 100    # Returns 0/1
cpu_usage >= 0.9
response_time != 0
```

### Logical

```promql
up == 1 and on(job) up{env="prod"}
up == 0 or vector(0)
up unless on(job) blacklist
```

### Vector Matching

```promql
# One-to-one
method:http_requests:rate5m / ignoring(method) http_requests:rate5m

# Many-to-one
requests * on(instance) group_left(version) version_info

# One-to-many
info * on(instance) group_right() requests
```

## Common Patterns

### Error Rate

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))
```

### Request Rate by Status

```promql
sum by (status) (rate(http_requests_total[5m]))
```

### Latency Percentiles

```promql
histogram_quantile(0.50, sum by (le) (rate(http_request_duration_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_bucket[5m])))
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_bucket[5m])))
```

### Memory Usage Percentage

```promql
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

### CPU Usage

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Disk Usage

```promql
(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100
```

### Top 5 Memory Consumers

```promql
topk(5, sum by (pod) (container_memory_usage_bytes))
```

### Rate of Change

```promql
deriv(node_memory_MemAvailable_bytes[1h])
```

### Service Availability

```promql
avg_over_time(up{job="api"}[1d]) * 100
```

### Alerts Firing

```promql
ALERTS{alertstate="firing"}
```

## Recording Rules Naming

Convention: `level:metric:operations`

```promql
# Examples
job:http_requests:rate5m
namespace:container_cpu_usage:sum
cluster:node_cpu:ratio
```
