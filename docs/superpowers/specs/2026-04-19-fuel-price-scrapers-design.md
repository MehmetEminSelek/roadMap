# Fuel Price Scrapers — Shell & Petrol Ofisi

**Date:** 2026-04-19  
**Status:** Approved

## Problem

- OPET fetcher (`api.opet.com.tr`) times out on Railway (datacenter IP blocked). Works locally.
- Shell and PO fetchers are stubs returning `null`.
- App falls back to default price (40 TL) for these brands.

## Scope

1. Implement `ShellFetcher` using Shell TR's internal XHR API.
2. Implement `PetrolOfisiFetcher` using PO TR's internal XHR API.
3. OPET Railway fix is out of scope for now — test locally to confirm it works.

## Approach

Both Shell (https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html) and Petrol Ofisi (https://www.petrolofisi.com.tr/akaryakit-fiyatlari) use XHR calls when a province is selected — the table updates without a full page reload. We reverse-engineer these endpoints via Chrome DevTools and call them directly, following the same pattern as `OpetFetcher`.

## Endpoint Discovery (Manual Step)

Before implementation, the developer must:
1. Open each URL in Chrome with DevTools → Network → Fetch/XHR filter open.
2. Select a province from the dropdown.
3. Record: request URL, method (GET/POST), request params/body, response JSON shape.
4. Repeat for a second province to confirm per-province vs. national pricing.

## Architecture

No new abstractions. Both fetchers extend `BrandPriceFetcher` (base.fetcher.ts) exactly like OPET:

```
fetch(provinceCode): BrandPrices | null
  → HTTP request to discovered endpoint with province param
  → parse petrol / diesel / lpg from response
  → return null on any error (logger.warn)

fetchAll(): Map<number, BrandPrices> | null
  → if per-province: iterate ALL_PROVINCE_CODES (concurrency 6, 100ms gap) — same as OPET
  → if national single price: one request, replicate value across all 81 provinces
```

### Per-province vs. National

To be determined from endpoint discovery. If Shell/PO return one national price:
- `fetchAll()` makes a single request.
- Stores identical `BrandPrices` for all 81 province codes in DB.
- No change needed in orchestrator or DB schema.

### Headers

If the endpoint requires `Referer` or `User-Agent`, add them to the axios request config. If a session `Cookie` is required, add a pre-request step to `GET` the main page and extract the cookie before calling the API.

## Error Handling

Unchanged from existing pattern:
- Any fetch error → log `WARN` with province code → return `null`.
- `fetchAll` returning empty map → orchestrator logs `fetchAll boş döndü` and skips DB write.
- Downstream fallback: orchestrator uses last valid DB price, then national average, then env default (40 TL).

## Out of Scope

- OPET Railway IP block fix (separate task — proxy or Türkiye-egress solution).
- BP fetcher (remains stub).
- Switching from `setInterval` to a proper cron framework.
