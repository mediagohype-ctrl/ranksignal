/**
 * MyWebRank — Looker Studio Community Connector (Google Apps Script, V8 runtime).
 *
 * Authenticates with a MyWebRank API key (auth type KEY; create one in MyWebRank → Settings → API) and reads
 * GET {API_BASE}/api/v1/projects/{id}/looker?from=YYYY-MM-DD&to=YYYY-MM-DD — one flat row per day:
 * scores (carried forward from the latest check), AI rates, open issues and Google Search Console totals.
 *
 * Deploy steps: see README.md in this folder.
 */

/** Where the MyWebRank app runs. Change it (and urlFetchWhitelist in appsscript.json) for staging/self-hosting. */
var API_BASE = 'https://mywebrank.tech';
var KEY_PROPERTY = 'mywebrank.apiKey';
var MAX_DAYS_PER_REQUEST = 366;
var CACHE_SECONDS = 600;

var cc = DataStudioApp.createCommunityConnector();

// ---------------------------------------------------------------------------------------------
// Auth (KEY)

function getAuthType() {
  return cc
    .newAuthTypeResponse()
    .setAuthType(cc.AuthType.KEY)
    .setHelpUrl(API_BASE + '/docs/api#api-keys')
    .build();
}

function getStoredKey_() {
  return PropertiesService.getUserProperties().getProperty(KEY_PROPERTY);
}

function isAuthValid() {
  var key = getStoredKey_();
  return typeof key === 'string' && /^mwr_[A-Za-z0-9_-]{43}$/.test(key);
}

function resetAuth() {
  PropertiesService.getUserProperties().deleteProperty(KEY_PROPERTY);
}

/** Called by Looker Studio with { key: '…' }. The key is checked against the API before it is saved. */
function setCredentials(request) {
  var key = request && request.key ? String(request.key).trim() : '';
  if (!/^mwr_[A-Za-z0-9_-]{43}$/.test(key)) return { errorCode: 'INVALID_CREDENTIALS' };
  var res = UrlFetchApp.fetch(API_BASE + '/api/v1/projects?limit=1', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return { errorCode: 'INVALID_CREDENTIALS' };
  PropertiesService.getUserProperties().setProperty(KEY_PROPERTY, key);
  return { errorCode: 'NONE' };
}

function isAdminUser() {
  return false;
}

// ---------------------------------------------------------------------------------------------
// HTTP

function apiGet_(path) {
  var res = UrlFetchApp.fetch(API_BASE + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + getStoredKey_(), Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body;
  try {
    body = JSON.parse(res.getContentText());
  } catch (e) {
    body = null;
  }
  if (code === 200 && body) return body;
  var message = body && body.error && body.error.message ? body.error.message : 'HTTP ' + code;
  var userText =
    code === 401
      ? 'Your MyWebRank API key is not valid or was revoked. Edit the data source credentials and paste a new key.'
      : code === 404
        ? 'That MyWebRank website was not found for this API key.'
        : code === 429
          ? 'MyWebRank API limit reached. Try again in a little while.'
          : 'MyWebRank could not return data: ' + message;
  cc.newUserError().setDebugText('GET ' + path + ' → ' + code + ': ' + message).setText(userText).throwException();
}

// ---------------------------------------------------------------------------------------------
// Config

function getConfig(request) {
  var config = cc.getConfig();
  config
    .newInfo()
    .setId('intro')
    .setText('Pick the website to report on. Scores and AI rates show the latest check on or before each day; Search Console columns are empty until Search Console is connected in MyWebRank.');

  var select = config.newSelectSingle().setId('projectId').setName('Website').setHelpText('Websites in your MyWebRank workspace');
  var cursor = null;
  var pages = 0;
  do {
    var page = apiGet_('/api/v1/projects?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    (page.data || []).forEach(function (p) {
      select.addOption(config.newOptionBuilder().setLabel(p.name + ' (' + p.websiteUrl + ')').setValue(p.id));
    });
    cursor = page.meta && page.meta.nextCursor;
    pages++;
  } while (cursor && pages < 10);

  config.setDateRangeRequired(true);
  return config.build();
}

// ---------------------------------------------------------------------------------------------
// Schema

function getFields_() {
  var fields = cc.getFields();
  var t = cc.FieldType;
  var agg = cc.AggregationType;

  fields.newDimension().setId('date').setName('Date').setDescription('Day (UTC)').setType(t.YEAR_MONTH_DAY);

  function metric(id, name, type, aggregation, description) {
    fields.newMetric().setId(id).setName(name).setDescription(description).setType(type).setAggregation(aggregation);
  }
  metric('overall_score', 'Overall score', t.NUMBER, agg.AVG, '0–100, latest website check on or before the day');
  metric('seo_score', 'SEO score', t.NUMBER, agg.AVG, '0–100');
  metric('aeo_score', 'AEO score', t.NUMBER, agg.AVG, '0–100');
  metric('geo_score', 'GEO score', t.NUMBER, agg.AVG, '0–100');
  metric('brand_score', 'Brand score', t.NUMBER, agg.AVG, '0–100');
  metric('ai_mention_rate', 'AI mention rate', t.PERCENT, agg.AVG, 'Share of AI answers that named the business');
  metric('ai_citation_rate', 'AI citation rate', t.PERCENT, agg.AVG, 'Share of AI answers that linked the website');
  metric('ai_recommendation_rate', 'AI recommendation rate', t.PERCENT, agg.AVG, 'Share of AI answers that recommended the business');
  metric('issues_open', 'Open issues', t.NUMBER, agg.AVG, 'Open website issues at the latest check');
  metric('gsc_clicks', 'Search clicks', t.NUMBER, agg.SUM, 'Google Search Console clicks');
  metric('gsc_impressions', 'Search impressions', t.NUMBER, agg.SUM, 'Google Search Console impressions');
  metric('gsc_ctr', 'Search CTR (daily average)', t.PERCENT, agg.AVG, 'Average of daily click-through rates');
  metric('gsc_position', 'Average position', t.NUMBER, agg.AVG, 'Average Google position (lower is better)');
  return fields;
}

function getSchema() {
  return { schema: getFields_().build() };
}

// ---------------------------------------------------------------------------------------------
// Data

function addDays_(ymd, n) {
  var d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fetchRows_(projectId, from, to) {
  var cache = CacheService.getUserCache();
  var cacheKey = ['rows', projectId, from, to].join(':');
  var hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);

  var rows = [];
  var start = from;
  while (start <= to) {
    var end = addDays_(start, MAX_DAYS_PER_REQUEST - 1);
    if (end > to) end = to;
    var body = apiGet_('/api/v1/projects/' + encodeURIComponent(projectId) + '/looker?from=' + start + '&to=' + end);
    rows = rows.concat(body.data || []);
    start = addDays_(end, 1);
  }
  var text = JSON.stringify(rows);
  if (text.length < 90000) cache.put(cacheKey, text, CACHE_SECONDS); // CacheService values are capped at 100 KB
  return rows;
}

function getData(request) {
  var projectId = request.configParams && request.configParams.projectId;
  if (!projectId) cc.newUserError().setText('Choose a website in the data source settings.').throwException();

  var ids = request.fields.map(function (f) {
    return f.name;
  });
  var requested = getFields_().forIds(ids);
  var rows = fetchRows_(projectId, request.dateRange.startDate, request.dateRange.endDate);

  return {
    schema: requested.build(),
    rows: rows.map(function (r) {
      return {
        values: ids.map(function (id) {
          if (id === 'date') return String(r.date).replace(/-/g, '');
          var v = r[id];
          return v === null || v === undefined ? null : v;
        }),
      };
    }),
  };
}
