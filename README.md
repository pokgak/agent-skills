# LGTM Skill

Claude Code skill and CLI for querying observability backends: Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces).

## Skill Installation

```bash
npx skills add pokgak/skills-lgtm
```

Or manually copy to your Claude skills directory:

```bash
cp -r skills/lgtm ~/.claude/skills/
```

## CLI Installation

The skill includes a lightweight CLI with built-in best practices (sensible defaults for time ranges and limits).

**Requires Python 3.12+**

```bash
# Install globally with uv
uv tool install git+https://github.com/pokgak/skills-lgtm

# Or run directly without installing
uvx --from git+https://github.com/pokgak/skills-lgtm lgtm --help
```

### CLI Usage

```bash
# List configured instances
lgtm instances

# Query Loki logs (defaults: last 15 min, limit 50)
lgtm loki query '{app="myapp"} |= "error"'

# Query Prometheus metrics
lgtm prom query 'rate(http_requests_total[5m])'

# Search Tempo traces (defaults: last 15 min, limit 20)
lgtm tempo search -q '{resource.service.name="api"}'

# Use specific instance
lgtm -i production loki labels
```

## Configuration

Create a config file at `~/.config/lgtm/config.yaml`:

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

See [config.example.yaml](skills/lgtm/config.example.yaml) for more examples including authentication.

### Authentication

| Config Fields | Auth Type | Description |
|---------------|-----------|-------------|
| `token` only | Bearer | `Authorization: Bearer <token>` header |
| `username` + `token` | Basic | HTTP Basic auth |
| `headers` | Custom | Custom headers (e.g., `X-Scope-OrgID` for multi-tenant) |

Example with authentication:

```yaml
version: "1"
default_instance: "production"

instances:
  production:
    loki:
      url: "https://loki.example.com"
      token: "${LOKI_TOKEN}"  # Bearer auth, reads from env var
    prometheus:
      url: "https://mimir.example.com"
      username: "${MIMIR_USER}"  # Basic auth when both set
      token: "${MIMIR_TOKEN}"
    tempo:
      url: "https://tempo.example.com"
      token: "${TEMPO_TOKEN}"
      headers:
        X-Scope-OrgID: "my-tenant"  # Custom headers
```

### Environment Variables

Config values with `${VAR_NAME}` syntax are expanded from environment variables at runtime.

## Built-in Best Practices

The CLI encodes best practices to minimize token/context usage:

- **Default time range:** 15 minutes (not hours/days)
- **Default limits:** 50 for logs, 20 for traces
- **Discovery commands:** Always available to explore labels/metrics/tags first

### Recommended Workflow

1. **Discover** what's available:
   ```bash
   lgtm loki labels
   lgtm loki label-values app
   ```

2. **Aggregate** to get overview:
   ```bash
   lgtm loki instant 'sum by (app) (count_over_time({namespace="prod"} |= "error" [15m]))'
   ```

3. **Drill down** to specifics:
   ```bash
   lgtm loki query '{namespace="prod", app="checkout"} |= "error"' --limit 20
   ```

## Skill Usage

Once the skill is installed, it activates when you ask Claude about logs, metrics, traces, or debugging production issues.

Example prompts:
- "Show me error logs from the api service in the last 15 minutes"
- "What's the request rate for the checkout service?"
- "Find slow traces over 1 second from the payment service"
- "Check if there are any 5xx errors in production"

## Orchestrator Pattern (Context Efficiency)

The skill uses a two-phase subagent pattern to keep Opus context lean:

```
┌─────────────────────────────────────────────────────────┐
│  OPUS (Orchestrator)                                    │
│  - Evaluates summaries from subagents                   │
│  - Decides what to investigate next                     │
│  - Synthesizes findings for user                        │
│  - NEVER executes queries directly                      │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────────────┐
│ Phase 1: HAIKU  │          │ Phase 2: SONNET (parallel)  │
│ Discovery       │    ──►   │ Investigation               │
│ - Labels        │          │ - Log queries               │
│ - Services      │          │ - Trace analysis            │
│ - Namespaces    │          │ - Metric queries            │
└─────────────────┘          └─────────────────────────────┘
```

**Validated results:**

| Metric | Without Pattern | With Pattern |
|--------|-----------------|--------------|
| Opus context usage | 50-100k tokens | 34k tokens (17%) |
| Raw JSON in main context | Yes | No |
| Parallel investigation | No | Yes |

The pattern keeps raw observability data in disposable subagent contexts while Opus only sees concise summaries.

## Query Language References

- [LogQL](skills/lgtm/reference/logql.md) - Loki query language
- [PromQL](skills/lgtm/reference/promql.md) - Prometheus query language
- [TraceQL](skills/lgtm/reference/traceql.md) - Tempo query language

## Compatibility

This config format is compatible with [lgtm-mcp](https://github.com/pokgak/lgtm-mcp) for easy migration between the skill and MCP server.
