# MCP server

PLANKA serves a [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /api/mcp`, so AI clients can read and edit boards as a PLANKA user.

- Transport: stateless streamable HTTP with JSON responses. `GET` and `DELETE` answer `405`.
- Auth: an API key in the `X-Api-Key` header. Session access tokens and the internal access token are rejected.
- Permissions: every tool runs the matching REST action as the API key user, so it sees and changes only what that user can in the web app.

## Get an API key

An admin creates the key for a user with `POST /api/users/{id}/api-key`. The response holds the key once; store it somewhere safe.

## Connect a client

Claude Code:

```sh
claude mcp add --transport http planka https://planka.example.com/api/mcp \
  --header "X-Api-Key: <api key>"
```

Any client that reads an `.mcp.json`-style config:

```json
{
  "mcpServers": {
    "planka": {
      "type": "http",
      "url": "https://planka.example.com/api/mcp",
      "headers": {
        "X-Api-Key": "<api key>"
      }
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_projects` | Projects the user can access, with their boards |
| `get_project` | One project with boards, managers and board memberships |
| `list_boards` | Accessible boards, optionally of one project |
| `get_board` | One board with lists, labels and members |
| `list_cards` | Cards of a board or one list (archive and trash lists return their latest cards) |
| `get_card` | One card with labels, members, tasks, attachments and custom fields |
| `search_cards` | Cards of a board whose name or description contains every word of the query |
| `create_card` | New card, at the end of the list unless a position is given |
| `update_card` | Name, description, type, due date |
| `move_card` | Move to another list or board, at the end unless a position is given |
| `delete_card` | Delete a card |
| `create_task` | New task on a card; uses the first task list, creating one when the card has none |
| `update_task` | Rename, complete or reopen, assign |
| `delete_task` | Delete a task |
| `add_label_to_card`, `remove_label_from_card` | Card labels |
| `add_member_to_card`, `remove_member_from_card` | Card members |
| `create_comment`, `list_comments` | Card comments |

Results come back as JSON text holding the same records as the REST API. A refused action, such as a viewer trying to edit, comes back as a tool error with the REST error message (`Not enough rights`, `Card not found`).
