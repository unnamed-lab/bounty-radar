# 📡 Bounty Radar

Scans web3 chains for bounties & hackathons, dedupes them, and **drafts daily
posts to your Telegram for review** — a daily drop thread, closing-soon alerts,
winner spotlights, and monthly payout stats. You review each draft and post it
to X manually. Nothing is auto-published.

Built with **NestJS 11 + TypeScript**, Prisma (SQLite → Postgres), Playwright,
and the Telegram Bot API.

> I'm building Bounty Radar — a side project that scans every chain to find the
> best opportunities and surface them consistently, tailored for web3 builders.
> Follow [@unnamedcodes](https://x.com/unnamedcodes) + turn on notifications.

---

## How it works

```
@Cron scan ─► sources (JSON + Playwright) ─► persist to DB (Bounty / Payout)
                                                      │
        ┌─────────────────────────────────────────────┤
        ▼                ▼                ▼            ▼
   Daily drop      Closing-soon       Spotlight      Monthly
   (thread)        (next 72h)         (winners)      stats
        └──────────────── all drafted to Telegram for review ───────────────┘
```

The scan only **persists** to the database; it never posts. The content services
read from the database on their own schedules and push ready-to-copy drafts to
Telegram. This makes the daily drop a *curation* step rather than a firehose.

---

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Install the Chromium browser for Playwright (needs internet)
npx playwright install chromium

# 3. Configure
cp .env.example .env       # fill TG_TOKEN, TG_CHAT_ID, X_HANDLE, TG_CHANNEL

# 4. Generate the Prisma client + create the DB
npx prisma generate
npx prisma db push

# 5. Build & run the resident worker (schedules fire internally)
npm run build
npm start

# …or run a single scan and exit:
npm run scan:once
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
├── main.ts / run-once.ts        # resident worker / one-shot bootstraps
├── app.module.ts
├── config/                      # env validation
├── domain/                      # Bounty type, reward parsing
├── persistence/                 # Prisma + BountyRepository (dedupe + queries)
├── scraper/                     # shared Playwright browser
├── telegram/                    # draft delivery (sendRaw / sendThread)
├── sources/                     # one module per site + DI registries
│   ├── superteam.source.ts      #   JSON-endpoint template
│   ├── generic-scrape.source.ts #   Playwright template (lazy-load handling)
│   └── generic-payout.source.ts #   winners/payouts template
├── scout/                       # scan orchestrator (@Cron, persists only)
└── content/                     # digest, closing-soon, spotlight, stats, drop
prisma/schema.prisma
```

---

## Adding a real source

1. Copy a template in `src/sources/`:
   - JSON site → `superteam.source.ts` (open DevTools → Network → Fetch/XHR,
     find the listings request, map its fields to `Bounty`).
   - Scrape site → `generic-scrape.source.ts` (set `LISTING_URL` + selectors;
     `scrollUntilStable` handles lazy-load / infinite scroll).
   - Winners → `generic-payout.source.ts`.
2. Add your class to the matching `inject:` array in `sources/sources.module.ts`.

Good targets: Superteam Earn, Layer3, Dework, DoraHacks, Devpost / ETHGlobal
(hackathons), Code4rena & Immunefi (security), Gitcoin, Bountycaster.

---

## Schedules

All cron strings are configurable in `.env` (server timezone — set `TZ`).

| Job            | Env var             | Default          | When               |
|----------------|---------------------|------------------|--------------------|
| Source scan    | `SCAN_CRON`         | `0 0 */6 * * *`  | every 6h           |
| Daily drop     | `DROP_CRON`         | `0 0 9 * * *`    | 09:00 daily        |
| Closing-soon   | `CLOSING_SOON_CRON` | `0 0 */6 * * *`  | every 6h           |
| Spotlight      | `SPOTLIGHT_CRON`    | `0 0 16 * * 2,5` | Tue & Fri 16:00    |
| Monthly stats  | `STATS_CRON`        | `0 0 9 1 * *`    | 1st of month 09:00 |

Set `TZ` to your audience's timezone so the drop lands in their morning.

---

## Deployment

Playwright needs system libraries, so the `Dockerfile` uses the official
Playwright image (browsers preinstalled). Run the container 24/7 as the resident
worker; the internal scheduler drives everything. Mount a volume for the SQLite
file (or switch `DATABASE_URL` to managed Postgres and change the Prisma
`provider`) so dedupe/drop state survives restarts.

For serverless / k8s `CronJob`, set the container command to
`node dist/run-once.js` and use Postgres (no persistent local disk).

---

## Before it does anything useful

- The `superteam.source.ts` endpoint and all scrape selectors are
  **placeholders** showing the shape — replace them with real values from the
  live sites (these change over time).
- Set `X_HANDLE` and `TG_CHANNEL` in `.env`; they appear in the post drafts.
- Scraping some sites is against their ToS. Prefer official APIs/feeds, keep the
  scan interval modest, and identify with one honest User-Agent.

## Notes on versions
Dependency ranges target NestJS 11. If `npm install` reports peer-dependency
conflicts, align them with `npx npm-check-updates -u && npm install`.
