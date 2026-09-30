# Lab deploy — Cloudflare Workers (`lab` @ `/stage-drop`)

Live target: **https://lab.vovanduc.tech/stage-drop/**

Worker name **`lab`** already has Custom Domain `lab.vovanduc.tech`. Deploying this repo replaces the Hello World stub; do **not** add a second DNS record.

GitHub Pages (`docs/` → https://vovanduc.github.io/stage-drop/) stays separate. This Worker is the upload/claim lab.

## One-time Cloudflare setup

Requires account access (email used for the zone: Vovanduc1989@gmail.com) and Wrangler auth (`npx wrangler login`) **or** an API token with Workers / R2 / KV edit.

```bash
cd stage-drop
npm install

# 1) R2 bucket for site blobs
npx wrangler r2 bucket create stage-drop-blobs

# 2) KV namespace for site meta + claim hashes
npx wrangler kv namespace create META
# → copy the id into wrangler.jsonc → kv_namespaces[0].id

# 3) Deploy (uses existing Worker name "lab" + Custom Domain)
npx wrangler deploy
```

Dashboard alternative: Workers & Pages → Create R2 bucket `stage-drop-blobs`, create KV namespace, paste id into `wrangler.jsonc`, then **Workers → lab → Deploy** / `wrangler deploy`.

## GitHub Actions secrets (optional CI)

Workflow: `.github/workflows/deploy-lab.yml` (runs on `master` when `src/`, `public/`, or `wrangler.jsonc` change — **not** when only `docs/` changes).

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers Scripts Edit, Account R2 Edit, Workers KV Storage Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id (Dashboard URL / Overview) |

Do **not** commit token or account id.

## Verify

- https://lab.vovanduc.tech/stage-drop/
- https://lab.vovanduc.tech/stage-drop/health → `{"ok":true}`
- https://lab.vovanduc.tech/ → lab hub JSON pointing at `/stage-drop/`

## Notes

- **TTL** 60 minutes; claim token is one-shot (hash only in KV).
- **Rate limit** is in-memory per isolate — fine for lab demos; resets on new isolates.
- **Cron** `*/5 * * * *` sweeps expired unclaimed sites (R2 + KV).
- Zip path uses **fflate** (Workers-safe). Local Node `npm run dev` still uses FS + memory adapters.
