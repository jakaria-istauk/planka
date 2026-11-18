<div align="center">

  <img src="assets/logo.png" alt="Tama" width="300">

  **Free, self-hosted kanban for teams, with AI assistants built in.**

  [Quick start](#quick-start) · [Features](#features) · [AI assistants](docs/mcp.md) · [Deploy](#deploy) · [License](#license)

</div>

---

Tama is a real-time kanban board you run on your own server. Plan projects in
boards, lists and cards, work on them together live, and let AI assistants such
as Claude, ChatGPT or Cursor read and update your boards with your permissions.

Tama is based on [PLANKA](https://github.com/plankanban/planka) and adds an
MCP server, OAuth sign-in for AI assistants and a redesigned interface. It is
free to use and its source is public: anyone can run it, fork it and change it,
within the [license](#license).

## Features

- **Kanban boards:** projects, boards, lists and cards with drag and drop.
- **Real-time collaboration:** every change shows up for everyone at once, no refresh.
- **Rich cards:** Markdown descriptions, attachments, comments, tasks, labels,
  custom fields, due dates and a stopwatch.
- **AI assistants (MCP):** a built-in [Model Context Protocol](https://modelcontextprotocol.io)
  server at `/api/mcp`. Claude, ChatGPT, Claude Code, Codex, Cursor, VS Code,
  Gemini CLI and Windsurf can work on your boards as you. See [docs/mcp.md](docs/mcp.md).
- **OAuth for assistants:** Claude and ChatGPT connect with a consent screen; you
  can see and revoke connected apps at any time.
- **Notifications:** to over 100 services through [Apprise](https://appriseit.com/services/).
- **Webhooks and a REST API** for your own integrations.
- **Security:** two-factor authentication with recovery codes, and personal API keys.
- **Light and dark themes**, and a multilingual interface.

## Quick start

You need Docker with Compose.

```sh
git clone https://github.com/jakaria-istauk/planka.git tama
cd tama
```

Open `docker-compose.yml` and set at least:

- `BASE_URL`: the address people open Tama at, for example `https://tama.example.com`.
- `SECRET_KEY`: a random value, from `openssl rand -hex 32`.

Then start it and create the first admin:

```sh
docker compose up -d --build
docker compose run --rm tama npm run db:create-admin-user
```

Tama is now at `http://localhost:3000`.

## Deploy

- **Docker Compose:** [docker-compose.yml](docker-compose.yml) is commented
  option by option. Back up with [docker-backup.sh](docker-backup.sh).
- **Kubernetes:** the Helm chart in [charts/tama](charts/tama).
- **A home server behind Cloudflare Tunnel**, with auto-deploy from GitHub:
  [deploy/SETUP.md](deploy/SETUP.md).
- **Upgrading an install from before the rename:** [docs/migrating-from-planka.md](docs/migrating-from-planka.md).

## Development

```sh
docker compose -f docker-compose-dev.yml up
```

The client runs at `http://localhost:3000` and the server at
`http://localhost:1337`, both reloading on change. To run without Docker, copy
`server/.env.sample` to `server/.env`, point `DATABASE_URL` at a PostgreSQL
database, then run `npm install`, `npm run server:db:init` and `npm start`.

## Contributing

Bug reports, ideas and pull requests are welcome. Read the
[contributing guide](CONTRIBUTING.md) first.

Please report security issues privately, as described in [SECURITY.md](SECURITY.md).

## License

Tama is a fork of PLANKA and is distributed under the same terms: the
[PLANKA Community License](LICENSE.md) (a "fair-code" Fair Use License). It is
source-available rather than open source in the OSI sense. In short:

- **You may** use, copy, fork and modify it for personal use, inside your own
  organization, for friends and family, for non-profit organizations, and for
  education and research.
- **You may not** run it as a hosted service for third parties for any
  commercial gain, or remove the license and copyright notices.

Read [LICENSE.md](LICENSE.md) for the full terms.

## Credits

Tama is built on [PLANKA](https://github.com/plankanban/planka) by PLANKA
Software GmbH and its contributors. Tama is an independent project and is not
affiliated with or endorsed by PLANKA Software GmbH. PLANKA is their trademark.
