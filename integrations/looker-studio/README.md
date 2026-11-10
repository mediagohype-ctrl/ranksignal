# MyWebRank — Looker Studio connector

A Looker Studio [Community Connector](https://developers.google.com/looker-studio/connector) (Google Apps Script)
that puts MyWebRank numbers into Looker Studio reports, one row per day:

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | Date | Day (UTC) |
| `overall_score`, `seo_score`, `aeo_score`, `geo_score`, `brand_score` | Number (avg) | 0–100, from the latest website check on or before that day |
| `ai_mention_rate`, `ai_citation_rate`, `ai_recommendation_rate` | Percent (avg) | From the latest AI check on or before that day |
| `issues_open` | Number (avg) | Open website issues at the latest check |
| `gsc_clicks`, `gsc_impressions` | Number (sum) | Google Search Console totals for that exact day |
| `gsc_ctr`, `gsc_position` | Percent / Number (avg) | Search Console CTR and average position that day |

Scores are carried forward between checks (a check every week gives a flat line between check days); nothing is
estimated or interpolated. Days before the first check, and Search Console days with no stored data, are empty.
Demo (simulated) AI answers are never included.

The connector calls `GET /api/v1/projects/{id}/looker?from=YYYY-MM-DD&to=YYYY-MM-DD` with the user's API key
(`Authorization: Bearer mwr_…`). See https://mywebrank.tech/docs/api for the API itself.

## Files

- `Code.gs` — the connector (auth type `KEY`, config, schema, data).
- `appsscript.json` — the manifest (V8 runtime, Looker Studio listing details, URL allow-list).

## Deploy (owner, once)

1. Sign in to Google with the account that will own the connector (ideally a shared company account).
2. Open https://script.google.com → **New project**. Name it "MyWebRank Looker Studio connector".
3. **Project Settings** (gear icon) → tick **Show "appsscript.json" manifest file in editor**.
4. Replace the contents of `Code.gs` and `appsscript.json` in the editor with the files from this folder.
   - If the app does not run at `https://mywebrank.tech`, change `API_BASE` at the top of `Code.gs` **and**
     `urlFetchWhitelist` in `appsscript.json` to the app's URL (the value of `APP_URL`), keeping the trailing `/`
     in the allow-list.
5. Save. To try it yourself first: **Deploy → Test deployments**, copy the **Head deployment ID**.
   For the version customers use: **Deploy → New deployment** (if asked for a type, pick **Add-on**), add a
   description such as "v1", **Deploy**, and copy the **Deployment ID**. Create a new deployment (or update this
   one) whenever `Code.gs` changes; the head deployment always runs the latest saved code.
6. The connector's link is:
   `https://lookerstudio.google.com/datasources/create?connectorId=<DEPLOYMENT_ID>`
   Share that link with customers (put it in the docs page and in Settings → API when ready).
7. Optional: to list it in the public Looker Studio connector gallery, submit it for review in the
   [Partner Connector program](https://developers.google.com/looker-studio/connector/pscc-requirements)
   (needs the privacy policy and terms URLs from the manifest to be live).

## Use (customer)

1. In MyWebRank go to **Settings → API** and create a key named e.g. "Looker Studio". Copy it.
2. Open the connector link, authorise it, and paste the key when asked.
3. Pick the website, click **Connect**, then **Create report**.
4. Add a time-series chart with `date` as the dimension and, for example, `overall_score` and `ai_mention_rate`.

Revoking the key in MyWebRank stops the data source at once; edit the data source's credentials to paste a new key.

## Limits and caching

- Each data request counts against the key's API limits (60 a minute per key, and a daily cap per plan).
- The connector caches results for 10 minutes per user, website and date range, so dashboards with many charts
  make one API call.
- Date ranges longer than 366 days are fetched in 366-day pieces.

## Troubleshooting

- **"Your MyWebRank API key is not valid"** — the key was revoked or mistyped; create a new one and update the
  data source credentials.
- **Empty Search Console fields** — connect Google Search Console in MyWebRank (website → Integrations). Data appears
  after the first daily sync.
- **"Exception: You do not have permission to call UrlFetchApp.fetch"** — the URL allow-list in `appsscript.json`
  must match `API_BASE` exactly (including `https://` and the trailing `/`).
