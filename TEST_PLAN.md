# Test Plan: Mini Checkout

## 1. Scope

**In scope:** the customer journey on the single checkout page. That means adding and removing
items, changing quantities, line and order totals, the required name field, validation,
placing an order, the confirmation and reference, and preventing duplicate orders.

**Out of scope:** backend, payments, persistence, cross-browser, and load testing. None of these exist in this build.

**Environment:** Windows 11, Node 24.13.1, @playwright/test 1.65.1, Chromium (headless for
automated runs; the in-app browser for manual runs), served at `http://localhost:4173`
(4174 for manual testing).

## 2. Risks, highest first

| # | Risk | Why it matters | How it is covered |
|---|---|---|---|
| R1 | **Wrong order total** (quantity or rounding errors) | Customer charged the wrong amount, so trust is lost | Auto test 3: exact ₹ values after each change, including 50-paise amounts |
| R2 | **Duplicate order** from double-click or double-submit | Customer charged twice, refunds needed | Manual MT-02 + 2 automated regressions (real double-click, and two submits in the same instant) |
| R3 | **Order placed with no name** | Order can't be fulfilled | Auto test 2: blank or spaces-only name is blocked |
| R4 | **Order placed with an empty cart** | Empty "ghost" order | Manual MT-01 + automated regression |
| R5 | Customer's input lost after an error | Frustration and drop-off | Asserted in test 2 (cart kept) and MT-01 (name kept) |
| R6 | No clear success signal or missing reference | Customer unsure whether they ordered, so they retry and make R2 worse | Auto test 1 asserts the heading, name, reference format and amount |
| R7 | Total hidden or layout broken on a phone | Most shoppers are on mobile, so they can't see what they'll pay (R1 on a small screen) | `mobile.spec.js` at 375 px: total visible and exact, no sideways scrolling (added after D-02) |

## 3. Automated checks (`tests/checkout.spec.js`)

Each test runs in a **brand-new browser context** and first asserts the clean
starting state (empty cart, empty name). Assertions are on visible text, labels and
roles. There are no fixed waits, because `expect` retries until the condition is met.
Expected amounts are written as literal values, not calculated with the app's code.

| ID | Check | Key assertions |
|---|---|---|
| AT-1 | Successful checkout | Add both items → total ₹1,548.50 → enter name → Place order → "Order confirmed", "Thank you, Asha Rao.", reference matches `MC-YYYYMMDD-XXXXXX`, amount ₹1,548.50, Place order gone, exactly 1 order created |
| AT-2 | Missing required field | Name "   " → "Please enter your full name." shown inline and in the summary, field marked invalid and focused, no confirmation, cart still qty 1 / ₹1,199.00, 0 orders. Typing a name clears the error |
| AT-3 | Quantity changes the exact total | Tote ×1 ₹349.50 → ×3 line ₹1,048.50 → + bottle total ₹2,247.50 → tote ×2 line ₹699.00, total ₹1,898.00 → remove bottle total ₹699.00 |

Extra regressions (`tests/edge-cases.spec.js`): empty cart blocked (name kept), empty cart + blank
name shows both messages, real double-click gives 1 order and no stray text selection, two
`requestSubmit()` calls in the same instant give 1 order, and "Start a new order" resets cleanly.
`tests/mobile.spec.js` covers phone width (375 × 800): order total visible and equal to ₹1,548.50,
Remove buttons fully on screen, and no horizontal overflow.

**Are the tests able to fail?** I checked this by breaking the code on purpose:
- I removed the `if (state.status !== "editing") return;` guard and ran the double-submit tests.
  *"two submits fired in the same instant"* **failed** (`Expected: 1, Received: 2`). The real
  double-click test still passed, because the button is also disabled right away (a second layer of protection).
- I disabled the D-01 fix. *"rapid double-click"* **failed** (`Expected: "", Received: "349.50"`).
- I put back the old D-02 CSS rule. *"phone width"* **failed** (`toBeVisible: Expected visible, Received hidden`).

All three changes were reverted before the final run.

## 4. Manual tests

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| MT-01 Empty cart | Fresh page → type "Manual Tester" in Full name → click Place order | Order blocked, clear message, name kept | Red summary: "We couldn't place your order: Your cart is empty. Add at least one item to place an order." Name still "Manual Tester". No confirmation, 0 orders. Adding an item made the message disappear without retyping | **Pass** ([evidence](evidence/manual-MT01-empty-cart.jpg)) |
| MT-02 Rapid double-click | Add 1 item → type a name → double-click Place order quickly (real mouse double-click) | Exactly one confirmation and one reference | One confirmation (ref `MC-20261125-0D2F97`, ₹349.50). Order count = 1, button disabled, form hidden, no console errors. **But** the word "order" on the confirmation was highlighted, see D-01 | **Pass** (functional), defect D-01 raised |
| MT-02 retest | Same steps after the fix | As above, with no highlighted text | One confirmation (ref `MC-20261125-ED2FEF`, ₹1,199.00), order count 1, `getSelection()` = "" | **Pass** ([evidence](evidence/manual-MT02-double-click-after-fix.jpg)) |

## 5. Defects

### D-01: Double-clicking Place order highlights text on the confirmation (Low, cosmetic). **Fixed**

- **Steps:** 1) Open the page. 2) Add any item. 3) Type a name. 4) Double-click **Place order** quickly.
- **Expected:** One confirmation, shown cleanly.
- **Actual:** One confirmation (correct, no duplicate order), but the second press of the double-click
  lands on the confirmation and the browser highlights a word: first "order" in "Start a new order", then,
  after a first CSS-only attempt, the amount "1,199.00".
- **Impact:** No data or money impact. It looks like a glitch at the moment the customer should feel sure
  their order went through.
- **Evidence:** [before fix](evidence/manual-MT02-double-click-before-fix.jpg),
  [after fix](evidence/manual-MT02-double-click-after-fix.jpg).
- **Fix:** In `app.js`, a `mousedown` handler cancels double-click text selection only within 1 second
  after an order is placed (`e.detail > 1`). Buttons also get `user-select: none`. The reference can still be
  selected and copied afterwards.
- **Regression:** the automated double-click test now asserts that `getSelection()` is empty. I confirmed it
  fails when the fix is removed.

### D-02: Order total disappears on phone-width screens (High). **Fixed**

Found during a review of the finished submission, when I checked the page at phone width for the first time.

- **Steps:** 1) Open the page in a 375 × 800 viewport (e.g. DevTools → iPhone size). 2) Add both products.
  3) Look at the cart footer.
- **Expected:** "Order total ₹1,548.50" visible. The page fits the screen width.
- **Actual:** The "Order total" label shows but **the amount is missing**. The cart table is also 6 px wider
  than the screen (`scrollWidth 381` vs `clientWidth 375`), so the Remove buttons touch the edge.
- **Impact:** On a phone, the customer can't see what they're about to pay (a mobile version of risk R1).
- **Cause:** `styles.css` hid the unit-price column on small screens with `.cart-table td:nth-child(2)`.
  In the footer row, the 2nd cell is the order total, so it was hidden too.
- **Evidence:** [before fix](evidence/D-02-phone-width-before-fix.png),
  [after fix](evidence/phone-width-order-total.png).
- **Fix:** Scoped the rule to `thead th:nth-child(2)` and `tbody td:nth-child(2)`, and tightened cell
  and button padding on small screens.
- **Regression:** `tests/mobile.spec.js`. I confirmed it fails when the old rule is restored.
- **Lesson:** the original plan didn't include a mobile viewport. R7 has been added to the risk table.

No other defects were found. Totals, validation and the duplicate-order guard all behaved as expected.

## 6. Results (final run, 2026-11-25)

```
Running 9 tests using 6 workers
  ok  checkout.spec.js   › 1. successful checkout shows one confirmation with a reference
  ok  checkout.spec.js   › 2. blank name blocks checkout, explains why and keeps the cart
  ok  checkout.spec.js   › 3. changing quantity updates line totals and the exact order total
  ok  edge-cases.spec.js › empty cart blocks checkout and keeps the typed name
  ok  edge-cases.spec.js › empty cart and blank name together show both messages
  ok  edge-cases.spec.js › rapid double-click on Place order creates exactly one order
  ok  edge-cases.spec.js › two submits fired in the same instant still create one order
  ok  edge-cases.spec.js › starting a new order returns to a clean, usable checkout
  ok  mobile.spec.js     › phone width: order total visible, correct, no sideways scrolling
  9 passed (3.6s)
```

Full output: [evidence/test-run-output.txt](evidence/test-run-output.txt). Screenshots from the
automated run: `evidence/empty-cart-blocked.png`, `evidence/double-click-one-confirmation.png`,
`evidence/phone-width-order-total.png`.

## 7. Known limitations

- Tested only in Chromium on Windows (desktop size and 375 px phone size). Firefox and Safari were not run.
- Running the tests refreshes the screenshots in `evidence/` that were taken by automated tests.
  The `manual-*` and `D-02-*before-fix` files are never overwritten.
- The cart lives in memory, so refreshing the page empties it (by design, since there's no backend).
- `window.miniCheckout.orderCount()` is a read-only test hook. It is used only to back up the
  on-screen assertions with an exact count of orders created.
