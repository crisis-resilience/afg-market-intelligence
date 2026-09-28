# Production deployment — single VM

How the AFG Market Diversification Tool gets from a push on `main` to a running
production site, and what you have to set up once for that to work.

Nothing here is automatic on a fresh VM. Sections 1–7 are one-time setup;
after that, every push to `main` deploys itself.

---

## 1. How a deploy works

```
push to main
   │
   ├─ Test & Lint (Python)      ruff + pytest, incl. the Postgres-backed suites
   ├─ Verify dependency locks   pip-compile diff — requirements.txt can't drift
   ├─ Lint & Build (frontend)   eslint + next build (TypeScript check)
   │
   ├─ Build & publish images    both images → ghcr.io, tagged sha-<40-char SHA>
   │                            + asserts no .env/.git/secret is in the image
   │
   ├─ Integration (Docker)      runs the REAL images against real Postgres:
   │                            migrations forward, twice, and in reverse;
   │                            /health both ways; /api/products; compose lint
   │
   └─ Deploy to VM              ssh <user>@<host> "<SHA>"  →  deploy/vm/deploy.sh
                                pulls both images, migrates, health-checks,
                                rolls back automatically on failure
```

Two properties are worth stating outright, because most of the design follows
from them:

**Production runs the artifact CI tested.** The VM never builds. It pulls the
images tagged with the exact commit SHA that passed every job above. A rebuild
on the VM would produce a *third* image — different base layer, different
dependency resolution, built on a different day — so the thing that passed CI
would never be the thing serving traffic.

**The deploy key can only deploy.** It is pinned server-side to
`deploy/vm/deploy.sh` by an SSH forced command, and the only input it accepts is
a 40-character commit SHA that must be an ancestor of `origin/main`. If that key
leaks, it cannot open a shell, read the database, or deploy an arbitrary commit.

---

## 2. What you need

| Thing | Notes |
|---|---|
| A Linux VM | 2 vCPU / 4 GB RAM minimum. The ETL is the memory-hungry part, not the API. |
| Docker Engine + Compose v2 | `docker compose version` must report v2.x |
| A public IP and domain | Production requires a domain pointed at the VM — see §5 on HTTPS |
| Ports 80 and 443 open | Nothing else needs to be reachable. **Not 5432.** |
| A GitHub account with push access | To set the repository variables and secrets in §6 |

---

## 3. First-time VM setup

```bash
# On the VM, as your admin user (not root)
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin git
sudo apt-get install -y unattended-upgrades
sudo usermod -aG docker "$USER"
newgrp docker   # or log out and back in

git clone https://github.com/crisis-resilience/afg-market-intelligence.git ~/afg-market-intelligence
cd ~/afg-market-intelligence
```

The deploy script defaults to `/home/azureuser/afg-market-intelligence`. If your
user is not `azureuser`, either clone to that path or set `AFG_MARKET_DIR` in
the forced command (§6).

---

## 4. The production `.env`

`docker-compose.prod.yml` reads this and **fails loudly** if a required value is
missing, rather than starting with a silent default.

```bash
cd ~/afg-market-intelligence
cp .env.example .env
chmod 600 .env      # it holds the database password and the Comtrade key
```

Fill in:

```bash
# Generate URL-safe credentials with: openssl rand -hex 32
POSTGRES_PASSWORD=<a long random string>

# Must match POSTGRES_PASSWORD above. Host is `db` — the compose service name,
# not localhost: the API reaches Postgres over the internal compose network.
DATABASE_URL=postgresql://postgres:<same password>@db:5432/afg_market

# Needed by the monthly ETL, which runs from the backend image on this VM.
COMTRADE_API_KEY=<your UN Comtrade key>

# See §5. Use a real domain for HTTPS; ":80" is demo-only.
SITE_ADDRESS=https://afg-market.example.org
```

`BACKEND_IMAGE` and `FRONTEND_IMAGE` are **not** set by hand — `deploy.sh`
writes them into `.env` on every deploy, pinning the commit currently running.

> `.env` is in both `.gitignore` and `.dockerignore`. Keep it that way: before
> the `.dockerignore` existed, this file was being copied into every published
> backend image, API key included.

---

## 5. HTTPS

Caddy handles certificates itself, with no certbot and no renewal cron.

| `SITE_ADDRESS` | Result |
|---|---|
| `https://afg-market.example.org` | Real, auto-renewing Let's Encrypt certificate |
| `:80` | Rejected by the production Compose configuration |

Let's Encrypt cannot issue certificates for a bare IP address. The production
Compose file deliberately requires `SITE_ADDRESS`, so point a domain at the VM
before deploying. For a short-lived HTTP-only demo, use the development stack,
not `docker-compose.prod.yml`.

Point an `A` record at the VM **before** the first deploy. Caddy attempts
issuance on startup, and repeated failures against a domain that doesn't resolve
yet will hit Let's Encrypt's rate limits.

When you set a domain, set the `SITE_URL` repository variable to the same URL —
CI's post-deploy probe uses it, and falls back to `http://<VM_HOST>`, which stops
working the moment Caddy starts redirecting HTTP to HTTPS.

---

## 6. Deploy keys and GitHub configuration

Two separate keys, each pinned to one script. The ETL key cannot change what is
deployed; the deploy key cannot run the ETL.

### On the VM

```bash
# Install the two scripts from the repo
sudo install -m 755 ~/afg-market-intelligence/deploy/vm/deploy.sh   /usr/local/bin/afg-market-deploy
sudo install -m 755 ~/afg-market-intelligence/deploy/vm/run-etl.sh  /usr/local/bin/afg-market-etl
sudo install -m 755 ~/afg-market-intelligence/deploy/vm/backup-db.sh /usr/local/bin/afg-market-backup
sudo install -m 755 ~/afg-market-intelligence/deploy/vm/verify-backup.sh /usr/local/bin/afg-market-verify-backup

# Generate the two keypairs (no passphrase — CI cannot type one)
ssh-keygen -t ed25519 -f ~/.ssh/afg_deploy_key -N "" -C "github-actions-deploy"
ssh-keygen -t ed25519 -f ~/.ssh/afg_etl_key    -N "" -C "github-actions-etl"
```

Add both public keys to `~/.ssh/authorized_keys`, each with a forced command.
The options after `command=` are what make a leaked key useless for anything
else:

```
command="/usr/local/bin/afg-market-deploy",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding ssh-ed25519 AAAA...deploy-key... github-actions-deploy
command="/usr/local/bin/afg-market-etl",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding ssh-ed25519 AAAA...etl-key... github-actions-etl
```

Then capture the host key fingerprint — CI pins it, so it will not connect to
whatever happens to answer on that IP:

```bash
ssh-keyscan -t ed25519 <VM_PUBLIC_IP>
```

### In GitHub

**Settings → Secrets and variables → Actions → Variables:**

| Variable | Value |
|---|---|
| `VM_HOST` | The VM's public IP or hostname |
| `VM_USER` | The Linux user owning the clone (e.g. `azureuser`) |
| `VM_SSH_KNOWN_HOSTS` | The full `ssh-keyscan` output line from above |
| `SITE_URL` | Your public URL, e.g. `https://afg-market.example.org` |

**Settings → Secrets and variables → Actions → Secrets:**

| Secret | Value |
|---|---|
| `VM_SSH_PRIVATE_KEY` | Contents of `~/.ssh/afg_deploy_key` (the **private** half) |
| `VM_ETL_SSH_PRIVATE_KEY` | Contents of `~/.ssh/afg_etl_key` (the **private** half) |

Copy the private keys off the VM and then delete them there — the VM only needs
the public halves in `authorized_keys`.

`COMTRADE_API_KEY` is no longer a GitHub secret. The ETL runs on the VM now and
reads it from the VM's `.env`.

**Settings → Environments → `production`** — create it. This is where you add a
required-reviewer gate if you later want deploys to pause for approval.

---

## 7. Registry access

Images are published to `ghcr.io/crisis-resilience/afg-market-intelligence/{backend,frontend}`.

If the repository is **public**, the packages are public and the VM can pull
with no credentials — nothing to do.

If it is **private**, the VM needs read access once:

```bash
# On the VM, with a classic PAT that has read:packages
echo "<PAT>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

---

## 8. The first deploy

Everything above is set up, so:

```bash
git commit --allow-empty -m "Trigger first production deploy"
git push origin main
```

Watch it in the Actions tab. The deploy job SSHes in, `deploy.sh` pulls both
images, runs migrations, health-checks from inside the VM, and CI then probes
the site from outside.

**On the very first deploy there is nothing to roll back to.** If it fails, the
script says so and stops rather than pretending it recovered. Read
`docker compose -f docker-compose.prod.yml logs` on the VM.

---

## 9. Operating it

```bash
cd ~/afg-market-intelligence

# What's running, and which commit
docker compose -f docker-compose.prod.yml ps
grep IMAGE .env

# Logs (add -f to follow)
docker compose -f docker-compose.prod.yml logs --tail 100
docker compose -f docker-compose.prod.yml logs backend

# The database — reachable only from inside, by design
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d afg_market
```

**Run the ETL by hand:** Actions → *Monthly ETL* → *Run workflow*. Leave the
products field blank for a full run, or pass a comma-separated list:
`Saffron,Dried Grapes (Raisins)`. It otherwise runs on the 1st of each month at
02:00 UTC, and opens a GitHub issue if it fails.

**Roll back to an earlier commit:** re-run the *Deploy to VM* job from that
commit's successful pipeline. Both images for it are still in the registry —
the SHA tag never moves. Avoid rolling back across a migration; the schema
moves forward, and the older code may not understand it.

---

## 10. Security posture

What is deliberately true about this setup:

- **Postgres publishes no port.** It is reachable only on the internal compose
  network. This is the whole reason the ETL moved onto the VM: keeping it on
  GitHub-hosted runners would have meant allowlisting GitHub's runner IP ranges,
  which are large and change constantly.
- **Only 80 and 443 are public**, both terminated by Caddy.
- **Both containers run as unprivileged users** (uid 1001), and `/app` stays
  root-owned, so the web process cannot rewrite the code it is running.
- **The deploy key cannot open a shell**, and can only deploy a commit already
  on `origin/main`.
- **No secrets in images.** CI actively proves this each build: it writes a
  canary `.env`, builds, and fails if the file or its contents appear anywhere
  in the resulting layers.
- **CORS defaults to restrictive.** `backend/main.py` reads `CORS_ORIGINS` and
  falls back to `http://localhost:3000`, not `*`. Caddy serves the API and UI
  from one origin, so production normally needs no cross-origin allowance at all.

- **API docs are disabled by default** in production. Set
  `API_DOCS_ENABLED=true` only if publishing `/docs` and `/openapi.json` is
  intentional.
- **Backend, migration, and frontend containers have read-only filesystems**,
  no added Linux capabilities, and `no-new-privileges`. Container JSON logs
  rotate instead of consuming the VM disk without limit.

Azure controls remain outside this repository. Before launch:

- Configure the Network Security Group to allow 80/443 from the internet and
  22 only from named administrator or VPN source IPs. Do not add 5432.
- Disable SSH password authentication after verifying key access in a second
  session. Do not lock out the only administrative path.
- Enable unattended security updates and Azure Monitor alerts for VM
  availability, disk use, memory pressure, and `/health`.

---

## 11. Automated database backups to Azure Blob

`deploy/vm/backup-db.sh` creates a PostgreSQL custom-format archive, proves that
`pg_restore` can read it, writes a SHA-256 checksum, and uploads both files with
AzCopy. Authentication uses the VM's system-assigned managed identity; no
storage key or SAS token is stored on disk.

Create a private Storage account/container, enable the VM identity, and grant
that identity `Storage Blob Data Contributor` on only the backup account or
container. Example Azure CLI commands (run from an authenticated admin shell):

```bash
az vm identity assign --resource-group <resource-group> --name <vm-name>
VM_PRINCIPAL_ID="$(az vm show --resource-group <resource-group> --name <vm-name> \
  --query identity.principalId -o tsv)"
STORAGE_ID="$(az storage account show --resource-group <resource-group> \
  --name <storage-account> --query id -o tsv)"
az role assignment create --assignee-object-id "$VM_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$STORAGE_ID"
az storage container create --account-name <storage-account> \
  --name afg-market-backups --auth-mode login
```

Install AzCopy using Microsoft's current package instructions, then install and
enable the timer:

```bash
sudo install -d -m 700 /etc/afg-market
sudo tee /etc/afg-market/backup.env >/dev/null <<'EOF'
AZURE_STORAGE_CONTAINER_URL=https://<storage-account>.blob.core.windows.net/afg-market-backups
AFG_MARKET_BACKUP_RETENTION_DAYS=7
EOF
sudo chmod 600 /etc/afg-market/backup.env

sudo install -m 755 deploy/vm/backup-db.sh /usr/local/bin/afg-market-backup
sudo install -m 755 deploy/vm/verify-backup.sh /usr/local/bin/afg-market-verify-backup
sudo install -m 644 deploy/vm/afg-market-backup.service /etc/systemd/system/
sudo install -m 644 deploy/vm/afg-market-backup.timer /etc/systemd/system/
# If the VM user/path differs from azureuser, edit the service before enabling.
sudo systemctl daemon-reload
sudo systemctl enable --now afg-market-backup.timer
sudo systemctl start afg-market-backup.service
sudo journalctl -u afg-market-backup.service --no-pager
```

The timer runs nightly at 01:15 UTC. Configure Azure Blob lifecycle management
for the required remote retention (recommended: at least 35 daily copies plus
monthly archive tiers). `AFG_MARKET_BACKUP_RETENTION_DAYS` affects only the
small local cache, never Blob retention.

Test a real restore after setup and at least quarterly:

```bash
/usr/local/bin/afg-market-verify-backup \
  ~/afg-market-backups/afg-market-YYYYMMDDTHHMMSSZ.dump
```

This restores into an isolated `afg_market_restore_verify` database, checks the
four core tables, then removes the throwaway database. A backup is not proven
until this command succeeds.

---

## 12. First-launch checklist

1. Confirm DNS resolves to the VM and `SITE_ADDRESS` is an HTTPS URL.
2. Confirm the NSG exposes only 80/443 publicly and restricts SSH by source IP.
3. Confirm `.env` is mode 600, has no placeholder values, and is not committed.
4. Deploy the application and run the full ETL before announcing the URL.
5. Verify `/api/products` returns products with `has_data: true`; an empty
   catalogue means the initial ETL has not completed.
6. Run one backup, one isolated restore check, and confirm the archive exists
   in the private Blob container.
7. Configure an external availability check for `/health` and Azure Monitor
   alerts for disk use and VM health.
