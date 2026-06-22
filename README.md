# 📡 Bounty Radar

Scans web3 platforms for bounties, hackathons, and jobs — dedupes, filters, and
drafts daily threads to Telegram for review. Nothing is auto-published to X.

Built with **NestJS 11 + TypeScript**, Prisma + Postgres, and the Telegram Bot API.

> Follow [@unnamedcodes](https://x.com/unnamedcodes) + 🔔

---

## How it works

```
@Cron scan ─► sources (REST / HTML) ─► persist to Postgres
                                              │
        ┌──────────────────────────────────────┤
        ▼              ▼              ▼        ▼
   Daily drop     Job drop      Closing-soon  Spotlight
   (bounties)     (jobs)        (next 72h)     + stats
        └──────── all drafted to Telegram for review ──────┘
```

The scan only **persists** new bounties. Content services read from the DB on
their own schedules and push ready-to-copy drafts to Telegram.

---

## Sources

| Platform       | Type        | Method            |
|----------------|-------------|-------------------|
| Superteam      | bounties    | REST API          |
| Devpost        | hackathons  | REST API          |
| CryptoJobsList | jobs        | `__NEXT_DATA__`   |
| Sherlock       | audits      | REST (paginated)  |
| Code4rena      | audits      | GitHub API        |
| Superteam      | payouts     | REST API          |

---

## Quick start

```bash
pnpm install
cp .env.example .env        # fill TG_TOKEN, TG_CHAT_ID, DATABASE_URL
pnpm exec prisma db push    # create tables
pnpm run build
pnpm run scan:once          # one-shot scan
pnpm run content:once       # dispatch all content drafts
```

### Telegram setup

Message **@BotFather** → `/newbot` → copy the token into `TG_TOKEN`. Send your
new bot any message, then open
`https://api.telegram.org/bot<TOKEN>/getUpdates` and copy your numeric chat id
into `TG_CHAT_ID`.

---

## Project layout

```
src/
├── main.ts / run-once.ts / content-once.ts
├── app.module.ts
├── domain/                      # Bounty type, reward parsing
├── persistence/                 # Prisma + BountyRepository
├── telegram/                    # sendRaw / sendThread
├── sources/                     # one source per platform
│   ├── superteam.source.ts
│   ├── superteam-payout.source.ts
│   ├── devpost.source.ts
│   ├── cryptojobslist.source.ts
│   ├── sherlock.source.ts
│   └── code4rena.source.ts
├── scout/                       # scan orchestrator
└── content/                     # digest, closing-soon, spotlight, stats, job-drop
prisma/schema.prisma
```

---

## Schedules

All cron strings configurable via env vars.

| Job            | Env var             | Default          |
|----------------|---------------------|------------------|
| Source scan    | `SCAN_CRON`         | `0 0 */6 * * *` |
| Daily drop     | `DROP_CRON`         | `0 0 9 * * *`   |
| Job drop       | `JOB_DROP_CRON`     | `0 0 15 * * *`  |
| Closing-soon   | `CLOSING_SOON_CRON` | `0 0 */6 * * *` |
| Spotlight      | `SPOTLIGHT_CRON`    | `0 0 16 * * 2,5`|
| Monthly stats  | `STATS_CRON`        | `0 0 9 1 * *`   |

---

## Filtering

- **Reward**: `$200 – $200,000` (configurable via `BOUNTY_MIN_USD` / `BOUNTY_MAX_USD`)
- **Age**: bounties with deadline more than 3 months in the past are skipped on persist
- **Dedup**: `sha256(source|normalised_url)` prevents duplicates
- **Drop diversity**: max 2 bounties per source per drop, randomly shuffled
- **Jobs**: excluded from the main bounty drop; delivered in a separate job drop thread

---

## Deployment (Render)

Push to `main` — GitHub Actions builds the Docker image and Render auto-deploys
from the Render Blueprint (`render.yaml`).

The Docker `CMD` runs `prisma db push && node dist/main.js`, so schema stays in
sync on every deploy.

For one-off scans in production:
```bash
pnpm scan:once    # manual scan
pnpm content:once # dispatch all content
```

---

## Environment

| Variable          | Required | Description                          |
|-------------------|----------|--------------------------------------|
| `DATABASE_URL`    | ✅       | Postgres connection string           |
| `TG_TOKEN`        | ✅       | Telegram bot token                   |
| `TG_CHAT_ID`      | ✅       | Telegram chat id for drafts          |
| `X_HANDLE`        |          | X/Twitter handle (default @unnamedcodes) |
| `BOUNTY_MIN_USD`  |          | Min reward for drops (default 200)   |
| `BOUNTY_MAX_USD`  |          | Max reward for drops (default 200000)|
| `BOUNTY_MAX_AGE_DAYS` |       | Max bounty age (default 180)         |
