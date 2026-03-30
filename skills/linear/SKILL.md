---
name: linear
description: Interact with Linear issue tracking — list, create, update issues and projects, manage cycles, add comments, and query team data. Use this skill whenever the user asks about Linear tickets, issues, sprints/cycles, project management in Linear, or wants to create/update/triage issues. Triggers include "create a Linear issue", "update ticket", "show me issues in cycle", "what's in the backlog", "assign this to me", "add a comment to", "create a project in Linear".
allowed-tools: Bash, Read
license: MIT
---

# Linear CLI Skill

Interact with Linear issue tracking using the `linear-cli` tool.

## Setup

### Prerequisites

Requires `LINEAR_APIKEY` environment variable. Get your key from [Linear settings](https://linear.app/settings/api).

```bash
export LINEAR_APIKEY=your_api_key
```

### Running the CLI

Run directly from GitHub without cloning:

```bash
uvx --from git+https://github.com/pokgak/linear-cli linear <command>
```

Or if cloned locally at a known path, use:

```bash
uv run python /path/to/linear-cli/linear_cli.py <command>
```

Verify setup:

```bash
uvx --from git+https://github.com/pokgak/linear-cli linear me
```

## Agent Mode

This CLI is agent-friendly. It auto-detects agent callers via environment variables and returns structured JSON. Since `CLAUDECODE` is set in this environment, all output is already JSON — no extra flags needed.

All responses follow this envelope:

```json
{
  "status": "success",
  "data": [...],
  "metadata": { "count": 42 }
}
```

Errors include recovery suggestions:

```json
{
  "status": "error",
  "error_message": "Team 'XYZ' not found",
  "suggestions": ["Run 'linear teams' to list available team keys"]
}
```

Run `linear agent-schema` to get the full command tree as JSON.

## CLI Reference

### Discovery

```bash
# List all teams
linear teams

# List current user info and team memberships
linear me

# List projects (optionally filter by team)
linear projects
linear projects -t ENG

# List cycles for a team
linear cycles -t ENG
```

### Reading Issues

```bash
# List issues (default 25)
linear issues

# Filter by team
linear issues -t ENG

# Filter by assignee
linear issues -a "Alice"

# Filter by state
linear issues -s "In Progress"
linear issues -s "Backlog"

# Filter by cycle number
linear issues -c 84

# Combine filters
linear issues -t ENG -s "In Progress" -a me -n 50

# Show full issue details
linear show ENG-123

# Show comments on an issue
linear comments ENG-123
```

### Creating & Updating

```bash
# Create an issue
linear create-issue -t "Title" --team ENG
linear create-issue -t "Title" --team ENG -d "Description" -p "Project Name" --priority high

# Update an issue
linear update-issue ENG-123 -s "In Progress"
linear update-issue ENG-123 -a me
linear update-issue ENG-123 -p urgent
linear update-issue ENG-123 -t "New title" -d "New description"

# Add a comment
linear add-comment ENG-123 "Comment text here"

# Create a project
linear create-project -n "Project Name" -t ENG
linear create-project -n "Project Name" -t ENG -d "Description"

# Update a project
linear update-project "Old Name" -n "New Name"
linear update-project "Project Name" -d "New description"
```

## Common Workflows

### Triage and assign issues

```bash
# Find unassigned issues in a team
linear issues -t ENG -s "Todo"

# Assign to yourself
linear update-issue ENG-123 -a me

# Set priority and move to In Progress
linear update-issue ENG-123 -p high -s "In Progress"
```

### Investigate a cycle

```bash
# List cycles to find the current one
linear cycles -t ENG

# List issues in a specific cycle
linear issues -t ENG -c 84

# Filter by state within the cycle
linear issues -t ENG -c 84 -s "In Progress"
```

### Create and link issues to a project

```bash
# Find the project name first
linear projects -t ENG

# Create issue linked to project
linear create-issue -t "Fix login bug" --team ENG -p "Q2 Platform" --priority high
```

### Summarize a ticket for handoff

```bash
# Get full details
linear show ENG-123

# Get all comments
linear comments ENG-123
```

## Priority Values

| Value | Meaning |
|-------|---------|
| `none` | No priority |
| `urgent` | Urgent |
| `high` | High |
| `medium` | Medium |
| `low` | Low |

## Common States

States vary by team. Common ones: `Todo`, `In Progress`, `In Review`, `Done`, `Backlog`, `Cancelled`.

Use `linear update-issue` with an invalid state to see available states for that team:
```bash
linear update-issue ENG-123 -s "?"
# Returns: Available states: Backlog, Todo, In Progress, In Review, Done, Cancelled
```
