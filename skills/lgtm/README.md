# LGTM Skill

A skill for AI coding assistants to query observability backends: Loki (logs), Prometheus/Mimir (metrics), and Tempo (traces).

## Installation

```bash
npx @anthropic-ai/claude-code skills add pokgak/agent-skills/skills/lgtm
```

## Overview

This skill enables querying the Grafana LGTM stack using the `lgtm` CLI with built-in best practices for context efficiency.

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
