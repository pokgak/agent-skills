# Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions that extend agent capabilities.

## Available Skills

### [lgtm](skills/lgtm/)

Query observability backends (Loki logs, Prometheus/Mimir metrics, Tempo traces) with built-in best practices for context efficiency.

**Use when:** Debugging production issues, investigating errors, analyzing metrics, tracing requests.

### [n8n](skills/n8n/)

Manage n8n workflows and troubleshoot executions. Supports workflow CRUD, node editing, credential management, and execution debugging.

**Use when:** Working with n8n workflows, webhook triggers, execution errors, or editing workflow nodes.

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

Each skill uses a standalone CLI:

- **LGTM:** [pokgak/lgtm-cli](https://github.com/pokgak/lgtm-cli) - Query observability backends
- **n8n:** [pokgak/n8n-cli](https://github.com/pokgak/n8n-cli) - Manage n8n workflows and executions

## Skill Structure

```
skills/<name>/
├── SKILL.md          # Agent instructions
├── README.md         # Documentation
├── metadata.json     # Version and references
└── reference/        # Supporting files
```
