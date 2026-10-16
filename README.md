# Brown News

**Protecting America's Underwear, One Recall at a Time.**

Brown News tracks Cyclospora in two ways: a **News** tab pulling the latest
news coverage of Cyclospora outbreaks (via [NewsAPI.org](https://newsapi.org)),
and an **FDA Data** tab aggregating publicly available FDA food enforcement
(recall) records (via [openFDA](https://open.fda.gov/apis/food/enforcement/)),
both presented in a plain-English, "what to avoid" format. Recall cards also
show the recalling firm's logo, fetched server-side via
[logo.dev](https://logo.dev) so the API token never reaches the browser.

## Disclaimer

This site aggregates publicly available FDA records for informational purposes
only. It is **not** an official recall alert system and should not be used to
track a recall's lifecycle. It is **not medical advice**. Data is sourced from
[openFDA](https://open.fda.gov/apis/food/enforcement/) and may be incomplete or
delayed — always confirm against the
[official FDA recall record](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts).
Consult a healthcare provider for medical concerns.

## Stack

Node.js 20+ (ESM), Express, Postgres (`pg`, no ORM), `node-cron`, `dotenv`.
Vanilla HTML/CSS/JS frontend, no build step.

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` — your Postgres (e.g. Neon) connection string.
   - `OPENFDA_API_KEY` — optional; raises openFDA rate limits. Get one free at
     [open.fda.gov](https://open.fda.gov/apis/authentication/).
   - `LOGO_DEV_TOKEN` — optional; a [logo.dev](https://logo.dev) API token used
     server-side to show recalling-firm logos on recall cards. Recall cards
     work fine without it (logos are simply omitted).
   - `NEWSAPI_KEY` — a [NewsAPI.org](https://newsapi.org) API key used
     server-side to power the News tab. Without it, the news poller logs an
     error and is skipped; the rest of the site works fine.
3. Apply the database schema:
   ```bash
   npm run migrate
   ```
4. Seed the database with an initial poll:
   ```bash
   npm run poll
   ```
5. Seed the news feed:
   ```bash
   npm run poll-news
   ```
   The very first run backfills from July 14, 2026 (60 articles); every run
   after that only fetches that day's articles (30/day) since the table is
   no longer empty.
6. Start the app:
   ```bash
   npm run dev    # local development, auto-restarts on file changes
   npm start       # production
   ```

## API

- `GET /health` — `{ "ok": true }`
- `GET /api/recalls` — list of recalls, newest first. Filters: `?state=`, `?status=`, `?since=YYYY-MM-DD`, `?limit=`.
- `GET /api/recalls/:recall_number` — a single recall record, including the full raw openFDA payload.
- `GET /api/stats` — counts by classification and state, total count, most recent date.
- `GET /api/news` — paginated list of news articles, newest first, 30 per page. `?page=` (default 1). Response includes a `pagination` object (`page`, `pageSize`, `total`, `totalPages`).
- `GET /api/logo?firm=` — proxies a firm's logo from logo.dev (used by the frontend, not meant for direct browsing). If a firm gets the wrong logo, add its exact firm name and company domain to `config/logo-domains.json` to look it up by domain instead of by name.

## Tests

```bash
npm test
```

Runs smoke tests covering the trickiest behaviors: treating an openFDA 404 as
an empty result set (not an error), idempotent upserts keyed on
`recall_number`, NewsAPI error handling, Biztoc.com source filtering, and
idempotent upserts keyed on `url`.

## License

MIT — see [LICENSE](./LICENSE).
