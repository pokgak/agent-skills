# LogQL Reference

LogQL is Loki's query language for logs.

## Stream Selectors

Select log streams using labels:

```logql
{app="myapp"}
{app="myapp", env="production"}
{app=~"frontend|backend"}
{app!="test"}
{namespace=~".+"}
```

### Label Matchers

| Operator | Description |
|----------|-------------|
| `=` | Exact match |
| `!=` | Not equal |
| `=~` | Regex match |
| `!~` | Regex not match |

## Line Filters

Filter log lines by content:

```logql
{app="myapp"} |= "error"
{app="myapp"} != "debug"
{app="myapp"} |~ "error|warning"
{app="myapp"} !~ "health|ready"
```

| Operator | Description |
|----------|-------------|
| `\|=` | Contains string |
| `!=` | Does not contain |
| `\|~` | Matches regex |
| `!~` | Does not match regex |

### Case Insensitive

```logql
{app="myapp"} |~ "(?i)error"
```

## Parsers

Extract structured data from logs:

### JSON Parser

```logql
{app="myapp"} | json
{app="myapp"} | json level, message
{app="myapp"} | json level="severity", msg="message"
```

### Logfmt Parser

```logql
{app="myapp"} | logfmt
{app="myapp"} | logfmt level, msg
```

### Pattern Parser

```logql
{app="myapp"} | pattern "<ip> - - [<_>] \"<method> <path> <_>\" <status>"
```

### Regexp Parser

```logql
{app="myapp"} | regexp "(?P<ip>\\d+\\.\\d+\\.\\d+\\.\\d+)"
```

### Unpack Parser

For Promtail packed logs:

```logql
{app="myapp"} | unpack
```

## Label Filters

Filter on extracted labels:

```logql
{app="myapp"} | json | level="error"
{app="myapp"} | json | status >= 400
{app="myapp"} | json | duration > 1s
{app="myapp"} | json | level=~"error|warn"
```

### Comparison Operators

| Operator | Description |
|----------|-------------|
| `==`, `=` | Equal |
| `!=` | Not equal |
| `>`, `>=` | Greater than |
| `<`, `<=` | Less than |
| `=~` | Regex match |
| `!~` | Regex not match |

### Duration and Bytes

```logql
| duration > 5m
| duration < 100ms
| bytes > 1KB
| bytes < 1MB
```

## Line Format

Reformat log lines:

```logql
{app="myapp"} | json | line_format "{{.level}}: {{.message}}"
{app="myapp"} | json | line_format "{{.timestamp | toDateInZone \"2006-01-02\" \"UTC\"}}"
```

### Template Functions

- `toUpper`, `toLower` - Case conversion
- `trim`, `trimPrefix`, `trimSuffix` - Whitespace
- `replace` - String replacement
- `toDateInZone` - Date formatting

## Label Format

Modify labels:

```logql
{app="myapp"} | json | label_format level=`{{.severity}}`
{app="myapp"} | logfmt | label_format app=""  # Remove label
```

## Drop/Keep

Filter labels:

```logql
{app="myapp"} | json | drop __error__, __error_details__
{app="myapp"} | json | keep level, message
```

## Metric Queries

Convert logs to metrics:

### Count Over Time

```logql
count_over_time({app="myapp"}[5m])
count_over_time({app="myapp"} |= "error" [1h])
```

### Rate

```logql
rate({app="myapp"}[5m])
rate({app="myapp"} |= "error" [5m])
```

### Bytes Rate

```logql
bytes_rate({app="myapp"}[5m])
bytes_over_time({app="myapp"}[1h])
```

### Sum by Label

```logql
sum by (level) (count_over_time({app="myapp"} | json [5m]))
```

### Quantile Over Time

```logql
quantile_over_time(0.95, {app="myapp"} | json | unwrap duration [5m])
```

### Unwrap

Extract numeric values for aggregation:

```logql
avg_over_time({app="myapp"} | json | unwrap response_time [5m])
max_over_time({app="myapp"} | logfmt | unwrap bytes [1h])
```

## Aggregations

| Function | Description |
|----------|-------------|
| `sum` | Sum values |
| `avg` | Average |
| `min` | Minimum |
| `max` | Maximum |
| `count` | Count series |
| `stddev` | Standard deviation |
| `stdvar` | Standard variance |
| `topk(k, ...)` | Top k series |
| `bottomk(k, ...)` | Bottom k series |

### By/Without

```logql
sum by (namespace, app) (rate({job="logs"}[5m]))
sum without (instance) (rate({job="logs"}[5m]))
```

## Common Patterns

### Error Rate

```logql
sum(rate({app="myapp"} |= "error" [5m]))
  /
sum(rate({app="myapp"}[5m]))
```

### Top Error Messages

```logql
topk(10, sum by (message) (count_over_time({app="myapp"} | json | level="error" [1h])))
```

### Latency Percentile

```logql
quantile_over_time(0.99, {app="myapp"} | json | unwrap latency_ms [5m]) by (endpoint)
```

### Log Volume by App

```logql
sum by (app) (bytes_over_time({namespace="production"}[1h]))
```

### Errors by Status Code

```logql
sum by (status) (count_over_time({app="nginx"} | json | status >= 400 [1h]))
```
