# Brown News

**Protecting America's Underwear, One Recall at a Time.**

Brown News aggregates publicly available FDA food enforcement (recall) records
related to Cyclospora and presents them in a plain-English, "what to avoid"
format.

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
5. Seed today's news feed (optional — only captures *today's* articles; the
   daily cron accumulates history from here):
   ```bash
   npm run poll-news
   ```
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
- `GET /api/news` — list of news articles, newest first. Optional `?limit=`.

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
