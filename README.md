# Mini Checkout

A single-page checkout with two synthetic products, a cart with live line and order
totals, one required field (full name), validation, and an order confirmation with
a reference. Browser tests use [Playwright](https://playwright.dev).

No backend, database, payments or external services. Everything runs in the browser.

## Requirements

- Node.js 18 or newer (tested on Node 24.13.1, Windows 11)

## Run the page

```powershell
npm install
npm start
```

Open **http://localhost:4173**. (`npm start` runs `node server.js 4173`, a tiny
dependency-free static server.) Stop it with `Ctrl + C`.

## Run the browser tests

First time only, download the Chromium build that Playwright uses:

```powershell
npx playwright install chromium
```

Then:

```powershell
npm test                 # headless, all 9 tests
npm run test:headed      # watch them run in a visible browser
npm run report           # open the HTML report from the last run
```

Playwright starts the page server for you (see `playwright.config.js`), so you do
not need `npm start` running.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Page structure: products, cart, details form, confirmation |
| `styles.css` | Plain styling |
| `app.js` | Cart state, totals, validation, order placement, double-submit guard |
| `server.js` | Static file server for local runs and tests |
| `tests/checkout.spec.js` | **The three required checks** (success, missing field, exact total) |
| `tests/edge-cases.spec.js` | Regression checks for the manual scenarios (empty cart, double-click) + reset |
| `tests/mobile.spec.js` | Phone-width (375 px) check: total visible, no sideways scrolling |
| `RESULTS.md` | One-page results summary with links to evidence |
| `results-html-report/` | Playwright HTML report from the final run (Submissions copy) |
| `TEST_PLAN.md` | Risk-based test plan, manual test log, defect report, results |
| `evidence/` | Screenshots and saved test output |

## Products

| Product | Price |
|---|---|
| Canvas Tote Bag | ₹349.50 |
| Steel Water Bottle | ₹1,199.00 |

Money is stored as whole paise (integers), so totals are exact. The tote's
50-paise price makes rounding mistakes visible in the tests.

## Key behaviours

- Add, remove, and change quantities (1–10). Line totals and the order total update immediately.
- Place order is blocked when the cart is empty or the name is blank (spaces only also count as
  blank). Messages say exactly what to fix, and the typed name and cart are never cleared.
- On success, the form is replaced by a confirmation that shows the name, amount and a reference like
  `MC-20261125-4A1F40`.
- **Double-submit guard:** the first valid submit sets the order status to `placed` and disables the
  button *before* anything is drawn, so further clicks or submits are ignored. One order, one confirmation.

## Results (2026-11-25)

**9 / 9 automated tests pass.** Manual empty-cart and double-click tests pass. Two real defects
were found, fixed and retested: D-01 (low, a double-click highlighted text on the confirmation)
and D-02 (high, the order total was hidden at phone width). See
[RESULTS.md](RESULTS.md) for the summary, [TEST_PLAN.md](TEST_PLAN.md) for details and
[evidence/](evidence/) for proof.
