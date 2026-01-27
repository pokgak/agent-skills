---
name: n8n
description: Manage n8n workflows and troubleshoot executions. Use when user asks about n8n workflows, webhook triggers, execution errors, or wants to edit workflow nodes.
allowed-tools: Bash, Read, Write, Glob
license: MIT
---

# n8n Skill - Manage Workflows and Executions

## CLI Setup

The CLI is available via uvx (no installation needed):

```bash
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py --help
```

### Environment Variables

Required:
- `N8N_API_KEY` - API key from n8n (Settings → n8n API)
- `N8N_BASE_URL` - n8n instance URL (e.g., `https://your-instance.app.n8n.cloud`)

## CLI Reference

### List Workflows

```bash
# List all workflows
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py workflows

# Active workflows only
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py workflows --active

# JSON output
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py workflows --json
```

### Workflow Details

```bash
# Get workflow details
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py workflow <workflow_id>

# Full JSON output
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py workflow <workflow_id> --json
```

### Activate/Deactivate Workflows

```bash
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py activate <workflow_id>
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py deactivate <workflow_id>
```

### List Nodes in Workflow

```bash
# List all nodes (Code nodes marked with *)
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py nodes <workflow_id>
```

### View/Edit Nodes

```bash
# View node details
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "node name"

# View Code node's JavaScript
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "node name" --code

# Update Code node from file
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "node name" --set-code script.js

# Rename a node
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "old name" --rename "new name"
```

### Export/Import Code Nodes

Useful for editing Code node scripts in a proper editor:

```bash
# Export all Code nodes to files
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py export-code <workflow_id> ./nodes/

# Import updated scripts back
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py import-code <workflow_id> ./nodes/
```

### Trigger Workflows

```bash
# Trigger workflow by name via webhook
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py trigger "Workflow Name"

# With JSON payload
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py trigger "Workflow Name" --data '{"key": "value"}'

# With payload from file
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py trigger "Workflow Name" --file payload.json

# Use test webhook URL
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py trigger "Workflow Name" --test
```

### List Executions

```bash
# Recent executions
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions

# Filter by workflow
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions --workflow <workflow_id>

# Filter by status (error, success, running, waiting, canceled)
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions --status error

# Limit results
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions -n 100
```

### Execution Details

```bash
# Get execution details (shows error info for failed executions)
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py execution <execution_id>

# Include full execution data
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py execution <execution_id> --data

# JSON output
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py execution <execution_id> --data --json
```

### Retry Failed Execution

```bash
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py retry <execution_id>

# Use latest workflow version
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py retry <execution_id> --latest
```

## Common Workflows

### Troubleshoot Failed Executions

```bash
# 1. Find failed executions
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions --status error

# 2. Get error details
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py execution <id>

# 3. Get full data for debugging
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py execution <id> --data --json
```

### Edit Code Nodes

```bash
# 1. Export all Code nodes
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py export-code <workflow_id> ./nodes/

# 2. Edit scripts in your editor
# Files: ./nodes/node_name.js

# 3. Import changes back
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py import-code <workflow_id> ./nodes/
```

### Quick Node Update

```bash
# View current code
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "node name" --code > script.js

# Edit script.js...

# Update node
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py node <workflow_id> "node name" --set-code script.js
```

### Test Webhook Workflow

```bash
# Trigger with test payload
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py trigger "Workflow Name" --test --file test_payload.json

# Check execution result
uvx --from git+https://github.com/pokgak/n8n-cli n8n-cli.py executions --workflow <id> -n 1
```
