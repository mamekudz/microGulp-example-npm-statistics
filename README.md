# npm statistics

Executable Gulp example that fetches npm package download counts, compares equal-length UTC periods, and writes JSON/CSV reports. The same results render as a table and chart in µGulp™ when the dashboard is open.

Public repository: [microGulp-example-npm-statistics](https://github.com/mamekudz/microGulp-example-npm-statistics). Collection: [microGulp-Examples](https://github.com/mamekudz/microGulp-Examples).

<!-- blog-intro:start -->
Der begleitende Artikel ist in Vorbereitung.
<!-- blog-intro:end -->

The introduction above will be replaced from the finished German article source after publication. Planned article URL (not published yet): `https://microgulp.dev/blogs/npm-statistics`.

## Prerequisites (verified locally)

| Tool | Version |
| --- | --- |
| Node.js | ≥ 22 (verified 22.19.0) |
| npm | 10.9.3 |
| gulp (CLI via local install) | ^5.0.1 |
| gulp-mu-gulp-api | ^0.5.0 |

## Setup

```bash
cd npm-statistics
npm install
```

Copy `config.example.json` to `config.json` if you need a fresh config (a starter `config.json` is already present).

### Configuration

`config.json` keys:

- `packages` — npm package names (scoped names supported, e.g. `@babel/core`)
- `period.days` — inclusive UTC day count ending at yesterday UTC by default
- `period.start` / `period.end` — optional explicit inclusive UTC dates (`YYYY-MM-DD`); `end` must be a **completed** UTC day (before today UTC)
- `fetch.timeoutMs` / `retries` / `concurrency` / `retryDelayMs`
- `outputDir` — report folder (default `reports/`, gitignored)
- `mode` — optional `"live"` or `"offline"` (offline is explicit only)

Comparison period: the immediately preceding window of the same inclusive length.

## Commands

```bash
npm test
npx gulp SHOW_CONFIG
npx gulp REPORT_OFFLINE
npx gulp REPORT_LIVE
npx gulp REPORT
npx gulp RUN_TESTS
```

Exit codes: `0` all packages complete and comparable, `2` partial/failed package data, non-zero also for fatal config errors.

Reports land under `reports/` as timestamped `.json` and `.csv`.

## Data source

Official npm download counts API (checked **2026-09-23**):

- Docs: https://github.com/npm/registry/blob/main/docs/download-counts.md
- Range endpoint used: `GET https://api.npmjs.org/downloads/range/{start}:{end}/{package}`
- Point endpoint also exists; this example uses **range** so missing days can be detected
- Timezone: **UTC** calendar days; start/end inclusive
- History from **2015-01-10**; single-package queries limited to ~**18 months**
- Scoped packages work on single-package URLs; **bulk comma lists do not support scoped packages**
- Download counts are not unique users or installs — see npm’s precision blog linked from the docs

Missing days, unknown packages (HTTP 404), timeouts, rate limits (429) and invalid JSON are **never** turned into zero downloads. Percent change is `n/a` when the previous total is missing or when previous is `0` and current is non-zero.

## Offline demo

`REPORT_OFFLINE` / `mode: "offline"` uses synthetic fixtures and labels the report as offline. Live failures do **not** fall back to demo data.

## µGulp™

Open this folder as a workspace (or start it from the µGulp main project **Example Projects** group). Tasks under **Reports** / **Quality** show table, chart and error callouts via `LogTable` / `LogChart` / `LogCallout`. Plain `npx gulp …` keeps ASCII CLI fallbacks from `gulp-mu-gulp-api`.

## License

MIT for original example code — see [LICENSE](LICENSE).

## Interactive website

The shared [examples collection website](https://github.com/mamekudz/microGulp-Examples) adds period selection, comparison charts, daily values and JSON/CSV downloads using this project's original report pipeline. Run `npm install` and `npm start` in the repository root, then open `http://127.0.0.1:9320/npm-statistics/`. Offline fixtures and live npm data are explicitly separated. No private product checkout is required.
