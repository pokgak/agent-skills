# linear

Interact with Linear issue tracking from the command line — list, create, and update issues and projects, manage cycles, and add comments.

## Installation

```bash
npx skills add pokgak/linear-cli
```

## Requirements

Set your Linear API key:

```bash
export LINEAR_APIKEY=your_api_key
```

Get your key from [Linear settings](https://linear.app/settings/api).

## Features

- List and filter issues by team, assignee, state, or cycle
- Show full issue details and comments
- Create and update issues (title, description, priority, assignee, state)
- Create and update projects
- Add comments to issues
- List teams, projects, and cycles
- Agent-friendly: auto-detects AI callers and returns structured JSON

## Underlying CLI

Built on [pokgak/linear-cli](https://github.com/pokgak/linear-cli), an agent-friendly CLI following the [agent-friendly CLI design guide](https://pokgak.xyz/notes/agent-friendly-cli-design/).
