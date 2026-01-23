# TraceQL Reference

TraceQL is Tempo's query language for distributed traces.

## Basic Syntax

TraceQL queries select spans and return matching traces.

```traceql
{ }                                    # All spans
{ status = error }                     # Error spans
{ name = "HTTP GET" }                  # Spans with specific name
{ resource.service.name = "frontend" } # Spans from service
```

## Attribute Types

### Intrinsic Attributes

Built-in span properties:

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Span name |
| `status` | status | `ok`, `error`, `unset` |
| `kind` | kind | `server`, `client`, `producer`, `consumer`, `internal` |
| `duration` | duration | Span duration |
| `traceDuration` | duration | Total trace duration |
| `rootName` | string | Root span name |
| `rootServiceName` | string | Root span's service |
| `nestedSetParent` | int | Parent span ID |
| `nestedSetLeft` | int | Nested set left value |
| `nestedSetRight` | int | Nested set right value |

```traceql
{ status = error }
{ kind = server }
{ duration > 100ms }
{ name =~ "HTTP.*" }
```

### Resource Attributes

Attributes about the service/resource:

```traceql
{ resource.service.name = "api" }
{ resource.service.namespace = "production" }
{ resource.k8s.pod.name =~ "api-.*" }
{ resource.deployment.environment = "prod" }
```

### Span Attributes

Attributes on individual spans:

```traceql
{ span.http.method = "GET" }
{ span.http.status_code >= 400 }
{ span.http.url =~ ".*users.*" }
{ span.db.system = "postgresql" }
{ span.rpc.method = "GetUser" }
```

### Attribute Shorthand

Unscoped attributes check both resource and span:

```traceql
{ .http.method = "GET" }        # Checks span.http.method and resource.http.method
{ .service.name = "frontend" }  # Checks both scopes
```

## Comparison Operators

| Operator | Description |
|----------|-------------|
| `=` | Equal |
| `!=` | Not equal |
| `>` | Greater than |
| `>=` | Greater or equal |
| `<` | Less than |
| `<=` | Less or equal |
| `=~` | Regex match |
| `!~` | Regex not match |

```traceql
{ span.http.status_code >= 500 }
{ duration > 1s }
{ name =~ "POST.*" }
{ resource.service.name !~ "test.*" }
```

## Logical Operators

### AND (&&)

```traceql
{ span.http.method = "POST" && span.http.status_code >= 400 }
{ resource.service.name = "api" && status = error }
```

### OR (||)

```traceql
{ span.http.status_code = 500 || span.http.status_code = 503 }
{ status = error || duration > 5s }
```

### Grouping

```traceql
{ (span.http.method = "POST" || span.http.method = "PUT") && span.http.status_code >= 400 }
```

## Structural Operators

Match relationships between spans:

### Descendant (>>)

Span A has descendant B (any depth):

```traceql
{ resource.service.name = "frontend" } >> { resource.service.name = "database" }
```

### Child (>)

Span A has direct child B:

```traceql
{ resource.service.name = "api" } > { span.db.system = "postgresql" }
```

### Sibling (~)

Spans share the same parent:

```traceql
{ span.http.url =~ ".*user.*" } ~ { span.db.statement =~ "SELECT.*" }
```

### Not Descendant (!>>)

```traceql
{ resource.service.name = "frontend" } !>> { status = error }
```

### Not Child (!>)

```traceql
{ resource.service.name = "api" } !> { span.db.system = "redis" }
```

### Not Sibling (!~)

```traceql
{ name = "handle_request" } !~ { status = error }
```

## Aggregations

Compute values across spans:

```traceql
{ } | count() > 10                        # Traces with >10 spans
{ status = error } | count() > 0          # Traces with errors
{ resource.service.name = "api" } | avg(duration) > 100ms
{ } | max(duration) > 5s                  # Traces with slow spans
{ } | min(duration) < 1ms                 # Traces with fast spans
{ } | sum(span.bytes) > 1000000           # Traces with high data transfer
```

### Aggregation Functions

| Function | Description |
|----------|-------------|
| `count()` | Count of matching spans |
| `avg(attr)` | Average of numeric attribute |
| `min(attr)` | Minimum value |
| `max(attr)` | Maximum value |
| `sum(attr)` | Sum of values |

## Select Clause

Extract specific attributes:

```traceql
{ status = error } | select(span.http.url, span.http.status_code)
```

## Duration Units

| Unit | Description |
|------|-------------|
| `ns` | Nanoseconds |
| `us`, `µs` | Microseconds |
| `ms` | Milliseconds |
| `s` | Seconds |
| `m` | Minutes |
| `h` | Hours |

```traceql
{ duration > 500ms }
{ duration >= 1s && duration < 5s }
{ traceDuration > 10s }
```

## Common Patterns

### Slow Traces

```traceql
{ traceDuration > 5s }
```

### Slow Database Queries

```traceql
{ span.db.system = "postgresql" && duration > 1s }
```

### Error Traces

```traceql
{ status = error }
```

### Errors from Specific Service

```traceql
{ resource.service.name = "payment-service" && status = error }
```

### HTTP 5xx Errors

```traceql
{ span.http.status_code >= 500 }
```

### Cross-Service Calls

```traceql
{ resource.service.name = "frontend" } >> { resource.service.name = "backend" }
```

### Failed Cross-Service Calls

```traceql
{ resource.service.name = "frontend" } >> { resource.service.name = "backend" && status = error }
```

### Traces with Many Spans

```traceql
{ } | count() > 100
```

### High Latency Database Calls

```traceql
{ resource.service.name = "api" } > { span.db.system != nil && duration > 100ms }
```

### Redis Slow Commands

```traceql
{ span.db.system = "redis" && duration > 10ms }
```

### gRPC Errors

```traceql
{ span.rpc.system = "grpc" && span.rpc.grpc.status_code != 0 }
```

### Specific User Requests

```traceql
{ span.user.id = "user-123" }
{ resource.user.id = "user-123" }
```

### By HTTP Endpoint

```traceql
{ span.http.method = "POST" && span.http.route = "/api/v1/orders" }
```

### Traces with Both Success and Failure

```traceql
{ status = ok } && { status = error }
```

### Cold Start Detection (Serverless)

```traceql
{ span.faas.coldstart = true }
```

## Common Span Attributes

### HTTP

- `span.http.method` - GET, POST, etc.
- `span.http.url` - Full URL
- `span.http.route` - Route pattern
- `span.http.status_code` - Response code
- `span.http.request_content_length`
- `span.http.response_content_length`

### Database

- `span.db.system` - postgresql, mysql, redis, etc.
- `span.db.name` - Database name
- `span.db.statement` - Query (may be sanitized)
- `span.db.operation` - SELECT, INSERT, etc.

### RPC/gRPC

- `span.rpc.system` - grpc, etc.
- `span.rpc.service` - Service name
- `span.rpc.method` - Method name
- `span.rpc.grpc.status_code` - gRPC status

### Messaging

- `span.messaging.system` - kafka, rabbitmq, etc.
- `span.messaging.destination` - Queue/topic name
- `span.messaging.operation` - publish, receive, etc.

### Kubernetes

- `resource.k8s.namespace.name`
- `resource.k8s.pod.name`
- `resource.k8s.deployment.name`
- `resource.k8s.container.name`
