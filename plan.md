# Integrations plan: MCP, automation rules, GitHub, Discord

Tracking file for the integrations work. Tick a box when its item is merged or verified.
Each phase ships as its own PR against `master`, split into one commit per related change.

Status legend: `[ ]` todo, `[~]` in progress, `[x]` done.

## Decisions

| Topic | Decision |
| --- | --- |
| MCP location | Built into the Sails server, streamable HTTP at `POST /api/mcp`, auth with existing `X-Api-Key` |
| "Run actions" | Board-level automation rules (trigger, conditions, actions) |
| GitHub | Two-way issue sync, one-way import mode, PR/commit linking |
| Discord | Rich notifications via webhook embeds, bot slash commands via HTTP interactions endpoint (no gateway process) |
| Secrets | Integration tokens encrypted at rest with `INTEGRATIONS_ENCRYPTION_KEY` from `.env` |
| Loop guard | Actions done by an integration carry `origin` (`automation`, `github`, `discord`); handlers skip their own origin |

## Open questions

- [ ] Confirm adding `@modelcontextprotocol/sdk` to `server/package.json`
- [ ] Confirm Discord bot via HTTP interactions instead of a gateway bot
- [ ] GitHub auth: PAT only first, or GitHub App from the start?
- [ ] Which PLANKA roles may manage automations and integrations (board editor, project manager, admin)?

## Phase 0: internal event bus

Hook point: `server/api/helpers/utils/send-webhooks.js` (called from 78 helpers).

- [x] Add internal dispatcher that runs before the outgoing webhook filter (today the helper returns early when no webhook matches)
- [x] Subscriber registry (`sails.helpers.utils.subscribeToEvents` or a small hook in `server/api/hooks/`)
- [x] Pass `origin` through helpers that integrations call, for the loop guard
- [x] Tests: subscriber receives events with data, prevData, user and scope
- [ ] PR

Built as the `event-bus` hook (`server/api/hooks/event-bus/`): `subscribe(handler)` returns an unsubscribe function, `sendWebhooks` emits `{ event, data, prevData, user, scope, origin }` to every subscriber on a later microtask, and data is only built when a subscriber or webhook needs it.
`origin` travels through `AsyncLocalStorage` instead of a new input on each helper: integrations wrap their helper calls in `sails.hooks['event-bus'].runWithOrigin('github', fn)`, and every event emitted inside carries that origin.

## Phase 1: built-in MCP server

- [ ] Add `@modelcontextprotocol/sdk` dependency
- [ ] Route `POST /api/mcp` (and `GET`/`DELETE` if session mode is used) in `server/config/routes.js`
- [ ] Controller `server/api/controllers/mcp/` wiring the SDK transport to the Sails request
- [ ] Auth: require API key user, reject internal token; reuse `is-authenticated` policy
- [ ] Tools, each reusing helpers and the same permission checks as REST controllers:
  - [ ] `list_projects`, `get_project`
  - [ ] `list_boards`, `get_board` (lists, labels, members included)
  - [ ] `list_cards`, `get_card`, `search_cards`
  - [ ] `create_card`, `update_card`, `move_card`, `delete_card`
  - [ ] `create_task`, `update_task`, `delete_task`
  - [ ] `add_label_to_card`, `remove_label_from_card`
  - [ ] `add_member_to_card`, `remove_member_from_card`
  - [ ] `create_comment`, `list_comments`
- [ ] Integration tests per tool (auth, permission denied, happy path)
- [ ] Swagger / docs entry and a client config example (Claude Code `claude mcp add --transport http`)
- [ ] PR

## Phase 2: automation rules

- [ ] Migration `automation_rule` (board_id, name, is_enabled, trigger jsonb, conditions jsonb, actions jsonb, position, created_by)
- [ ] Model `server/api/models/AutomationRule.js` + query methods
- [ ] Helpers: create, update, delete, get-path-to-project
- [ ] REST: `GET/POST /api/boards/:boardId/automation-rules`, `PATCH/DELETE /api/automation-rules/:id`
- [ ] Triggers: card created, card moved to list, label added, member added, due date reached, GitHub event
- [ ] Conditions: in list, has label, has member, title matches
- [ ] Actions: move card, add/remove label, add/remove member, post comment, set due date, send Discord message, create GitHub issue
- [ ] Executor subscribed to the event bus, with `origin: 'automation'` and a max chain depth
- [ ] Due-date trigger: scheduled check (interval in a hook)
- [ ] Socket broadcasts so open clients update
- [ ] MCP tools: `list_automation_rules`, `create_automation_rule`, `update_automation_rule`, `delete_automation_rule`, `run_automation_rule`
- [ ] Client: redux-orm model, sagas, API module, "Automations" pane in `BoardSettingsModal`
- [ ] Locales (en at least)
- [ ] Tests: server integration + client
- [ ] Browser verification in Chrome DevTools
- [ ] PR

## Phase 3: GitHub

- [ ] Migration `github_connection` (board_id, repo owner/name, encrypted token, webhook secret, open list id, closed list id, mode: `two_way` / `import`)
- [ ] Migration `github_link` (card_id, issue number, issue node id, last synced at)
- [ ] Encryption helper for tokens (`INTEGRATIONS_ENCRYPTION_KEY`)
- [ ] REST CRUD for the board connection + "test connection"
- [ ] Incoming `POST /api/integrations/github/webhook` with `X-Hub-Signature-256` HMAC check (no API auth on this route)
- [ ] Issues to cards: opened, edited, closed, reopened, labeled, assigned
- [ ] Cards to issues (two-way mode): title, description, list move to state, labels, assignees
- [ ] Import mode: issues create cards only; closing moves card to the closed list
- [ ] PR/commit linking: `#card-<id>` mention adds link and comment; merged PR moves card
- [ ] Outgoing GitHub calls through `outgoingProxy`, rate-limit handling
- [ ] Automation trigger "GitHub event" and action "create GitHub issue"
- [ ] MCP tools: `link_card_to_issue`, `sync_github`
- [ ] Client: "GitHub" pane in `BoardSettingsModal`, issue badge on card
- [ ] Tests (signature check, sync both ways, loop guard)
- [ ] Browser verification in Chrome DevTools
- [ ] PR

## Phase 4: Discord

Rich notifications:

- [ ] Migration `discord_connection` (board_id, encrypted webhook url, event list, guild/channel ids for bot)
- [ ] Embed builder per event (card create, move, comment, due soon)
- [ ] Subscriber on the event bus posting to the webhook URL

Bot commands (HTTP interactions):

- [ ] `POST /api/integrations/discord/interactions` with Ed25519 signature check (`X-Signature-Ed25519`, `X-Signature-Timestamp`)
- [ ] Config: `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`
- [ ] Command registration script (`npm run discord:register-commands`)
- [ ] Discord user to PLANKA user linking (link code flow)
- [ ] Commands: `/board list`, `/card create`, `/card move`, `/card show`
- [ ] Permission check runs as the linked PLANKA user
- [ ] Automation action "send Discord message"
- [ ] Client: "Discord" pane in `BoardSettingsModal`, user-level account link in settings
- [ ] Tests (signature check, commands, permissions)
- [ ] Browser verification in Chrome DevTools
- [ ] PR

## Done log

Add a line per merged PR: date, phase, PR link.
