# Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions and scripts that extend agent capabilities.

Skills follow the [Agent Skills](https://skills.sh/) format.

## Available Skills

### lgtm

Query observability backends (Loki logs, Prometheus/Mimir metrics, Tempo traces) with built-in best practices for context efficiency.

**Use when:**
- Debugging production issues
- Investigating errors in logs
- Analyzing metrics and performance
- Tracing requests across services

**Key concepts:**
- Orchestrator Pattern (Critical) - Opus coordinates, subagents execute queries
- Two-Phase Approach (Critical) - Discovery first, then investigation
- Context Efficiency (Critical) - Raw JSON stays in subagent contexts
- Parallel Execution (High) - Independent queries run concurrently
- Built-in Defaults (High) - 15 min time range, sensible limits

**References:**
- [Loki LogQL](https://grafana.com/docs/loki/latest/query/)
- [Prometheus PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Tempo TraceQL](https://grafana.com/docs/tempo/latest/traceql/)

## Installation

```bash
npx skills add pokgak/agent-skills
```

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**
```
Show me error logs from the api service
```
```
What's the request rate for the checkout service?
```
```
Find slow traces over 1 second from the payment service
```

## CLI

This repo also includes a standalone CLI for querying observability backends.

**Requires Python 3.12+**

```bash
# Install globally
uv tool install git+https://github.com/pokgak/agent-skills

# Or run directly
uvx --from git+https://github.com/pokgak/agent-skills lgtm --help
```

### Configuration

Create config at `~/.config/lgtm/config.yaml`:

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

See [config.example.yaml](skills/lgtm/config.example.yaml) for authentication examples.

## Skill Structure

Each skill contains:
- `SKILL.md` - Instructions for the agent
- `README.md` - Human-readable documentation
- `metadata.json` - Version and references
- `reference/` - Query language syntax guides

## Compatibility

Config format is compatible with [lgtm-mcp](https://github.com/pokgak/lgtm-mcp) for easy migration.
