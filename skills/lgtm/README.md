# LGTM Skill

A skill for AI coding assistants to query observability backends: Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces).

## Overview

This skill enables querying the Grafana LGTM stack using the `lgtm` CLI with built-in best practices for context efficiency. It uses the **orchestrator pattern** - spawning subagents to execute queries and return summaries, keeping raw JSON out of the main conversation.

## Key Concepts

- **Two-Phase Approach**: Discovery (haiku) → Investigation (sonnet)
- **Orchestrator Pattern**: Opus coordinates, subagents execute queries
- **Context Efficiency**: Raw JSON stays in subagent contexts, only summaries reach main conversation
- **Parallel Execution**: Independent queries run concurrently
- **Built-in Defaults**: 15 min time range, sensible limits

## Structure

```
lgtm/
├── SKILL.md              # Agent instructions
├── README.md             # This file
├── metadata.json         # Version and references
├── config.example.yaml   # Example configuration
└── reference/
    ├── logql.md          # LogQL syntax for Loki
    ├── promql.md         # PromQL syntax for Prometheus
    └── traceql.md        # TraceQL syntax for Tempo
```

## Reference Files

1. **LogQL** - Loki query language: stream selectors, line filters, parsers, metric queries
2. **PromQL** - Prometheus query language: selectors, functions, aggregations
3. **TraceQL** - Tempo query language: span selectors, structural operators, aggregations

## Configuration

Requires config at `~/.config/lgtm/config.yaml`:

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

## References

- [Loki LogQL Documentation](https://grafana.com/docs/loki/latest/query/)
- [Prometheus PromQL Documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Tempo TraceQL Documentation](https://grafana.com/docs/tempo/latest/traceql/)
