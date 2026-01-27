# n8n Skill

A skill for AI coding assistants to manage n8n workflows and troubleshoot executions.

## Overview

This skill enables managing n8n workflows using the `n8n-cli` CLI tool - list workflows, edit nodes, trigger webhooks, and debug failed executions.

## Structure

```
n8n/
├── SKILL.md          # Agent instructions and CLI reference
├── README.md         # This file
└── metadata.json     # Version and references
```

## Features

- List and manage workflows (activate/deactivate)
- View and edit workflow nodes
- Export/import Code node scripts for editing
- Trigger workflows via webhooks with custom payloads
- List and inspect executions
- Debug failed executions
- Retry failed executions

## Configuration

Requires environment variables:

```bash
export N8N_API_KEY="your-api-key"
export N8N_BASE_URL="https://your-instance.app.n8n.cloud"
```

Get your API key from n8n: Settings → n8n API → Create API Key

## References

- [n8n API Documentation](https://docs.n8n.io/api/)
- [n8n-cli Repository](https://github.com/pokgak/n8n-cli)
