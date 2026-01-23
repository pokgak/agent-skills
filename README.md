# LGTM Skill

Claude Code skill for querying observability backends: Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces).

## Installation

```bash
npx skills add pokgak/skills-lgtm
```

Or manually copy to your Claude skills directory:

```bash
cp -r skills/lgtm ~/.claude/skills/
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

### Config File Location

The skill looks for configuration at: `~/.config/lgtm/config.yaml`

### Authentication

The skill supports three authentication methods:

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

## Usage

Once installed, the skill activates when you ask Claude about logs, metrics, traces, or debugging production issues.

Example prompts:
- "Show me error logs from the api service in the last 15 minutes"
- "What's the request rate for the checkout service?"
- "Find slow traces over 1 second from the payment service"
- "Check if there are any 5xx errors in production"

## Query Language References

The skill includes syntax references for:
- [LogQL](skills/lgtm/reference/logql.md) - Loki query language
- [PromQL](skills/lgtm/reference/promql.md) - Prometheus query language
- [TraceQL](skills/lgtm/reference/traceql.md) - Tempo query language

## Compatibility

This config format is compatible with [lgtm-mcp](https://github.com/pokgak/lgtm-mcp) for easy migration between the skill and MCP server.
