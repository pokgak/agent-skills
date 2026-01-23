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

This repo includes a standalone [LGTM CLI](src/lgtm_cli/) for querying observability backends directly.

```bash
uv tool install git+https://github.com/pokgak/agent-skills
lgtm --help
```

## Skill Structure

```
skills/<name>/
├── SKILL.md          # Agent instructions
├── README.md         # Documentation
├── metadata.json     # Version and references
└── reference/        # Supporting files
```
