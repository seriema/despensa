# Despensa — project plan

> Source of truth for this project. Any agent or session picking this up: read this file first,
> then `docs/KRILL_API.md`. Keep this file short and current — update the **Status** and
> **Decisions** sections whenever something changes. Markdown on purpose: cheap to read/diff.

## 1. What the app is

**Despensa** (Portuguese for "pantry") is an Android app for a two-person household on the Litoral Norte of São Paulo (initial users: the author and partner) to keep a
**2-month household stock** (food, hygiene, cleaning) topped up from one store:
**Rede Krill** (https://www.lojasredekrill.com.br), delivered to the household address (entered at setup, stored only on the device),
paid on delivery.

Monthly loop:
1. **Inventory walk** — open app, walk room by room, set "have" count per item with big +/− buttons (no keyboard).
2. **Shopping list** — `buy = target − have` (target = 2-month stock, in store packages).
3. **Fill cart** — app fills the Krill cart via Krill's API, reports unavailable items and price jumps.
4. **Human confirmation** — user reviews cart/total in the app, then finishes checkout (pay on delivery). *No auto-ordering in v1.*
5. **Record** — the order (items, prices, date) is stored for spending + price history.

Secondary: **price watching** — daily price snapshots of all list items, alerts on jumps ≥ 5 %,
monthly spending over time, and a "good day to buy" notification.

## 2. Decisions (agreed with user, 2026-11-17)

| Topic | Decision |
|---|---|
| Stack | Web app first (Vite + React + TypeScript), packaged for Android with **Capacitor**. Same code in Chrome and on the phone. |
| Sync | Both phones share data → hosted DB (**Supabase** proposed; Firebase acceptable). Fallback: single "main" phone. |
| Ordering | App fills cart; **user confirms** (dialog/notification). Never auto-places orders in v1. |
| Counting | Store packages (1 carton, 1 bag, 1 pack of 12). +/− steps of 1. **Counts start at 0** – people count what they see (feedback v0.2). |
| Target | List = 2-month target. Buy = target − counted stock (never negative). |
| Free delivery | Threshold configurable (default **R$ 600**). If below, suggest top-ups (list items cheap today / buying ahead). Top-ups are suggestions, never automatic. |
| Out of stock | If Krill reports unavailable, use a per-item **backup product** if set; otherwise flag it. Also flag items that silently arrive substituted (manual "didn't arrive" toggle after delivery — later). |
| Rooms (walk order) | 1 Fridge & freezer · 2 Kitchen pantry (dry food) · 3 Back storage (toilet paper, drinks, bulk) · 4 Bathroom · 5 Laundry/cleaning. Editable. |
| Languages | English, Português, Svenska. Chosen at first run, changeable in Settings. |
| Onboarding | First-run tutorial: language → address → Krill login → import history → build list → first inventory. |
| Address | Entered in onboarding, editable in Settings. Never hard-coded or committed (public repo). |
| Price alerts | Only meaningful changes: ≥ 5 % (configurable) vs. item's recent median. Ignore tiny moves. |
| First-run list | Setup step builds the 2-month list: suggested from order history (regular, still-bought, non-snack items; target = consumption × 2), or a basic list, or empty. User adjusts and approves. Non-list products live only in "Add from order history" (no second list to maintain). |
| Count screen | Default **list view per room** (all items in a room, compact −/+, photo). Toggle to **card view** (one item, big photo). |
| Price alerts | Compare latest list price with the median of the previous ≤5 purchases; show that comparison window and dates. Sparkline plots list price; green dots = paid on sale. |
| Krill login | One-time login in an embedded WebView (handles reCAPTCHA/SMS), app keeps `cliente-token` + `sessao-id`; re-login on 401. Details in docs/KRILL_API.md. |
| Cart fill | Snapshot server cart first and merge (cart is shared with the website). Max 50 lines, min order R$ 99. Stop before checkout; user finishes on Krill. |
| Hosting for testing | Public GitHub repo + GitHub Pages; installable web app (PWA, "Add to Home screen"), data in browser localStorage per device until sync exists. No personal data in the repo. |
| Needs, not products | A list line is a NEED ("Leite integral 1L"). Default **any brand – cheapest** among known products + live products in the same Krill section (filtered by keywords); compared per kg/L/unit when sizes differ. Can be switched to **this exact product**. |
| Never buy | Block single products per need, or whole brands (Krill `marca_id`) globally. Managed from the need's product list; overview in Settings. |
| When to buy | Measured in money: paid price vs. the same product's usual price (±8-month median), weighted by value, by day-of-month range (1–5, 6–14, 15–24, 25–29, 30–31) and weekday. History is too thin to conclude; daily checks will. |
| Name | **Despensa**. Store names (Krill) appear only where the store is meant: settings, data source, store connector code. |
| Multiple stores (later) | Architecture keeps store-specific code behind a **store connector** interface (`app/src/stores/<store>/`): search, product details, section listing, cart, order history. Only Rede Krill now. A research pass compares Extra, Tenda Atacado Bertioga and Mercadão Atacadista Bertioga to see if multi-store is worth it (incl. transport). |
| Shelf life | Each need has "keeps for" (default: produce 1 wk, fridge 3 wk, pantry/cleaning/frozen 8 wk; editable). Target = weekly use × keeps-for (max 8 wk). |
| Two rhythms | **Monthly order** (filled in the store's cart) for items keeping ≥3 weeks; **fresh top-up** = in-store checklist every 1–2 weeks for short-life items (user goes to Krill or Extra). With multi-store later, the app recommends the cheaper store that day. |
| Spending data gap | Krill order history = online orders only (≈R$455–580/month); in-store purchases (Krill, Extra, markets) are invisible, real spend ≈ R$1000+/month. Idea: Nota Fiscal Paulista (CPF na nota) receipts as a source. |
| Test data → real app | The household's real test run happens in the PWA. **Settings → Backup → Export** saves a JSON file (`{app, schema, exportedAt, state}`) via the Android share sheet; the Android app must offer **Import** on first run (reuse `migrate()` in state/store.tsx). Keep the backup schema backward compatible. |
| Hand-off | Plain readable TS, no obfuscation/minification in source; comments on *why*; this PLAN + docs kept current. Code in a git repo (GitHub, to be created). |

## 3. Architecture

```
[Android phone x2]  Capacitor app (React UI)
   ├─ Local cache (IndexedDB) – works offline during inventory walk
   ├─ Sync ⇄ Supabase (list, inventory sessions, orders, price snapshots)
   ├─ Krill client (TS) – login session, search, product details, cart fill
   └─ Background job (WorkManager via Capacitor plugin) – daily price check + local notifications

[Supabase]  Postgres + auth (one shared household)
   └─ (optional) scheduled function: daily price snapshot server-side, so it runs
      even if phones are asleep. Needs a test that Krill's product endpoint answers
      without login and from a non-Brazil IP. If not, phones do it.
```

**Background on Android** — the app can't run forever; Android kills that. The correct tool is
**WorkManager periodic work** (daily, "requires network"). Android may delay it by hours under
Doze, which is fine for a daily price check. Server-side scheduling is the more reliable option and
also gives both phones one shared price history.

## 4. Krill integration (summary — details in `docs/KRILL_API.md`)

- Platform **VipCommerce**. API: `https://services.vipcommerce.com.br/api-admin/v1/`
- Ids: org **216**, filial **1**, distribution centre (CD) **20**.
- Headers: `DomainKey: lojasredekrill.com.br`, `OrganizationId: 216`, `sessao-id`, `Authorization: Bearer <vip-token>`.
- Known endpoints: order history `org/216/filial/1/loja/compras/N?page=N`; product
  `…/centro_distribuicao/20/loja/produtos/{id}/detalhes` (preco, disponivel, em_oferta, oferta);
  search `…/loja/buscas/produtos/termo/{q}`; cart `…/loja/carrinhos`.
- Order lines carry `preco` (list) and `preco_venda` (paid) → discount history is recoverable.
- Cart write API, delivery types/slots and auth are mapped: see `docs/KRILL_API.md` and `app/src/stores/krill/krillCart.reference.js`.

## 5. Data model (draft)

- `Item` — id, name (pt), room, targetQty, krillProductId, backupProductId?, unit, notes, sortOrder
- `InventorySession` — id, startedAt, by, counts{itemId: have}
- `Order` — id, krillOrderId?, createdAt, deliveryAt, subtotal, discounts, frete, total, lines[]
- `OrderLine` — krillProductId, qty, listPrice, paidPrice
- `PriceSnapshot` — krillProductId, takenAt, price, onSale, salePrice, available
- `Settings` — language, address, freeDeliveryThreshold, alertThresholdPct, household members

## 6. Known data (from order history, 2026-11-17)

25 completed orders, Sep 2024 → Nov 2026 (5 cancelled ones ignored); 494 distinct products;
100 "staples" bought ≥ 3 times. Order totals R$ 318–1 092. Several orders under R$ 600 paid R$ 20–30
delivery. Visible price moves: e.g. Cebola Nacional R$ 0.80 → 2.25, Cebola Roxa 1.60 → 4.80,
Acém R$ 15.50 → 22.50. Raw extract: `data/staples.txt`.

## 7. Roadmap

1. **Prototype (now)** — clickable web prototype with real staples data: inventory walk, list, cart review mock, price dashboard, settings, onboarding.
2. **Cart PoC** — script that fills the cart via API and reports; verified, cart restored. *(in progress)*
3. **MVP app** — real Krill client, local storage, history import, Capacitor APK sideloaded on both phones.
4. **Sync** — Supabase household; both phones.
5. **Price watcher** — daily snapshots, alerts, "buy today" notification, monthly analytics.
6. **Nice-to-have** — post-delivery check ("didn't arrive / substituted"), top-up suggestions, consumption-based target tuning.

## 8. Status

- 2026-11-17: Krill explored, API identified, order history extracted, plan written.
  Prototype v0.1 published (onboarding, inventory walk, buy list + simulated cart fill,
  prices dashboard from real history, settings + list editor, EN/PT/SV). Cart-API PoC done (docs/KRILL_API.md).
- 2026-11-17 (later): v0.2 after user feedback – setup step with smart suggestions, list/card count views,
  product photos (load on phone build, blocked in claude.ai preview), alert comparison window, sparkline fix.
  Next: GitHub repo + Pages test build; port krillCart to TS (app/src/stores/krill/); real history import.
- 2026-11-17 (evening): v0.3 – needs with any-brand/cheapest matching (curated groups in data/groups.ts from real
  history + Krill sections), product/brand blocking, counts start at 0, money-weighted timing analysis,
  live catalog check (14 staples no longer sold, e.g. Omo 800g). Section listing endpoint found:
  `CD/classificacoes_mercadologicas/departamentos/{deptId}/produtos?page=1&secao={sectionId}`.
- 2026-11-17 (night): v0.4 – renamed **Despensa**; store code under app/src/stores/krill/. Buy review compares with
  the product bought LAST TIME (not the need name) and says why (out of stock / blocked / cheaper + saving).
  Brand stickiness: keep last-bought unless another is ≥2 % cheaper. Pack-size conversion (4-pack vs single,
  20 vs 30 eggs) so the same amount is bought. Multi-store research running (Extra, Tenda, Mercadão).

- 2026-11-17 (late): v0.5 on GitHub Pages (seriema.github.io/despensa). Compact layout for Galaxy S24 (384×~740),
  swipe in onboarding and card view, pack size shown while counting (from the product bought last time),
  never swap to a pack >2× or <½ the usual size, swap review = photos + "OK / Not this one", clearer price-change rows,
  login + history import are visibly simulated (demo) with a progress screen. Example basket tab added to the
  research sheet: Tenda delivered ≈ R$30/month cheaper for common items, pickup/split ≈ no saving.
  CEP lookup added (BrasilAPI v2 → ViaCEP fallback, CORS verified from the Pages origin; src/domain/cep.ts).
  Next: real Krill client in the Android (Capacitor) build, sync.

- 2026-11-17 (night): left-handed setting; fresh top-up checklist + monthly order split by shelf life;
  example basket sheet corrected to real monthly amounts (Krill-only data).

- 2026-11-18: count-card button side setting (left/right/below), count scopes (monthly-order items / fresh items,
  opened from the Buy tab), backup export/import for carrying the real test run into the Android app.

## 9. Open questions

- Supabase vs Firebase (default: Supabase).
- GitHub repo name/owner for the code.
- Does the product endpoint work without login (needed for server-side price checks)?
