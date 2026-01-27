# Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions that extend agent capabilities.

## Available Skills

### [lgtm](skills/lgtm/)

Query observability backends (Loki logs, Prometheus/Mimir metrics, Tempo traces) with built-in best practices for context efficiency.

**Use when:** Debugging production issues, investigating errors, analyzing metrics, tracing requests.

## Installation

```bash
npx skills add pokgak/agent-skills
```

## Usage

Skills activate automatically when relevant tasks are detected.

```
Show me error logs from the api service
What's the request rate for the checkout service?
Find slow traces over 1 second from the payment service
```

## CLI

The LGTM skill uses a standalone CLI for querying observability backends. See [pokgak/lgtm-cli](https://github.com/pokgak/lgtm-cli) for installation and usage.

## Skill Structure

```
skills/<name>/
├── SKILL.md          # Agent instructions
├── README.md         # Documentation
├── metadata.json     # Version and references
└── reference/        # Supporting files
```
