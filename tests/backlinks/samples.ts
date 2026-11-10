// Realistic DataForSEO Backlinks API v3 result arrays (tasks[0].result) used by the backlinks tests.
export const SUMMARY_RESULT = [
  {
    target: "acme.in",
    first_seen: "2019-03-02 10:11:12 +00:00",
    lost_date: null,
    rank: 38,
    backlinks: 1240,
    backlinks_spam_score: 4,
    crawled_pages: 120,
    broken_backlinks: 17,
    broken_pages: 3,
    referring_domains: 96,
    referring_domains_nofollow: 21,
    referring_main_domains: 90,
    referring_pages: 1100,
    referring_links_attributes: { nofollow: 240, noopener: 30 },
  },
];

export const DOMAINS_RESULT = [
  {
    target: "acme.in",
    total_count: 96,
    items_count: 3,
    items: [
      { type: "backlinks_referring_domain", domain: "www.TimesOfIndia.com", rank: 92, backlinks: 3, first_seen: "2025-01-04 00:00:00 +00:00", backlinks_spam_score: 0, referring_links_attributes: { nofollow: 1 } },
      { type: "backlinks_referring_domain", domain: "justdial.com", rank: 70, backlinks: 12, first_seen: "2026-10-30 08:00:00 +00:00", referring_links_attributes: null },
      { type: "backlinks_referring_domain", domain: "timesofindia.com", rank: 92, backlinks: 3 }, // duplicate after cleaning
      { type: "backlinks_referring_domain", domain: "not a domain", rank: 5 },
    ],
  },
];

export const BACKLINKS_RESULT = [
  {
    total_count: 1240,
    items: [
      {
        type: "backlink", domain_from: "blog.example.org", url_from: "https://blog.example.org/best-dentists-pune", url_to: "https://acme.in/",
        anchor: "  Acme   Dental  ", dofollow: true, first_seen: "2024-05-01 00:00:00 +00:00", last_seen: "2026-11-01 00:00:00 +00:00",
        domain_from_rank: 41, page_from_title: "Best dentists in Pune", item_type: "anchor", is_broken: false,
      },
      { type: "backlink", url_from: "javascript:alert(1)", url_to: "https://acme.in/" },
      { type: "backlink", url_from: "https://dir.example.com/x", url_to: "https://acme.in/old", anchor: null, dofollow: false, rank: 600, is_broken: true, item_type: "image" },
    ],
  },
];

export const ANCHORS_RESULT = [
  {
    total_count: 2,
    items: [
      { anchor: "acme dental", backlinks: 300, referring_domains: 40, first_seen: "2020-01-01 00:00:00 +00:00" },
      { anchor: "", backlinks: 12, referring_domains: 4 },
    ],
  },
];

export const NEW_LOST_RESULT = [
  {
    items: [
      { type: "backlinks_timeseries_new_lost_summary", date: "2026-11-02 00:00:00 +00:00", new_backlinks: 10, lost_backlinks: 2, new_referring_domains: 3, lost_referring_domains: 1 },
      { type: "backlinks_timeseries_new_lost_summary", date: "2026-10-26 00:00:00 +00:00", new_backlinks: 4, lost_backlinks: 0, new_referring_domains: 1, lost_referring_domains: 0 },
    ],
  },
];

export const INTERSECTION_RESULT = [
  {
    total_count: 57,
    items: [
      {
        domain_intersection: {
          "1": { type: "backlinks_domain_intersection", target: "rival.in", domain: "pune-directory.in", rank: 33, backlinks: 2 },
          "2": { type: "backlinks_domain_intersection", target: "other.com", domain: "pune-directory.in", rank: 33, backlinks: 5 },
        },
        summary: { intersections_count: 2 },
      },
      { domain_intersection: { "1": { domain: "news.example.com", rank: 80, backlinks: 1 }, "2": null } },
      // older shape: entries directly on the item
      { "2": { domain: "www.blogger.example", rank: 12, backlinks: 3 } },
      { domain_intersection: { "1": { domain: "zero.example", rank: 50, backlinks: 0 } } },
    ],
  },
];
