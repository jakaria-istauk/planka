# Migrating an install from the PLANKA name

This project was renamed from PLANKA to Tama. A new install needs nothing from
this guide. An install set up before the rename does, because the Docker
service, the default database and a few defaults changed name:

| What | Before | After |
| --- | --- | --- |
| Compose service | `planka` | `tama` |
| Default database | `planka` | `tama` |
| Default log file | `logs/planka.log` | `logs/tama.log` |
| Helm chart | `charts/planka` | `charts/tama` |

What carries over on its own:

- **Volumes.** Compose names volumes after the project, which is the checkout
  directory, not the service. A checkout that stays where it is keeps using
  its `data` and `db-data` volumes.
- **Browser data.** Saved filters, description drafts, the theme and the labels
  view move to their new keys on the first page load.
- **Two-factor trusted devices** stay trusted.
- **MCP clients** that registered the server as `planka` keep working; the name
  is only a label on the client side.

What users notice: the terms of use were rewritten, so everyone accepts them
once at their next sign-in.

## Docker Compose

Run these in the checkout directory. Steps 2 to 5 take the app offline until
step 6 finishes.

1. **Back up** the database and the uploads:

   ```sh
   docker compose exec -T postgres pg_dump -U postgres planka > planka-backup.sql
   docker run --rm --volumes-from "$(docker compose ps -q planka)" -v "$PWD:/backup" \
     node:24-alpine tar czf /backup/planka-data.tar.gz -C /app data
   ```

2. **Stop the app**, leaving PostgreSQL running:

   ```sh
   docker compose stop planka
   ```

3. **Rename the database:**

   ```sh
   docker compose exec postgres psql -U postgres -c 'ALTER DATABASE planka RENAME TO tama;'
   ```

4. **Update your own overrides.** In `docker-compose.override.yml`, `.env` or
   wherever you set them:
   - rename the `planka:` service key to `tama:`;
   - change a `DATABASE_URL` ending in `/planka` to `/tama`;
   - set `LOG_FILE` to the old path if something reads `logs/planka.log`.

5. **Pull the rename:**

   ```sh
   git pull
   ```

6. **Start it** and remove the old container:

   ```sh
   docker compose up -d --build --wait --remove-orphans
   docker compose logs tama
   ```

If you move the checkout to a directory with a different name (for example
from `/opt/planka` to `/opt/tama`), Compose starts with new, empty volumes. Keep
the old ones by adding `name: planka` at the top of
`docker-compose.override.yml`.

### Rolling back

```sh
docker compose stop tama
docker compose exec postgres psql -U postgres -c 'ALTER DATABASE tama RENAME TO planka;'
git checkout <commit before the rename>
# undo the override changes from step 4
docker compose up -d --build --wait --remove-orphans
```

## Auto-deploy server (deploy/SETUP.md)

The webhook deploys `master` as soon as the rename is merged, and the new
`deploy.sh` starts the `tama` service. Merge only once the server is ready:

1. Pause auto-deploy: `sudo systemctl stop planka-deploy-webhook`.
2. Merge the rename.
3. On the server, as `planka-deploy` in `/opt/planka`, follow the
   [Docker Compose](#docker-compose) steps. The checkout, the deploy user and
   the systemd unit keep their `planka` names; only the service inside the
   override changes.
4. Resume auto-deploy: `sudo systemctl start planka-deploy-webhook`.

## Helm

The chart's name is part of the resource names and of the Deployment's
selector, which Kubernetes does not allow to change. Upgrade an existing
release with the old names pinned:

```yaml
nameOverride: planka
postgresql:
  auth:
    database: planka
    username: planka
```
