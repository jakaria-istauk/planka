# Self-hosted deploy setup

Instructions for setting up this PLANKA fork on a Linux PC behind a Cloudflare
Tunnel, with auto-deploy on every push to `master` that passes CI. Written so
it can be handed to Claude Code on that PC: "Follow deploy/SETUP.md".

## How it works

1. A push or merged PR to `master` runs the **Build and Test** workflow.
2. When it passes, the **Deploy** workflow (`.github/workflows/deploy.yml`)
   sends an HMAC-SHA256 signed `POST` to `https://<deploy-host>/deploy`.
3. Cloudflare Tunnel forwards it to `deploy/webhook-server.js` on
   `127.0.0.1:9000`.
4. The receiver checks the signature and runs `deploy/deploy.sh <sha>`, which
   fast-forwards `master` to that commit and rebuilds the `planka` container.

## Values to collect first

Ask the user for these before changing anything. Do not guess them.

| Value | Example |
| --- | --- |
| PLANKA public hostname | `planka.oorol.com` |
| Deploy webhook hostname | `deploy.oorol.com` |
| Cloudflare tunnel name, and whether it is managed in the dashboard or by a local `config.yml` | `home-pc`, dashboard |
| Repository URL | `https://github.com/jakaria-istauk/planka.git` |
| PLANKA admin email, username and display name | `you@example.com`, `admin`, `Admin` |

## Rules for the agent

- Confirm with the user before any `sudo` command that creates users, writes
  under `/etc` or `/opt`, or changes the Cloudflare tunnel.
- Never print, log or commit `SECRET_KEY`, `DEPLOY_WEBHOOK_SECRET` or the
  admin password. Hand the admin password to the user once, at the end.
- Stop and ask if a check fails, a port is already taken, or the tunnel
  config does not look like what this guide describes.

## 1. Check prerequisites

```sh
uname -a
docker --version && docker compose version   # Compose v2.24+ (for !override)
git --version
node --version                               # Node 18+ for the receiver
cloudflared --version
cloudflared tunnel list
ss -ltnp | grep -E ':(3000|9000)\b' || echo "ports free"
```

Install anything missing with the distro package manager after asking the user.

## 2. Create the deploy user

A dedicated system user owns the checkout and runs the receiver, so a webhook
bug cannot touch the user's own files.

```sh
sudo useradd --system --create-home --home-dir /var/lib/planka-deploy \
  --shell /usr/sbin/nologin planka-deploy
sudo usermod -aG docker planka-deploy
```

Tell the user: membership in the `docker` group is root-equivalent on this
machine. That is what lets the receiver rebuild containers.

## 3. Clone the repository

```sh
sudo mkdir -p /opt/planka
sudo chown planka-deploy:planka-deploy /opt/planka
sudo -u planka-deploy git clone <repository-url> /opt/planka
sudo -u planka-deploy git -C /opt/planka checkout master
```

For a private repository, create a read-only deploy key for `planka-deploy`
instead and add it under the repository's Settings → Deploy keys.

## 4. Configure PLANKA

Generate the app secret:

```sh
openssl rand -hex 64
```

Create `/opt/planka/docker-compose.override.yml` (gitignored, so pulls never
touch it), owned by `planka-deploy`, mode `600`:

```yaml
services:
  planka:
    image: planka-local
    build: .
    restart: unless-stopped
    # Reachable only through the tunnel, not from the LAN
    ports: !override
      - 127.0.0.1:3000:1337
    environment:
      - BASE_URL=https://<planka-hostname>
      - SECRET_KEY=<generated secret>

  postgres:
    restart: unless-stopped
```

`build: .` builds this fork instead of pulling the upstream image.
`BASE_URL` must match the public URL exactly, or login and live updates break.

## 5. First build

```sh
cd /opt/planka
sudo -u planka-deploy docker compose up -d --build --wait
sudo -u planka-deploy docker compose ps
curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/   # expect 200
```

## 6. Create the PLANKA admin user

Self-registration is off, so the first account has to be created here:

```sh
cd /opt/planka
sudo -u planka-deploy docker compose run --rm planka npm run db:create-admin-user
```

It prompts for email, password, name and username. Generate a strong password
(`openssl rand -base64 24`), enter the user's values, and give the password to
the user at the end. Further users are added from the PLANKA UI by this admin.

## 7. Run the webhook receiver

Generate the webhook secret and store it root-readable only:

```sh
sudo install -m 600 -o root -g root /dev/null /etc/planka-deploy.env
echo "DEPLOY_WEBHOOK_SECRET=$(openssl rand -hex 32)" | sudo tee /etc/planka-deploy.env >/dev/null
```

Create `/etc/systemd/system/planka-deploy-webhook.service`:

```ini
[Unit]
Description=PLANKA deploy webhook receiver
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=planka-deploy
Group=planka-deploy
EnvironmentFile=/etc/planka-deploy.env
Environment=PORT=9000
WorkingDirectory=/opt/planka
ExecStart=/usr/bin/env node /opt/planka/deploy/webhook-server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now planka-deploy-webhook
systemctl status planka-deploy-webhook --no-pager
```

## 8. Add the tunnel routes

Add two public hostnames to the existing tunnel, above any catch-all rule:

| Hostname | Service |
| --- | --- |
| `<planka-hostname>` | `http://localhost:3000` |
| `<deploy-hostname>` | `http://localhost:9000` |

- **Dashboard-managed tunnel:** the user adds these in Cloudflare Zero Trust →
  Networks → Tunnels → the tunnel → Public Hostname. Give them the table above.
- **Local `config.yml`:** add the two `ingress` entries, then run
  `cloudflared tunnel route dns <tunnel> <hostname>` for each and restart
  `cloudflared`.

Check from outside: `https://<planka-hostname>` shows the PLANKA login page.

## 9. Connect GitHub

Add two Actions secrets to the repository. With an authenticated `gh`:

```sh
gh secret set DEPLOY_WEBHOOK_URL --repo <owner/repo> --body "https://<deploy-hostname>/deploy"
sudo grep -oP '(?<=DEPLOY_WEBHOOK_SECRET=).*' /etc/planka-deploy.env \
  | gh secret set DEPLOY_WEBHOOK_SECRET --repo <owner/repo>
```

Without `gh`, the user adds them in the repository's Settings → Secrets and
variables → Actions.

GitHub turns Actions off on forks by default. The user enables them in the
repository's Actions tab.

## 10. Verify the whole chain

1. A bad signature must be refused:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<deploy-hostname>/deploy \
     -H 'X-Hub-Signature-256: sha256=bad' -d '{}'          # expect 401
   ```
2. Trigger a real run, e.g. re-run the latest **Build and Test** run on
   `master` (`gh run rerun <run-id>`) or push a commit.
3. Watch it land:
   ```sh
   journalctl -u planka-deploy-webhook -f
   ```
   Expect `Deploying <sha>` then `Deployed <sha>`, and the **Deploy** workflow
   green in GitHub.

## Operations

- **Logs:** `journalctl -u planka-deploy-webhook`,
  `docker compose -f /opt/planka/docker-compose.yml logs planka`
- **Manual deploy:** `sudo -u planka-deploy /opt/planka/deploy/deploy.sh $(git -C /opt/planka rev-parse origin/master)`
- **Backups:** attachments live in the `data` volume and the database in
  `db-data`. Back up both, for example a nightly
  `docker compose exec -T postgres pg_dump -U postgres planka` to a file plus
  a tar of the `data` volume.
- **Limits:** the site is down whenever the PC is off or asleep, and
  Cloudflare's free plan caps uploads at 100 MB.
